/*
 * Optional 3D view of the Mars base. VISUAL ONLY.
 * - Reads MissionCore.state and MissionCore.solData(); never changes them.
 * - Uses the local copy vendor/three.min.js (r149). No images, no internet:
 *   terrain, sky, sun, textures and labels are all drawn in code.
 * - If anything fails (no WebGL, no THREE, any error), the 3D panel is removed
 *   and the 2D game keeps working exactly as before.
 */
(function () {
  "use strict";
  const box = document.getElementById("scene3d");           // the panel that holds the canvas
  const C = window.MissionCore;                               // game core (read-only for us)
  let running = true;                                         // stops the animation loop on failure

  // Remove the 3D panel and stop. The 2D game is untouched.
  function giveUp() { running = false; if (box) box.remove(); }

  if (!box || !C || !window.THREE) { giveUp(); return; }      // missing pieces → 2D only
  if (matchMedia("(max-width: 400px)").matches) { giveUp(); return; } // very small phones → 2D only

  try { init(); } catch (e) { giveUp(); }                     // any setup error → 2D only

  function init() {
    const T = window.THREE;
    const canvasBox = box.querySelector(".scene3d-canvas");
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- small helpers ---------- */
    function rng(seed) {                                      // repeatable random numbers (same scene every time)
      return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
    }
    const rand = rng(2024);
    const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
    function canvasTex(w, h, draw) {                         // draw a texture with the 2D canvas API
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      draw(c.getContext("2d"), w, h);
      const tex = new T.CanvasTexture(c);
      tex.encoding = T.sRGBEncoding;
      return tex;
    }
    function skyTex(top, mid, low) {                         // vertical sky gradient
      return canvasTex(4, 256, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, 0, h);
        gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, low);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      });
    }
    function glowTex(inner, outer) {                         // soft round dot (sun, particles)
      return canvasTex(64, 64, (g) => {
        const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
        gr.addColorStop(0, inner); gr.addColorStop(0.35, inner); gr.addColorStop(1, outer);
        g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      });
    }
    function labelSprite(text, color) {                      // floating emoji label over a module
      const tex = canvasTex(128, 128, (g) => {
        g.fillStyle = "rgba(20,10,25,0.75)"; g.beginPath(); g.arc(64, 64, 58, 0, Math.PI * 2); g.fill();
        g.lineWidth = 8; g.strokeStyle = color; g.stroke();
        g.font = "64px 'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif";
        g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, 64, 70);
      });
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
      s.scale.set(0.9, 0.9, 0.9);
      s.renderOrder = 10;
      return s;
    }

    /* ---------- 1. renderer, scene, camera ---------- */
    const renderer = new T.WebGLRenderer({ antialias: true });                 // throws if WebGL is missing → caught above
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputEncoding = T.sRGBEncoding;                                  // correct colors
    renderer.toneMapping = T.ACESFilmicToneMapping;                            // soft, film-like light
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;                                         // soft shadows from the low sun
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    canvasBox.appendChild(renderer.domElement);
    renderer.domElement.addEventListener("webglcontextlost", giveUp);         // GPU lost → back to 2D

    const scene = new T.Scene();
    const skyCalm = skyTex("#6e3f3a", "#d48a5c", "#f2c48f");                   // dusty butterscotch Mars sky
    const skyStorm = skyTex("#12030c", "#4a0f1c", "#9a2f26");                  // dark red storm sky
    scene.background = skyCalm;
    const fogCalm = new T.Color("#e9b383"), fogStorm = new T.Color("#6a2224");
    scene.fog = new T.Fog(fogCalm.clone(), 18, 55);                            // dusty haze toward the horizon

    const camera = new T.PerspectiveCamera(40, 2, 0.1, 200);
    let camAngle = 0.7;

    /* ---------- 2. lights: low sun + soft sky light ---------- */
    const sunDir = new T.Vector3(-0.75, 0.32, -0.58).normalize();              // low in the sky → long shadows
    const sun = new T.DirectionalLight(0xffd2a0, 1.5);
    sun.position.copy(sunDir).multiplyScalar(30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -12, right: 12, top: 12, bottom: -12, near: 1, far: 70 });
    sun.shadow.bias = -0.0006;
    sun.shadow.radius = 4;
    scene.add(sun);
    const sky = new T.HemisphereLight(0xf3b98a, 0x5a2416, 0.75);               // light from the dusty sky
    scene.add(sky);
    const alarm = new T.PointLight(0xff2a3a, 0, 22);                           // red alarm light, off until failure
    alarm.position.set(0, 5, 0);
    scene.add(alarm);

    const sunDisc = new T.Sprite(new T.SpriteMaterial({ map: glowTex("rgba(255,244,220,1)", "rgba(255,200,140,0)"),
      transparent: true, depthWrite: false, fog: false }));                     // the visible Sun
    sunDisc.position.copy(sunDir).multiplyScalar(90);
    sunDisc.scale.set(14, 14, 1);
    scene.add(sunDisc);

    /* ---------- 3. Mars terrain: gentle dunes, flat pad for the base, hills far away ---------- */
    function heightAt(x, z) {
      const r = Math.hypot(x, z);
      const h = Math.sin(x * 0.35) * 0.45 + Math.cos(z * 0.28) * 0.55 + Math.sin((x + z) * 0.15) * 1.1
              + Math.sin(x * 1.3 + z * 0.7) * 0.12 + 0.5;
      const hills = r > 20 ? (r - 20) * 0.35 : 0;                             // rise toward the horizon
      return (h + hills) * smooth(6, 12, r);                                   // flat in the middle for the base
    }
    const tGeo = new T.PlaneGeometry(90, 90, 110, 110);
    tGeo.rotateX(-Math.PI / 2);
    const tp = tGeo.attributes.position;
    const cols = new Float32Array(tp.count * 3);
    const cA = new T.Color("#9a4426"), cB = new T.Color("#cc6b3a"), cC = new T.Color("#e39a62"), tmp = new T.Color();
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i), z = tp.getZ(i), y = heightAt(x, z);
      tp.setY(i, y);
      const n = 0.5 + 0.5 * Math.sin(x * 2.1) * Math.cos(z * 1.7);              // small color patches
      tmp.copy(cA).lerp(cB, Math.min(1, 0.35 + y * 0.18 + n * 0.3)).lerp(cC, Math.max(0, n - 0.75));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tGeo.setAttribute("color", new T.BufferAttribute(cols, 3));
    tGeo.computeVertexNormals();
    const terrain = new T.Mesh(tGeo, new T.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    terrain.receiveShadow = true;
    scene.add(terrain);

    /* ---------- 4. rocks: lumpy shapes scattered around (not on the base pad) ---------- */
    function rockGeo() {
      const g = new T.IcosahedronGeometry(1, 1);
      const p = g.attributes.position, bump = new Map();
      for (let i = 0; i < p.count; i++) {                                      // same corner → same bump (no cracks)
        const key = `${p.getX(i).toFixed(3)},${p.getY(i).toFixed(3)},${p.getZ(i).toFixed(3)}`;
        if (!bump.has(key)) bump.set(key, 0.75 + rand() * 0.45);
        const k = bump.get(key);
        p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.65, p.getZ(i) * k);
      }
      g.computeVertexNormals();
      return g;
    }
    const rockGeos = [rockGeo(), rockGeo(), rockGeo()];
    const rockMat = new T.MeshStandardMaterial({ color: 0x6e3020, roughness: 0.95, flatShading: true });
    for (let i = 0; i < 46; i++) {
      const a = rand() * Math.PI * 2, r = 7.2 + rand() * 22;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, s = 0.15 + rand() * (r > 14 ? 1.2 : 0.55);
      const m = new T.Mesh(rockGeos[i % 3], rockMat);
      m.position.set(x, heightAt(x, z) + s * 0.25, z);
      m.scale.setScalar(s);
      m.rotation.y = rand() * 6.28;
      m.castShadow = m.receiveShadow = true;
      scene.add(m);
    }

    /* ---------- 5. level bars: glowing poles next to each module ---------- */
    function levelBar(x, z) {
      const geo = new T.CylinderGeometry(0.11, 0.11, 1, 12);
      geo.translate(0, 0.5, 0);                                                // grow upward from the ground
      const bar = new T.Mesh(geo, new T.MeshStandardMaterial({ color: 0x5fe08a, emissive: 0x5fe08a, emissiveIntensity: 0.6 }));
      bar.position.set(x, 0, z);
      scene.add(bar);
      return bar;
    }
    function setBar(bar, frac) {
      const f = Math.max(0.03, Math.min(1, frac));
      bar.scale.y = f * 2.2;
      const c = f < 0.25 ? 0xff5c6c : f < 0.5 ? 0xffd23f : 0x5fe08a;          // red / yellow / green
      bar.material.color.set(c); bar.material.emissive.set(c);
    }
    const white = new T.MeshStandardMaterial({ color: 0xf2ece4, roughness: 0.55, metalness: 0.1 });

    /* ---------- 6. Life Support habitat (blue): dome with glowing windows and an airlock ---------- */
    const hab = new T.Group();
    const habBase = new T.Mesh(new T.CylinderGeometry(1.7, 1.8, 1.0, 40), white);
    habBase.position.y = 0.5;
    const habDome = new T.Mesh(new T.SphereGeometry(1.7, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), white);
    habDome.position.y = 1.0; habDome.scale.y = 0.75;
    const stripe = new T.Mesh(new T.CylinderGeometry(1.72, 1.72, 0.18, 40, 1, true),
      new T.MeshStandardMaterial({ color: 0x4cc3ff, emissive: 0x4cc3ff, emissiveIntensity: 0.4 }));
    stripe.position.y = 0.95;
    const winMat = new T.MeshStandardMaterial({ color: 0x0d2a40, emissive: 0x8fe1ff, emissiveIntensity: 0.6 });
    for (let i = 0; i < 8; i++) {                                              // ring of windows
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const w = new T.Mesh(new T.BoxGeometry(0.34, 0.26, 0.08), winMat);
      w.position.set(Math.cos(a) * 1.76, 0.55, Math.sin(a) * 1.76);
      w.lookAt(0, 0.55, 0);
      hab.add(w);
    }
    const airlock = new T.Mesh(new T.CylinderGeometry(0.5, 0.5, 1.1, 24), white);
    airlock.rotation.z = Math.PI / 2; airlock.position.set(1.9, 0.5, 0);
    const door = new T.Mesh(new T.CircleGeometry(0.38, 24), new T.MeshStandardMaterial({ color: 0x4cc3ff, emissive: 0x4cc3ff, emissiveIntensity: 0.3 }));
    door.position.set(2.46, 0.5, 0); door.rotation.y = Math.PI / 2;
    hab.add(habBase, habDome, stripe, airlock, door);
    hab.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    hab.position.set(-2.4, 0, 0.9);
    scene.add(hab);
    const habLabel = labelSprite("🫧", "#4cc3ff"); habLabel.position.set(-2.4, 3.0, 0.9); scene.add(habLabel);
    const lsBar = levelBar(-4.4, 2.0);

    /* ---------- 7. Greenhouse (green): glass dome with ribs and rows of plants ---------- */
    const gh = new T.Group();
    const glassMat = new T.MeshStandardMaterial({ color: 0xcff7dc, transparent: true, opacity: 0.28, roughness: 0.1,
      metalness: 0.0, emissive: 0x5fe08a, emissiveIntensity: 0.1, depthWrite: false });
    const glass = new T.Mesh(new T.SphereGeometry(1.45, 36, 14, 0, Math.PI * 2, 0, Math.PI / 2), glassMat);
    const ribMat = new T.MeshStandardMaterial({ color: 0xd8e8dc, metalness: 0.4, roughness: 0.4 });
    for (let i = 0; i < 4; i++) {                                              // metal ribs over the glass
      const rib = new T.Mesh(new T.TorusGeometry(1.46, 0.035, 6, 40, Math.PI), ribMat);
      rib.rotation.y = (i / 4) * Math.PI;
      gh.add(rib);
    }
    const ring = new T.Mesh(new T.CylinderGeometry(1.5, 1.55, 0.18, 36), new T.MeshStandardMaterial({ color: 0x5fe08a, emissive: 0x2a7a46, emissiveIntensity: 0.3 }));
    ring.position.y = 0.09;
    const soil = new T.Mesh(new T.CircleGeometry(1.4, 32), new T.MeshStandardMaterial({ color: 0x4a2a1a }));
    soil.rotation.x = -Math.PI / 2; soil.position.y = 0.19;
    gh.add(glass, ring, soil);
    const plants = [];
    const leafMat = new T.MeshStandardMaterial({ color: 0x4fc96a, roughness: 0.7 });
    for (let row = -1; row <= 1; row++) {
      for (let k = -2; k <= 2; k++) {
        if (Math.hypot(row * 0.55, k * 0.42) > 1.15) continue;
        const p = new T.Mesh(new T.SphereGeometry(0.17, 10, 8), leafMat);    // leafy plant
        p.position.set(k * 0.42, 0.33, row * 0.55);
        p.scale.y = 1.3;
        gh.add(p); plants.push(p);
      }
    }
    gh.traverse((o) => { if (o.isMesh && o !== glass) o.castShadow = true; });
    gh.position.set(2.7, 0, 0.9);
    scene.add(gh);
    const ghLabel = labelSprite("🥕", "#5fe08a"); ghLabel.position.set(2.7, 2.5, 0.9); scene.add(ghLabel);
    const ghBar = levelBar(4.6, 2.1);

    /* ---------- 8. Solar panels (energy, yellow frames): cells glow when power is used ---------- */
    const cellTex = canvasTex(128, 192, (g, w, h) => {                       // blue solar cells with grid lines
      g.fillStyle = "#132a5a"; g.fillRect(0, 0, w, h);
      g.strokeStyle = "#5f8fe0"; g.lineWidth = 3;
      for (let x = 0; x <= w; x += w / 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
      for (let y = 0; y <= h; y += h / 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    });
    const panels = [];
    const frameMat = new T.MeshStandardMaterial({ color: 0xffd23f, metalness: 0.5, roughness: 0.4 });
    for (let i = 0; i < C.RULES.power; i++) {
      const g = new T.Group();
      const cellMat = new T.MeshStandardMaterial({ map: cellTex, emissiveMap: cellTex, emissive: 0xffe9a0,
        emissiveIntensity: 0, metalness: 0.3, roughness: 0.35 });
      const panel = new T.Mesh(new T.BoxGeometry(0.9, 0.05, 1.3), [frameMat, frameMat, cellMat, frameMat, frameMat, frameMat]);
      panel.rotation.x = 0.55;                                                 // tilted toward the Sun (Sun is on the -z side)
      panel.position.y = 0.85;
      panel.castShadow = true;
      const leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.85, 8), frameMat);
      leg.position.y = 0.42; leg.castShadow = true;
      g.add(panel, leg);
      g.position.set(-2.1 + i * 1.05, 0, -3.6);
      scene.add(g);
      panels.push(cellMat);
    }
    const enLabel = labelSprite("⚡", "#ffd23f"); enLabel.position.set(0, 2.3, -3.6); scene.add(enLabel);
    const enBar = levelBar(3.5, -3.6);

    /* ---------- 9. Radiation shield (purple): a dome over the whole base ---------- */
    const shieldMat = new T.MeshStandardMaterial({ color: 0xc69bff, emissive: 0xc69bff, emissiveIntensity: 0.25,
      transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false });
    const shield = new T.Mesh(new T.SphereGeometry(6.3, 48, 18, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat);
    const gridMat = new T.MeshBasicMaterial({ color: 0xd9bfff, wireframe: true, transparent: true, opacity: 0.0, depthWrite: false });
    const shieldGrid = new T.Mesh(new T.SphereGeometry(6.32, 24, 9, 0, Math.PI * 2, 0, Math.PI / 2), gridMat);
    scene.add(shield, shieldGrid);
    const shLabel = labelSprite("🛡️", "#c69bff"); shLabel.position.set(0, 6.9, 0); scene.add(shLabel);
    const doseBar = levelBar(0.2, 3.6);

    /* ---------- 10. astronaut: white suit, gold visor, backpack, waving arm ---------- */
    const astro = new T.Group();
    const suit = white;
    const body = new T.Mesh(new T.CapsuleGeometry(0.24, 0.42, 6, 14), suit); body.position.y = 0.86;
    const head = new T.Mesh(new T.SphereGeometry(0.22, 20, 16), suit); head.position.y = 1.38;
    const visor = new T.Mesh(new T.SphereGeometry(0.16, 20, 16, Math.PI / 2 - Math.PI / 2.4, Math.PI / 1.2, Math.PI / 3.2, Math.PI / 2.6),
      new T.MeshStandardMaterial({ color: 0xffb63f, metalness: 0.9, roughness: 0.15, emissive: 0x6a3a00, emissiveIntensity: 0.3 }));
    visor.position.set(0, 1.38, 0.08); visor.scale.setScalar(1.25);
    const pack = new T.Mesh(new T.BoxGeometry(0.38, 0.46, 0.2), new T.MeshStandardMaterial({ color: 0xd6d0c8 }));
    pack.position.set(0, 0.95, -0.27);
    const legL = new T.Mesh(new T.CapsuleGeometry(0.09, 0.32, 4, 8), suit); legL.position.set(-0.11, 0.3, 0);
    const legR = legL.clone(); legR.position.x = 0.11;
    const armL = new T.Mesh(new T.CapsuleGeometry(0.075, 0.34, 4, 8), suit); armL.position.set(-0.33, 0.9, 0); armL.rotation.z = 0.25;
    const armPivot = new T.Group(); armPivot.position.set(0.3, 1.08, 0);       // shoulder joint for waving
    const armR = new T.Mesh(new T.CapsuleGeometry(0.075, 0.34, 4, 8), suit); armR.position.y = 0.22;
    armPivot.add(armR);
    const badge = new T.Mesh(new T.BoxGeometry(0.12, 0.08, 0.02), new T.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff8a3d, emissiveIntensity: 0.4 }));
    badge.position.set(0.1, 1.0, 0.24);
    astro.add(body, head, visor, pack, legL, legR, armL, armPivot, badge);
    astro.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const astroOut = new T.Vector3(0.3, 0, 3.0), astroDoor = new T.Vector3(-0.15, 0, 1.0);
    astro.position.copy(astroOut);
    astro.rotation.y = 0.35;
    scene.add(astro);

    /* ---------- 11. particles: storm protons + floating dust ---------- */
    const N = 700;
    const pPos = new Float32Array(N * 3);
    const resetP = (i, top) => {                                               // a proton starts high, toward the Sun side
      pPos[i * 3] = (rand() - 0.5) * 22 + sunDir.x * 6;
      pPos[i * 3 + 1] = top ? 14 + rand() * 4 : rand() * 18;
      pPos[i * 3 + 2] = (rand() - 0.5) * 22 + sunDir.z * 6;
    };
    for (let i = 0; i < N; i++) resetP(i, false);
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute("position", new T.BufferAttribute(pPos, 3));
    const pMat = new T.PointsMaterial({ map: glowTex("rgba(255,120,90,1)", "rgba(255,40,40,0)"), size: 0.35, transparent: true,
      depthWrite: false, blending: T.AdditiveBlending, opacity: 0.9 });
    const protons = new T.Points(pGeo, pMat);
    protons.visible = false;
    scene.add(protons);

    const DN = 260, dPos = new Float32Array(DN * 3);
    for (let i = 0; i < DN; i++) { dPos[i * 3] = (rand() - 0.5) * 40; dPos[i * 3 + 1] = rand() * 6; dPos[i * 3 + 2] = (rand() - 0.5) * 40; }
    const dGeo = new T.BufferGeometry();
    dGeo.setAttribute("position", new T.BufferAttribute(dPos, 3));
    const dust = new T.Points(dGeo, new T.PointsMaterial({ map: glowTex("rgba(255,220,180,0.9)", "rgba(255,200,160,0)"),
      size: 0.18, transparent: true, depthWrite: false, opacity: 0.55 }));
    scene.add(dust);

    /* ---------- 12. read the game state and update the view ---------- */
    const view = { storm: 0, shield: 0, fail: null };
    function update() {
      const S = C.state;
      if (!S) return;
      const R = C.RULES, a = S.alloc;
      winMat.emissiveIntensity = 0.15 + 0.35 * a.ls;                           // brighter windows = more power to Life Support
      setBar(lsBar, Math.min(S.o2 / R.o2Max, S.water / 100));
      const used = C.used();
      panels.forEach((m, i) => { m.emissiveIntensity = i < used ? 0.9 : 0; });  // glowing panels = power in use
      setBar(enBar, used / R.power);
      const foodFrac = Math.max(0, S.food) / R.foodMax;
      const show = Math.ceil(foodFrac * plants.length);
      plants.forEach((p, i) => { p.visible = i < show; });                    // more food = more plants
      glassMat.emissiveIntensity = 0.05 + 0.12 * a.gh;
      setBar(ghBar, foodFrac);
      shieldMat.opacity = 0.03 + 0.06 * a.sh;                                  // thicker dome = higher shield level
      gridMat.opacity = 0.045 * a.sh;
      setBar(doseBar, 1 - S.dose / R.doseLimit);
      view.storm = C.solData(S.sol).seps.length;                               // real SEP records for this date
      view.shield = a.sh;
      view.fail = S.fail;
      protons.visible = view.storm > 0;
      pMat.size = 0.25 + 0.04 * Math.min(6, view.storm);                       // more records = stronger storm
      scene.background = view.storm ? skyStorm : skyCalm;                      // storm turns the sky red
      scene.fog.color.copy(view.storm ? fogStorm : fogCalm);
      sun.intensity = view.storm ? 0.8 : 1.5;
      sunDisc.material.opacity = view.storm ? 0.45 : 1;                        // the Sun looks hazy in a storm
      sky.color.set(view.storm ? 0xff8a7a : 0xf3b98a);
      astro.position.copy(view.storm ? astroDoor : astroOut);                  // crew goes near the door in a storm
      alarm.intensity = S.fail ? 2 : 0;
    }
    C.subscribe(() => { if (running) update(); });                             // listen only; never call actions

    /* ---------- 13. size and animation loop ---------- */
    function resize() {
      const w = canvasBox.clientWidth, h = canvasBox.clientHeight;
      if (!w || !h) return;
      const cur = renderer.getSize(new T.Vector2());
      if (cur.x === w && cur.y === h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);

    let t = 0;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      if (document.hidden || box.offsetParent === null || canvasBox.classList.contains("hidden")) return; // not visible → skip
      try {
        resize();
        t += 1 / 60;
        if (!reduceMotion) camAngle += 0.0012;                                 // slow orbit around the base
        camera.position.set(Math.sin(camAngle) * 13.5, 5.2, Math.cos(camAngle) * 13.5);
        camera.lookAt(0, 1.1, 0);
        if (!reduceMotion) {
          armPivot.rotation.z = view.storm ? -0.2 : -2.4 + Math.sin(t * 4) * 0.45;  // wave on calm days
          astro.position.y = Math.abs(Math.sin(t * 2)) * 0.04;                 // small hop (low gravity)
          for (let i = 0; i < DN; i++) {                                       // dust drifts with the wind
            dPos[i * 3] += 0.01 + (view.storm ? 0.03 : 0);
            if (dPos[i * 3] > 20) dPos[i * 3] = -20;
          }
          dGeo.attributes.position.needsUpdate = true;
        }
        if (protons.visible && !reduceMotion) {                                // protons stream down; the shield stops some
          for (let i = 0; i < N; i++) {
            pPos[i * 3] -= sunDir.x * 0.08; pPos[i * 3 + 1] -= 0.16; pPos[i * 3 + 2] -= sunDir.z * 0.08;
            const x = pPos[i * 3], y = pPos[i * 3 + 1], z = pPos[i * 3 + 2];
            const r = Math.hypot(x, y, z);
            const blocked = view.shield && (i % 10) < view.shield * 3 && r < 6.4 && r > 6.0; // blocked share ≈ shield level
            if (blocked || y < heightAt(x, z)) resetP(i, true);
          }
          pGeo.attributes.position.needsUpdate = true;
        }
        if (view.storm) shieldMat.emissiveIntensity = 0.25 + 0.2 * Math.sin(t * 4); // dome pulses in a storm
        if (view.fail) alarm.intensity = 1.5 + Math.sin(t * 6);               // flashing alarm
        renderer.render(scene, camera);
      } catch (e) { giveUp(); }                                                 // render error → 2D only
    }
    update();
    frame();

    /* ---------- 14. a button to hide the 3D view (slow devices) ---------- */
    const btn = box.querySelector(".scene3d-toggle");
    btn.addEventListener("click", () => {
      const off = canvasBox.classList.toggle("hidden");
      btn.textContent = off ? "Show 3D" : "Hide 3D";
    });
    box.classList.remove("hidden");                                            // all good → show the panel
  }
})();
