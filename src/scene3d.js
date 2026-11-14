/*
 * Optional 3D view of the Mars base. VISUAL ONLY.
 * - Reads MissionCore.state and MissionCore.solData(); never changes them.
 * - Uses the local copy vendor/three.min.js (works offline).
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
    const canvasBox = box.querySelector(".scene3d-canvas");   // where the canvas goes
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- 1. renderer, scene, camera, lights ---------- */
    const renderer = new T.WebGLRenderer({ antialias: true });                 // throws if WebGL is missing → caught above
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));         // sharp but not too heavy
    canvasBox.appendChild(renderer.domElement);                                // put the canvas on the page
    renderer.domElement.addEventListener("webglcontextlost", giveUp);         // GPU lost → back to 2D

    const scene = new T.Scene();                                               // the 3D world
    const skyCalm = new T.Color(0x2a1a14), skyStorm = new T.Color(0x4a0f14);   // sky colors: normal / proton storm
    scene.background = skyCalm.clone();
    scene.fog = new T.Fog(0x2a1a14, 14, 30);                                   // distant haze, Mars style

    const camera = new T.PerspectiveCamera(42, 2, 0.1, 100);                   // field of view 42°
    let camAngle = 0.6;                                                        // camera position around the base

    scene.add(new T.HemisphereLight(0xffe2c8, 0x5a2a1a, 0.9));                 // soft sky + ground light
    const sun = new T.DirectionalLight(0xffffff, 0.9);                         // the Sun
    sun.position.set(6, 10, 4);
    scene.add(sun);
    const alarm = new T.PointLight(0xff3030, 0, 18);                           // red alarm light, off until failure
    alarm.position.set(0, 4, 0);
    scene.add(alarm);

    /* ---------- 2. Mars ground and rocks ---------- */
    const ground = new T.Mesh(new T.CircleGeometry(16, 48),
      new T.MeshStandardMaterial({ color: 0xb5502a, roughness: 1 }));          // red Mars soil
    ground.rotation.x = -Math.PI / 2;                                          // lay it flat
    scene.add(ground);
    const rockMat = new T.MeshStandardMaterial({ color: 0x7a3a22, roughness: 1, flatShading: true });
    [[-7, -3, 0.6], [6.5, -5, 0.4], [-5, 6, 0.5], [8, 4, 0.7], [2, -8, 0.35]].forEach(([x, z, s]) => {
      const r = new T.Mesh(new T.DodecahedronGeometry(s), rockMat);           // a few fixed rocks
      r.position.set(x, s * 0.5, z);
      scene.add(r);
    });

    /* ---------- 3. helpers: a level bar next to each module ---------- */
    function levelBar(x, z) {
      const geo = new T.BoxGeometry(0.22, 1, 0.22);
      geo.translate(0, 0.5, 0);                                                // grow upward from the ground
      const mat = new T.MeshStandardMaterial({ color: 0x6fd08c, emissive: 0x112211 });
      const bar = new T.Mesh(geo, mat);
      bar.position.set(x, 0, z);
      scene.add(bar);
      return bar;
    }
    function setBar(bar, frac) {
      const f = Math.max(0.03, Math.min(1, frac));
      bar.scale.y = f * 2.2;                                                   // full = 2.2 units tall
      const c = f < 0.25 ? 0xff5d5d : f < 0.5 ? 0xffc857 : 0x6fd08c;          // red / yellow / green
      bar.material.color.set(c);
      bar.material.emissive.set(c);                                            // glow so it reads through the dome
      bar.material.emissiveIntensity = 0.6;
    }

    /* ---------- 4. the four modules (same colors as the 2D legend) ---------- */
    // Life Support (blue): habitat cylinder with a dome on top.
    const lsMat = new T.MeshStandardMaterial({ color: 0x3fa9f5, emissive: 0x3fa9f5, emissiveIntensity: 0.2 });
    const ls = new T.Group();
    const lsBody = new T.Mesh(new T.CylinderGeometry(1.1, 1.1, 1.2, 28), lsMat);
    lsBody.position.y = 0.6;
    const lsTop = new T.Mesh(new T.SphereGeometry(1.1, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), lsMat);
    lsTop.position.y = 1.2;
    ls.add(lsBody, lsTop);
    ls.position.set(-2.6, 0, 0.6);
    scene.add(ls);
    const lsBar = levelBar(-1.2, 1.7);

    // Energy (yellow): five solar panels; lit panels = power units in use.
    const panels = [];
    for (let i = 0; i < C.RULES.power; i++) {
      const p = new T.Mesh(new T.BoxGeometry(0.8, 0.06, 1.2),
        new T.MeshStandardMaterial({ color: 0x5a4a10, emissive: 0xffc857, emissiveIntensity: 0 }));
      p.position.set(-1.8 + i * 0.95, 0.7, -3.4);
      p.rotation.x = -0.5;                                                     // tilt toward the Sun
      const leg = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 0.7), new T.MeshStandardMaterial({ color: 0x999999 }));
      leg.position.set(p.position.x, 0.35, -3.4);
      scene.add(p, leg);
      panels.push(p);
    }
    const enBar = levelBar(3.2, -3.4);

    // Food (green): glass greenhouse dome with plants inside.
    const gh = new T.Group();
    const glass = new T.Mesh(new T.SphereGeometry(1.2, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.MeshStandardMaterial({ color: 0x9fffc0, transparent: true, opacity: 0.25, emissive: 0x6fd08c, emissiveIntensity: 0.15 }));
    gh.add(glass);
    const plants = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const plant = new T.Mesh(new T.ConeGeometry(0.16, 0.6, 8), new T.MeshStandardMaterial({ color: 0x4fbf6a }));
      plant.position.set(Math.cos(a) * 0.65, 0.3, Math.sin(a) * 0.65);
      gh.add(plant);
      plants.push(plant);
    }
    gh.position.set(2.6, 0, 0.6);
    scene.add(gh);
    const ghBar = levelBar(4.1, 1.7);

    // Radiation Protection (purple): a shield dome over the whole base; thicker = higher shield level.
    const shieldMat = new T.MeshStandardMaterial({ color: 0xb48cff, emissive: 0xb48cff, emissiveIntensity: 0.2,
      transparent: true, opacity: 0.05, side: T.DoubleSide, depthWrite: false });
    const shield = new T.Mesh(new T.SphereGeometry(5.4, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), shieldMat);
    scene.add(shield);
    const doseBar = levelBar(0, 2.8);                                          // remaining dose margin

    /* ---------- 5. storm particles (protons) on SEP sols ---------- */
    const N = 400;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {                                              // random start points above the base
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 12;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
    }
    const pGeo = new T.BufferGeometry();
    pGeo.setAttribute("position", new T.BufferAttribute(pos, 3));
    const pMat = new T.PointsMaterial({ color: 0xff7a7a, size: 0.12, transparent: true, opacity: 0.9 });
    const protons = new T.Points(pGeo, pMat);
    protons.visible = false;
    scene.add(protons);

    /* ---------- 6. read the game state and update the view ---------- */
    const view = { storm: 0, shield: 0, fail: null };
    function update() {
      const S = C.state;
      if (!S) return;
      const R = C.RULES;
      const a = S.alloc;
      lsMat.emissiveIntensity = 0.1 + 0.25 * a.ls;                             // brighter = more power to Life Support
      setBar(lsBar, Math.min(S.o2 / R.o2Max, S.water / 100));                  // oxygen/water level
      const used = C.used();
      panels.forEach((p, i) => { p.material.emissiveIntensity = i < used ? 0.8 : 0; }); // lit panels = power in use
      setBar(enBar, used / R.power);
      const foodFrac = Math.max(0, S.food) / R.foodMax;
      plants.forEach((p, i) => { p.visible = i < Math.ceil(foodFrac * plants.length); }); // more food = more plants
      glass.material.emissiveIntensity = 0.05 + 0.15 * a.gh;
      setBar(ghBar, foodFrac);
      shieldMat.opacity = 0.04 + 0.12 * a.sh;                                  // thicker dome = higher shield level
      setBar(doseBar, 1 - S.dose / R.doseLimit);
      view.storm = C.solData(S.sol).seps.length;                               // real SEP records for this date
      view.shield = a.sh;
      view.fail = S.fail;
      protons.visible = view.storm > 0;
      pMat.opacity = Math.min(1, 0.35 + 0.12 * view.storm);                    // more records = denser storm
      scene.background.copy(view.storm ? skyStorm : skyCalm);
      alarm.intensity = S.fail ? 2 : 0;                                         // red light when the mission fails
    }
    C.subscribe(() => { if (running) update(); });                             // listen only; never call actions

    /* ---------- 7. size and animation loop ---------- */
    function resize() {
      const w = canvasBox.clientWidth, h = canvasBox.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    window.addEventListener("resize", resize);

    let t = 0;
    function frame() {
      if (!running) return;
      requestAnimationFrame(frame);
      if (document.hidden || box.offsetParent === null) return;                // not visible → skip work
      try {
        resize();
        t += 1 / 60;
        if (!reduceMotion) camAngle += 0.0015;                                 // slow orbit around the base
        camera.position.set(Math.sin(camAngle) * 11, 6.5, Math.cos(camAngle) * 11);
        camera.lookAt(0, 0.8, 0);
        if (protons.visible && !reduceMotion) {                                // protons fall; shield stops some
          const stopY = view.shield ? 4.6 : -1;
          for (let i = 0; i < N; i++) {
            let y = pos[i * 3 + 1] - 0.12;
            const inside = Math.hypot(pos[i * 3], pos[i * 3 + 2]) < 5.2;
            if (y < (inside && (i % 10) < view.shield * 3 ? stopY : -0.2)) y = 12; // blocked share ≈ shield level
            pos[i * 3 + 1] = y;
          }
          pGeo.attributes.position.needsUpdate = true;
        }
        if (view.storm) shieldMat.emissiveIntensity = 0.2 + 0.15 * Math.sin(t * 4); // dome pulses in a storm
        if (view.fail) alarm.intensity = 1.5 + Math.sin(t * 6);               // flashing alarm
        renderer.render(scene, camera);
      } catch (e) { giveUp(); }                                                 // render error → 2D only
    }
    update();
    frame();

    /* ---------- 8. a button to hide the 3D view (slow devices) ---------- */
    const btn = box.querySelector(".scene3d-toggle");
    btn.addEventListener("click", () => {
      const off = canvasBox.classList.toggle("hidden");
      btn.textContent = off ? "Show 3D view" : "Hide 3D view";
    });
    box.classList.remove("hidden");                                            // all good → show the panel
  }
})();
