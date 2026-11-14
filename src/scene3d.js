/*
 * Base3D: an optional 3D diorama of the Mars base (storybook toon style). VISUAL ONLY:
 * it reads MissionCore state and never changes the rules. It sits inside the same scene panel
 * as the 2D picture, with a "2D / 3D" toggle.
 *
 * - three.js r149, stored locally (vendor/three.min.js). No CDN, no build step, works from file://.
 * - Terrain: real NASA MOLA heights of Gale crater (data/gale_heightmap.js), heights x3.
 * - Falls back to the 2D picture if WebGL fails, the GPU is lost, or it runs under 25 frames per second.
 * - Respects prefers-reduced-motion (no walking, slow particles, no rover drive animation).
 */
(function () {
  "use strict";
  const C = window.MissionCore, T = window.THREE, DEM = window.GALE_DEM;
  const panel = document.getElementById("scene");
  if (!panel || !C) return;

  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const INK = 0x2b1d16;
  let three = null;                 // everything 3D lives here once started
  let mode = "2d";
  const tr = (k, v) => (window.I18N ? window.I18N.t(k, v) : k);   // all text from locales/*.json

  /* ------------------------------------------------------------ panel controls (always present) */
  const toggle = document.createElement("button");
  toggle.type = "button"; toggle.className = "chip view-toggle"; toggle.id = "btnView3d";
  panel.appendChild(toggle);
  const note = document.createElement("div");
  note.className = "view-note hidden"; note.setAttribute("role", "status");
  panel.appendChild(note);
  const box = document.createElement("div");
  box.className = "view3d hidden"; box.id = "view3d";
  box.innerHTML =
    '<div class="v3-canvas"></div>' +
    '<button type="button" class="chip v3-reset"></button>' +
    '<div class="v3-storm hidden" aria-live="polite"><b class="v3-storm-title"></b><span class="v3-dots" aria-hidden="true"></span><span class="v3-count"></span></div>' +
    '<div class="v3-hint hidden" aria-live="polite"></div>' +
    '<div class="v3-earth"></div>' +
    '<div class="v3-credit"></div>';
  panel.appendChild(box);

  function webglOK() {
    try { const c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); }
    catch (e) { return false; }
  }
  function pref(v) { try { if (v) localStorage.setItem("msr-view", v); return localStorage.getItem("msr-view"); } catch (e) { return null; } }

  function showNote(key, vars) { note.textContent = tr(key, vars); note.classList.remove("hidden"); setTimeout(() => note.classList.add("hidden"), 6000); }
  function setMode(m, why, whyVars) {
    if (m === "3d" && (!T || !DEM || !webglOK())) { m = "2d"; why = why || "v3.na"; }
    if (m === "3d" && !three) { try { start(); } catch (e) { stop(); m = "2d"; why = "v3.fail"; } }
    mode = m;
    panel.classList.toggle("is3d", m === "3d");
    box.classList.toggle("hidden", m !== "3d");
    toggle.textContent = tr(m === "3d" ? "v3.show2d" : "v3.show3d");
    toggle.setAttribute("aria-label", tr(m === "3d" ? "v3.aria2d" : "v3.aria3d"));
    box.querySelector(".v3-reset").textContent = tr("v3.reset");
    if (why) showNote(why, whyVars);
    if (m === "3d") { sync(); three.fps.reset(); }
  }
  toggle.addEventListener("click", () => { const m = mode === "3d" ? "2d" : "3d"; pref(m); setMode(m); });
  box.querySelector(".v3-reset").addEventListener("click", () => three && three.cam.reset());

  /* ------------------------------------------------------------ build the 3D world */
  function start() {
    const canvasBox = box.querySelector(".v3-canvas");
    const renderer = new T.WebGLRenderer({ antialias: true });                     // throws without WebGL
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputEncoding = T.sRGBEncoding;
    canvasBox.appendChild(renderer.domElement);
    renderer.domElement.addEventListener("webglcontextlost", (e) => { e.preventDefault(); fallback("v3.lost"); });

    const scene = new T.Scene();
    const camera = new T.PerspectiveCamera(50, 16 / 9, 0.1, 200);

    // toon shading: 3 flat light steps, like a comic
    const grad = new T.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, T.RedFormat);
    grad.minFilter = grad.magFilter = T.NearestFilter; grad.generateMipmaps = false; grad.needsUpdate = true;
    const toon = (color, extra) => new T.MeshToonMaterial(Object.assign({ color, gradientMap: grad }, extra || {}));
    const outlineMat = new T.MeshBasicMaterial({ color: INK, side: T.BackSide });
    function outline(mesh, s = 1.12) {                                           // thick black comic outline
      const o = new T.Mesh(mesh.geometry, outlineMat);
      o.scale.setScalar(s); o.userData.outline = true;
      mesh.add(o); return mesh;
    }

    // sky (calm / storm)
    const skyCalm = new T.Color("#ffc9a0"), skyStorm = new T.Color("#7a2230");
    scene.background = skyCalm.clone();
    scene.fog = new T.Fog(skyCalm.clone(), 30, 60);
    const sunDir = new T.Vector3(-0.62, 0.25, -0.74).normalize();
    const earthDir = new T.Vector3(-0.25, 0.2, -0.95).normalize();   // Earth stays near the Sun in Mars' sky
    scene.add(new T.HemisphereLight(0xfff0e0, 0x8a4a30, 0.35));
    const sunLight = new T.DirectionalLight(0xffffff, 1.0); sunLight.position.copy(sunDir).multiplyScalar(30); scene.add(sunLight);

    function glowSprite(inner, outer, size, pos) {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const g = c.getContext("2d"), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      gr.addColorStop(0, inner); gr.addColorStop(0.45, inner); gr.addColorStop(1, outer);
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const tex = new T.CanvasTexture(c); tex.encoding = T.sRGBEncoding;
      const s = new T.Sprite(new T.SpriteMaterial({ map: tex, fog: false, depthWrite: false, depthTest: false, transparent: true }));
      s.renderOrder = 10;
      s.scale.set(size, size, 1); s.position.copy(pos); scene.add(s); return s;
    }
    const sun = glowSprite("rgba(255,248,220,1)", "rgba(255,190,120,0)", 10, sunDir.clone().multiplyScalar(55));
    const earth = glowSprite("rgba(90,170,255,1)", "rgba(90,170,255,0)", 2.4, earthDir.clone().multiplyScalar(40));

    /* ---------- terrain: real NASA MOLA heights of Gale crater ---------- */
    const S = DEM.size, W = 60, EXAG = 3, KM = 4 * 59.27;                         // 4 degrees ~ 237 km wide
    const unitsPerKm = W / KM, hLand = DEM.landing_site.height_m;
    const lx = (DEM.landing_site.col / (S - 1) - 0.5) * W, lz = (DEM.landing_site.row / (S - 1) - 0.5) * W;
    const hRaw = (r, c) => DEM.heights[Math.max(0, Math.min(S - 1, r)) * S + Math.max(0, Math.min(S - 1, c))];
    function demY(x, z) {                                                        // bilinear height in scene units (base at origin)
      const c = ((x + lx) / W + 0.5) * (S - 1), r = ((z + lz) / W + 0.5) * (S - 1);
      const c0 = Math.floor(c), r0 = Math.floor(r), fc = c - c0, fr = r - r0;
      const h = hRaw(r0, c0) * (1 - fc) * (1 - fr) + hRaw(r0, c0 + 1) * fc * (1 - fr) + hRaw(r0 + 1, c0) * (1 - fc) * fr + hRaw(r0 + 1, c0 + 1) * fc * fr;
      return ((h - hLand) / 1000) * unitsPerKm * EXAG;
    }
    function groundY(x, z) {                                                     // with a flat pad for the base
      const d = Math.hypot(x, z), t = Math.min(1, Math.max(0, (d - 10) / 8));     // flat pad, then real heights from 18 units out
      return demY(x, z) * t * t * (3 - 2 * t);
    }
    const tg = new T.PlaneGeometry(W, W, S - 1, S - 1); tg.rotateX(-Math.PI / 2);
    const tp = tg.attributes.position, cols = new Float32Array(tp.count * 3);
    const cLow = new T.Color("#b9552f"), cMid = new T.Color("#9c4527"), cHigh = new T.Color("#e08e57"), tmp = new T.Color();
    for (let i = 0; i < tp.count; i++) {
      const x = tp.getX(i) - lx, z = tp.getZ(i) - lz;
      tp.setX(i, x); tp.setZ(i, z);
      const y = groundY(x, z); tp.setY(i, y);
      const t = Math.min(1, Math.max(0, (y + 0.3) / 4));
      tmp.copy(cLow).lerp(cMid, Math.min(1, t * 2)).lerp(cHigh, Math.max(0, t * 2 - 1));
      cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
    }
    tg.setAttribute("color", new T.BufferAttribute(cols, 3)); tg.computeVertexNormals();
    scene.add(new T.Mesh(tg, toon(0xffffff, { vertexColors: true })));

    const pick = [];                                                             // clickable objects
    const add = (mesh, sys, s) => { outline(mesh, s); if (sys) { mesh.userData.sys = sys; pick.push(mesh); } scene.add(mesh); return mesh; };

    /* ---------- the base ---------- */
    // Life Support habitat (blue stripe, windows glow with Life Support power)
    const hab = new T.Group(); hab.position.set(0, 0, 0); scene.add(hab);
    const habBody = add(new T.Mesh(new T.CylinderGeometry(1.25, 1.35, 0.8, 24), toon(0xf4ede4)), "ls", 1.05); habBody.position.y = 0.4; hab.add(habBody);
    const habDome = add(new T.Mesh(new T.SphereGeometry(1.25, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), toon(0xf4ede4)), "ls", 1.05); habDome.position.y = 0.8; hab.add(habDome);
    const stripe = new T.Mesh(new T.CylinderGeometry(1.27, 1.27, 0.14, 24, 1, true), toon(0x4cb8f0)); stripe.position.y = 0.72; hab.add(stripe);
    const winMat = new T.MeshBasicMaterial({ color: 0xffe46b });
    for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.3, w = new T.Mesh(new T.BoxGeometry(0.26, 0.2, 0.05), winMat); w.position.set(Math.cos(a) * 1.3, 0.42, Math.sin(a) * 1.3); w.lookAt(0, 0.42, 0); hab.add(w); }
    const door = new T.Vector3(1.45, 0, 0.2);
    // antenna: turns toward Earth when a message arrives
    const antenna = new T.Group(); antenna.position.set(0, 2.0, 0); scene.add(antenna);
    const mast = add(new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.9, 8), toon(0xcccccc)), null, 1.3); mast.position.y = -0.3; antenna.add(mast);
    const dish = add(new T.Mesh(new T.ConeGeometry(0.42, 0.22, 16, 1, true), toon(0xffffff, { side: T.DoubleSide })), null, 1.08);
    dish.rotation.x = Math.PI / 2; dish.position.y = 0.15; antenna.add(dish);
    const earthYaw = Math.atan2(earthDir.x, earthDir.z), restYaw = earthYaw + 2.2;
    let antennaYaw = restYaw;
    // Greenhouse: glass dome, plants grow or wilt with the food store
    const gh = new T.Group(); gh.position.set(-2.9, 0, 1.0); scene.add(gh);
    const glass = new T.Mesh(new T.SphereGeometry(1.1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshToonMaterial({ color: 0xcff7dc, gradientMap: grad, transparent: true, opacity: 0.35, depthWrite: false }));
    glass.userData.sys = "gh"; pick.push(glass); gh.add(glass);
    const ring = add(new T.Mesh(new T.CylinderGeometry(1.12, 1.18, 0.16, 20), toon(0x5cc96b)), "gh", 1.06); ring.position.y = 0.08; gh.add(ring);
    const plantMat = toon(0x3fae55), plants = [];
    for (let i = 0; i < 9; i++) {
      const p = add(new T.Mesh(new T.ConeGeometry(0.13, 0.55, 7), plantMat), "gh", 1.15);
      p.position.set(((i % 3) - 1) * 0.42, 0.3, (Math.floor(i / 3) - 1) * 0.42); p.geometry.translate(0, 0, 0); gh.add(p); plants.push(p);
    }
    const green = new T.Color(0x3fae55), brown = new T.Color(0x8a5a2b);
    // Solar panels: cells glow with the energy points in use (science included)
    const panels = [];
    for (let i = 0; i < 5; i++) {
      const g = new T.Group(); g.position.set(-1.9 + i * 0.95, 0, -2.9); scene.add(g);
      const leg = add(new T.Mesh(new T.CylinderGeometry(0.04, 0.04, 0.6, 6), toon(0xffc53d)), "energy", 1.4); leg.position.y = 0.3; g.add(leg);
      const cellMat = new T.MeshToonMaterial({ color: 0x22336a, gradientMap: grad, emissive: 0x000000 });
      const cell = add(new T.Mesh(new T.BoxGeometry(0.8, 0.05, 0.6), cellMat), "energy", 1.08); cell.position.y = 0.62; cell.rotation.x = 0.5; g.add(cell);
      panels.push(cellMat);
    }
    // Shield dome over the whole base: opacity and glow by shield level
    const R = 5.0;
    const shieldMat = new T.MeshToonMaterial({ color: 0xc69bff, gradientMap: grad, transparent: true, opacity: 0, depthWrite: false, side: T.DoubleSide, emissive: 0x6a3fd0, emissiveIntensity: 0 });
    const shield = new T.Mesh(new T.SphereGeometry(R, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat);
    shield.userData.sys = "sh"; shield.userData.isDome = true; pick.push(shield); scene.add(shield);
    const gridMat = new T.MeshBasicMaterial({ color: 0xe6d4ff, wireframe: true, transparent: true, opacity: 0, depthWrite: false });
    scene.add(new T.Mesh(new T.SphereGeometry(R * 1.002, 18, 7, 0, Math.PI * 2, 0, Math.PI / 2), gridMat));

    // 4 astronauts (crew colours), walk on calm days, go to the shelter on storm days
    const crewCols = [0x4cb8f0, 0xffc53d, 0x5cc96b, 0x9b74e0], crew = [];
    for (let i = 0; i < 4; i++) {
      const g = new T.Group(); scene.add(g);
      const body = add(new T.Mesh(new T.CapsuleGeometry(0.12, 0.26, 4, 8), toon(0xffffff)), null, 1.12); body.position.y = 0.26; g.add(body);
      const head = add(new T.Mesh(new T.SphereGeometry(0.13, 12, 8), toon(crewCols[i])), null, 1.12); head.position.y = 0.58; g.add(head);
      crew.push({ g, phase: i * Math.PI / 2, r: 2.4 + (i % 2) * 0.7, inside: false });
    }
    // Rover + science rock
    const rover = new T.Group(); scene.add(rover);
    const roverBody = add(new T.Mesh(new T.BoxGeometry(0.7, 0.25, 0.45), toon(0xf4ede4)), "science", 1.08); roverBody.position.y = 0.3; rover.add(roverBody);
    for (let i = 0; i < 6; i++) { const w = add(new T.Mesh(new T.CylinderGeometry(0.1, 0.1, 0.08, 10), toon(0x3a2a20)), null, 1.15); w.rotation.x = Math.PI / 2; w.position.set(-0.25 + (i % 3) * 0.25, 0.1, i < 3 ? 0.27 : -0.27); rover.add(w); }
    const roverMast = add(new T.Mesh(new T.BoxGeometry(0.06, 0.35, 0.06), toon(0xcccccc)), null, 1.2); roverMast.position.set(0.22, 0.55, 0); rover.add(roverMast);
    const garage = new T.Vector3(3.4, 0, -5.6), rockPos = new T.Vector3(6.0, 0, 0.8);  // both in the default view, outside the dome
    garage.y = groundY(garage.x, garage.z); rockPos.y = groundY(rockPos.x, rockPos.z);
    rover.position.copy(garage);
    const rockMat = toon(0x8a4b2d, { emissive: 0x000000 });
    const rock = add(new T.Mesh(new T.DodecahedronGeometry(0.42, 0), rockMat), "rock", 1.1); rock.position.copy(rockPos).add(new T.Vector3(0, 0.25, 0));
    let roverT = 0, sampleTaken = false;

    /* ---------- storm particles: the share that bounces off the dome = the real game rule ---------- */
    const N = reduceMotion ? 160 : 360;
    const pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), col = new Float32Array(N * 3), st = new Uint8Array(N);
    const RED = [1, 0.25, 0.2], YELLOW = [1, 0.9, 0.3];
    const perp1 = new T.Vector3().crossVectors(sunDir, new T.Vector3(0, 1, 0)).normalize(), perp2 = new T.Vector3().crossVectors(sunDir, perp1).normalize();
    const speed = reduceMotion ? 0.07 : 0.16;
    const v3 = new T.Vector3(), n3 = new T.Vector3();
    function spawn(i, spread) {
      const a = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 7;
      v3.copy(sunDir).multiplyScalar(26 + (spread ? Math.random() * 22 : 0)).addScaledVector(perp1, Math.cos(a) * rr).addScaledVector(perp2, Math.sin(a) * rr);
      pos[i * 3] = v3.x; pos[i * 3 + 1] = v3.y; pos[i * 3 + 2] = v3.z;
      n3.set((Math.random() - 0.5) * 3, 0.6, (Math.random() - 0.5) * 3).sub(v3).normalize().multiplyScalar(speed);
      vel[i * 3] = n3.x; vel[i * 3 + 1] = n3.y; vel[i * 3 + 2] = n3.z;
      col[i * 3] = RED[0]; col[i * 3 + 1] = RED[1]; col[i * 3 + 2] = RED[2]; st[i] = 0;
    }
    for (let i = 0; i < N; i++) spawn(i, true);
    const pg = new T.BufferGeometry();
    pg.setAttribute("position", new T.BufferAttribute(pos, 3)); pg.setAttribute("color", new T.BufferAttribute(col, 3));
    const dot = document.createElement("canvas"); dot.width = dot.height = 32;
    { const g = dot.getContext("2d"), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.9)"); gr.addColorStop(1, "rgba(255,255,255,0)"); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
    const particles = new T.Points(pg, new T.PointsMaterial({ size: 0.7, map: new T.CanvasTexture(dot), vertexColors: true, transparent: true, depthWrite: false, fog: false }));
    particles.visible = false; scene.add(particles);
    let blocked = 0, gotIn = 0;

    /* ---------- camera: drag to turn, wheel / pinch to zoom, limited so kids can't get lost ---------- */
    const cam = { theta: 0.65, phi: 1.3, radius: 12, target: new T.Vector3(0, 0.8, 0),
      reset() { this.theta = 0.65; this.phi = 1.3; this.radius = 12; },
      apply() {
        this.phi = Math.min(1.38, Math.max(0.5, this.phi)); this.radius = Math.min(30, Math.max(7, this.radius));
        camera.position.set(Math.sin(this.theta) * Math.sin(this.phi), Math.cos(this.phi), Math.cos(this.theta) * Math.sin(this.phi)).multiplyScalar(this.radius).add(this.target);
        camera.lookAt(this.target);
      } };
    const el = renderer.domElement; el.style.touchAction = "none";
    const ptrs = new Map(); let pinch0 = 0, moved = 0;
    el.addEventListener("pointerdown", (e) => { ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { el.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: fine */ } moved = 0;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
    el.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p) { hover(e); return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy);
      if (ptrs.size === 1) { cam.theta -= dx * 0.008; cam.phi -= dy * 0.006; }
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0) cam.radius *= pinch0 / d; pinch0 = d; }
    });
    const end = (e) => { if (ptrs.has(e.pointerId) && ptrs.size === 1 && moved < 8) click(e); ptrs.delete(e.pointerId); if (ptrs.size < 2) pinch0 = 0; };
    el.addEventListener("pointerup", end); el.addEventListener("pointercancel", (e) => ptrs.delete(e.pointerId));
    el.addEventListener("wheel", (e) => { e.preventDefault(); cam.radius *= 1 + Math.sign(e.deltaY) * 0.08; }, { passive: false });

    /* ---------- click an object -> highlight its card ---------- */
    const ray = new T.Raycaster(), mouse = new T.Vector2();
    function hit(e) {
      const r = el.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hits = ray.intersectObjects(pick, false).filter((h) => h.object.visible);
      const solid = hits.find((h) => !h.object.userData.isDome);                // things inside the dome win over the dome
      return (solid || hits[0] || {}).object || null;
    }
    function hover(e) { const o = hit(e); el.style.cursor = o ? "pointer" : "grab"; }
    function click(e) {
      const o = hit(e); if (!o) return;
      if (o.userData.sys === "rock") {
        if (rockReady()) { sampleTaken = true; hint("v3.sample"); }
        else hint("v3.rockInfo");
        document.dispatchEvent(new CustomEvent("base3d:pick", { detail: { sys: "science" } }));
        return;
      }
      document.dispatchEvent(new CustomEvent("base3d:pick", { detail: { sys: o.userData.sys } }));
    }
    const hintEl = box.querySelector(".v3-hint");
    let hintKey = "";
    function hint(k) { hintKey = k; hintEl.textContent = k ? tr(k) : ""; hintEl.classList.toggle("hidden", !k); }

    /* ---------- read the game state ---------- */
    const view = { storm: false, sh: 0, sci: 0, sol: 0, msg: false, cut: 0 };
    function rockReady() { return view.sci && !view.storm && roverT >= 1 && !sampleTaken; }
    function syncWorld() {
      const s = C.state; if (!s) return;
      const sd = C.solData(s.sol), storm = sd.seps.length > 0, R_ = C.RULES;
      if (s.sol !== view.sol) { view.sol = s.sol; sampleTaken = false; roverT = 0; blocked = 0; gotIn = 0; rock.visible = true; hint(""); }
      if (s.alloc.sh !== view.sh) { blocked = 0; gotIn = 0; }                    // new shield level -> count again from zero
      view.storm = storm; view.sh = s.alloc.sh; view.sci = s.alloc.sci || 0; view.cut = R_.shieldCut[s.alloc.sh];
      view.msg = C.earthWarnings(s.sol).length > 0 || !!C.adviceArriving(s.sol);
      const used = C.used();
      panels.forEach((m, i) => { m.emissive.setHex(i < used ? 0x1f6fff : 0x000000); m.color.setHex(i < used ? 0x7fd8ff : 0x1a2a5a); });
      winMat.color.setHex(s.alloc.ls >= 2 ? 0xffe46b : s.alloc.ls === 1 ? 0xb8a860 : 0x55606a);
      const food = Math.max(0, Math.min(1, s.food / R_.foodMax));
      plants.forEach((p, i) => { p.visible = i < Math.max(1, Math.ceil(food * plants.length)); p.scale.setScalar(0.55 + 0.6 * food); p.rotation.z = food < 0.3 ? 0.5 : 0; });
      plantMat.color.copy(brown).lerp(green, Math.min(1, food * 2));
      shieldMat.opacity = s.alloc.sh ? 0.1 + 0.11 * s.alloc.sh : 0;
      shieldMat.emissiveIntensity = s.alloc.sh ? 0.3 + 0.2 * s.alloc.sh : 0;
      gridMat.opacity = 0.06 * s.alloc.sh;
      particles.visible = storm;
      scene.background.copy(storm ? skyStorm : skyCalm); scene.fog.color.copy(storm ? skyStorm : skyCalm);
      sunLight.intensity = storm ? 0.6 : 0.9;
      box.querySelector(".v3-earth").textContent = tr("v3.earth", { min: Math.round(C.storm.light_delay.minutes || 0) });
      if (hintKey) hintEl.textContent = tr(hintKey);
      box.querySelector(".v3-credit").textContent = tr("v3.credit");
      const sb = box.querySelector(".v3-storm"); sb.classList.toggle("hidden", !storm); panel.classList.toggle("storm-on", storm);
      if (storm) {
        const k = Math.round(view.cut * 10);
        sb.querySelector(".v3-storm-title").textContent = s.alloc.sh ? tr("v3.shieldN", { sh: s.alloc.sh, k }) : tr("v3.noShield");
        sb.querySelector(".v3-dots").textContent = "🟡".repeat(k) + "🔴".repeat(10 - k);
      }
      if (!storm && view.sci && !sampleTaken && roverT < 1) hint("v3.driving");
      if (!view.sci && hintKey === "v3.driving") hint("");
      if (storm) hint("v3.shelter");
      else if (hintKey === "v3.shelter") hint("");
    }

    /* ---------- animation loop with a frame-rate check ---------- */
    const fps = { t0: 0, frames: 0, warm: true, reset() { this.t0 = 0; this.frames = 0; this.warm = true; } };
    let last = performance.now(), running = true, t = 0;
    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (mode !== "3d" || document.hidden || panel.offsetParent === null) { last = now; return; }
      const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
      // resize
      const w = canvasBox.clientWidth, h = canvasBox.clientHeight;
      if (w && h && (el.width !== Math.floor(w * renderer.getPixelRatio()) || el.height !== Math.floor(h * renderer.getPixelRatio()))) {
        renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      }
      // fps check: skip 1 s warm-up, then measure 3 s; under 25 fps -> 2D
      if (!fps.t0) fps.t0 = now;
      fps.frames++;
      if (fps.warm && now - fps.t0 > 1000) { fps.warm = false; fps.t0 = now; fps.frames = 0; }
      else if (!fps.warm && now - fps.t0 > 3000 && fps.frames >= 0) {
        const rate = fps.frames / ((now - fps.t0) / 1000);
        three.lastFps = Math.round(rate);
        if (rate < 25) { fallback("v3.slow", { fps: Math.round(rate) }); return; }
        fps.t0 = now; fps.frames = 0;
      }
      cam.apply();
      // antenna turns toward Earth when a message arrives
      const targetYaw = view.msg ? earthYaw : restYaw + (reduceMotion ? 0 : Math.sin(t * 0.3) * 0.4);
      antennaYaw += (targetYaw - antennaYaw) * Math.min(1, dt * 2.5);
      antenna.rotation.y = antennaYaw; dish.rotation.z = view.msg ? -0.5 : 0;
      // crew walk or shelter
      crew.forEach((c, i) => {
        if (view.storm) {
          const p = c.g.position; v3.copy(door).sub(p); const d = v3.length();
          if (d < 0.15 || reduceMotion) c.g.visible = false; else { c.g.visible = true; p.addScaledVector(v3.normalize(), Math.min(d, dt * 2.2)); }
        } else {
          c.g.visible = true;
          const a = c.phase + (reduceMotion ? 0 : t * (0.25 + i * 0.04));
          const x = Math.cos(a) * c.r, z = Math.sin(a) * c.r;
          if (!c.wasOut) { c.g.position.copy(door); c.wasOut = true; }
          c.g.position.lerp(v3.set(x, 0, z), Math.min(1, dt * 1.5));
          c.g.rotation.y = -a;
        }
        if (view.storm) c.wasOut = false;
        c.g.position.y = reduceMotion ? 0 : Math.abs(Math.sin(t * 6 + i)) * 0.05;
      });
      // rover drives to the rock when the science mission is on (calm sols)
      const wantRock = view.sci && !view.storm;
      roverT = reduceMotion ? (wantRock ? 1 : 0) : Math.max(0, Math.min(1, roverT + (wantRock ? dt / 3 : -dt / 2)));
      rover.position.lerpVectors(garage, rockPos, roverT); rover.position.y = groundY(rover.position.x, rover.position.z);
      rover.lookAt(rockPos.x, rover.position.y, rockPos.z); rover.rotation.y -= Math.PI / 2;
      if (rockReady() && hintKey !== "v3.click" && hintKey !== "v3.sample") hint("v3.click");
      rock.visible = !sampleTaken;
      rockMat.emissive.setHex(rockReady() ? (Math.sin(t * 6) > 0 ? 0xffc53d : 0x804000) : 0x000000);
      // storm particles
      if (view.storm) {
        for (let i = 0; i < N; i++) {
          const j = i * 3;
          pos[j] += vel[j] * dt * 60; pos[j + 1] += vel[j + 1] * dt * 60; pos[j + 2] += vel[j + 2] * dt * 60;
          const d = Math.hypot(pos[j], pos[j + 1], pos[j + 2]);
          if (st[i] === 0 && d < R && pos[j + 1] > 0) {
            if ((i % 10) < Math.round(view.cut * 10)) {                         // exactly 4 / 7 / 9 of every 10 bounce off
              n3.set(pos[j], pos[j + 1], pos[j + 2]).normalize();
              const dotv = vel[j] * n3.x + vel[j + 1] * n3.y + vel[j + 2] * n3.z;
              vel[j] -= 2 * dotv * n3.x; vel[j + 1] -= 2 * dotv * n3.y; vel[j + 2] -= 2 * dotv * n3.z;
              col[j] = YELLOW[0]; col[j + 1] = YELLOW[1]; col[j + 2] = YELLOW[2]; st[i] = 1; blocked++;
            } else { st[i] = 2; gotIn++; }
          }
          // bounced pieces and pieces that got in both make a short trip (about 3.8 units) before starting again,
          // so the counters show the real rule: 4 / 7 / 9 of every 10 bounce off
          if (d > 48 || pos[j + 1] < -1 || (st[i] === 2 && d < 1.2) || (st[i] === 1 && d > R + 3.8)) spawn(i, false);
        }
        pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
        box.querySelector(".v3-count").textContent = tr("v3.count", { b: blocked, g: gotIn });
        if (view.sh && !reduceMotion) shieldMat.emissiveIntensity = 0.3 + 0.2 * view.sh + 0.15 * Math.sin(t * 5);
      }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);

    function rockScreen() {                                                     // read-only helper for automated tests
      const p = rock.position.clone().project(camera), r = el.getBoundingClientRect();
      return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height, ready: rockReady(), taken: sampleTaken };
    }
    three = { renderer, cam, fps, sync: syncWorld, rockScreen, stop() { running = false; renderer.dispose(); renderer.domElement.remove(); }, lastFps: null };
  }

  function stop() { if (three) { try { three.stop(); } catch (e) { /* ignore */ } } three = null; }
  function fallback(why, vars) { stop(); setMode("2d", why, vars); }
  function sync() { if (three && mode === "3d") three.sync(); }

  C.subscribe(() => sync());
  if (window.I18N) window.I18N.onChange(() => { setMode(mode); sync(); });
  window.Base3D = { setMode: (m) => setMode(m), get mode() { return mode; }, get fps() { return three ? three.lastFps : null }, rockScreen: () => (three ? three.rockScreen() : null) };

  // start in 3D when possible (remember the child's choice), otherwise 2D
  // Phones start in 2D (small screen, saves battery); the 3D button still works. A saved choice wins.
  setMode(pref() === "3d" || (!pref() && innerWidth >= 700) ? "3d" : "2d");
})();
