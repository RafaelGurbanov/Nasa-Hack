/*
 * Art: all pictures in the game, drawn in code as SVG (no image files, works offline).
 * - Art.rovi(mood)          Rovi the robot: "happy" | "worried" | "scared" | "cheering"
 * - Art.face(i, mood)       astronaut i (0-3): "happy" | "ok" | "worried" | "scared" | "sad" | "cheering"
 * - Art.scene(id)           the Mars scene (id = unique prefix for gradients) (sky, Sun, hills, base, shield, storm)
 * - Art.updateScene(el, o)  change the scene: { storm, health 0-1, shield 0-3, power 0-5, food 0-1, fail }
 * These pictures were made by an AI assistant (Claude) in code. See AI_USE.md.
 * Only fixed shapes go into the SVG markup; no game data or text from the API is inserted.
 */
(function () {
  "use strict";
  const INK = "#2b1d16";

  /* ---------------- Rovi the robot ---------------- */
  function eye(x, y, r = 12) {
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${INK}"/><circle cx="${x + 4}" cy="${y - 5}" r="${r / 3}" fill="#fff"/>`;
  }
  function rovi(mood, label) {
    const ball = { happy: "#ffc53d", worried: "#ff9f43", scared: "#ff4d4d", cheering: "#ffc53d" }[mood] || "#ffc53d";
    let arms = "", face = "", extra = "";
    if (mood === "worried") {
      arms = `<path d="M56 158 Q34 142 46 118"/><path d="M144 158 Q166 142 154 118"/>`;
      face = `<path d="M64 72 L88 66 M136 72 L112 66" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` + eye(78, 92, 11) + eye(122, 92, 11) +
        `<path d="M84 114 Q100 104 116 114" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
    } else if (mood === "scared") {
      arms = `<path d="M56 156 Q28 122 36 90"/><path d="M144 156 Q172 122 164 90"/>`;
      face = `<circle cx="78" cy="92" r="15" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="78" cy="94" r="5" fill="${INK}"/>` +
        `<circle cx="122" cy="92" r="15" fill="#fff" stroke="${INK}" stroke-width="4"/><circle cx="122" cy="94" r="5" fill="${INK}"/>` +
        `<path d="M82 116 q4 -6 9 0 t9 0 t9 0 t9 0" stroke="${INK}" stroke-width="4" fill="none" stroke-linecap="round"/>`;
      extra = `<path d="M158 62 q9 13 0 20 q-9 -7 0 -20z" fill="#7fd8ff" stroke="${INK}" stroke-width="2"/>`;
    } else if (mood === "cheering") {
      arms = `<path d="M56 154 L24 104"/><path d="M144 154 L176 104"/><circle cx="22" cy="100" r="8" fill="#ffc53d"/><circle cx="178" cy="100" r="8" fill="#ffc53d"/>`;
      face = `<path d="M68 96 Q78 82 88 96 M112 96 Q122 82 132 96" stroke="${INK}" stroke-width="6" fill="none" stroke-linecap="round"/>` +
        `<path d="M80 104 Q100 132 120 104 Z" fill="${INK}"/><path d="M90 116 Q100 124 110 116" fill="#ff8fa3"/>` +
        `<ellipse cx="62" cy="108" rx="7" ry="4" fill="#ff8fa3"/><ellipse cx="138" cy="108" rx="7" ry="4" fill="#ff8fa3"/>`;
      extra = `<g fill="#ffc53d" stroke="${INK}" stroke-width="2" class="sparkle"><path d="M30 40 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z"/><path d="M170 30 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z"/></g>`;
    } else {
      arms = `<path class="wave" d="M144 160 Q172 140 178 112"/><path d="M56 160 Q34 172 30 194"/>`;
      face = eye(78, 92) + eye(122, 92) + `<path d="M82 108 Q100 122 118 108" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
        `<ellipse cx="62" cy="108" rx="7" ry="4" fill="#ff8fa3"/><ellipse cx="138" cy="108" rx="7" ry="4" fill="#ff8fa3"/>`;
    }
    return `<svg class="rovi rovi-${mood}" viewBox="0 0 200 232" role="img" aria-label="${label || "Rovi"}">
      <g filter="url(#wobble)" stroke="${INK}" stroke-width="6" stroke-linejoin="round" stroke-linecap="round" fill="none">
        <line x1="100" y1="44" x2="100" y2="16"/>${arms}
        <circle cx="100" cy="12" r="9" fill="${ball}" class="ball"/>
        <rect x="30" y="44" width="140" height="100" rx="34" fill="#2ec4b6"/>
        <rect x="48" y="62" width="104" height="64" rx="22" fill="#e9fffb" stroke-width="4"/>
        <rect x="56" y="144" width="88" height="48" rx="16" fill="#ff6b4a"/>
        <circle cx="72" cy="206" r="16" fill="${INK}"/><circle cx="128" cy="206" r="16" fill="${INK}"/>
      </g>
      ${face}${extra}
      <circle cx="72" cy="206" r="6" fill="#ffc53d"/><circle cx="128" cy="206" r="6" fill="#ffc53d"/>
      <path d="M100 156 l5 10 11 2 -8 8 2 11 -10 -5 -10 5 2 -11 -8 -8 11 -2z" fill="#ffc53d" stroke="${INK}" stroke-width="2"/>
    </svg>`;
  }

  /* ---------------- the 4 astronauts ---------------- */
  const CREW_LOOK = [
    { skin: "#f1c7a3", hair: "#3b2416", rim: "#4cb8f0", hairPath: "M34 50 Q38 22 62 22 Q86 22 88 48 Q76 34 62 36 Q46 36 34 50Z" },
    { skin: "#8d5a3b", hair: "#1d120c", rim: "#ffc53d", hairPath: "M36 44 Q40 26 62 26 Q84 26 86 44 Q74 36 62 36 Q48 36 36 44Z" },
    { skin: "#f5d6b8", hair: "#16110f", rim: "#5cc96b", hairPath: "M32 58 Q30 22 62 22 Q92 22 90 56 L84 40 Q62 30 42 42Z" },
    { skin: "#d9a27c", hair: "#c4622d", rim: "#9b74e0", hairPath: "M36 46 Q36 24 60 24 Q70 18 80 26 Q90 32 86 46 Q70 32 52 38 Q42 40 36 46Z" }
  ];
  function face(i, mood, label) {
    const L = CREW_LOOK[i];
    const dot = (x) => `<circle cx="${x}" cy="62" r="4.5" fill="${INK}"/><circle cx="${x + 1.5}" cy="60.5" r="1.5" fill="#fff"/>`;
    let eyes = dot(50) + dot(72), mouth = "", extra = "";
    switch (mood) {
      case "cheering":
        eyes = `<path d="M44 63 Q50 55 56 63 M66 63 Q72 55 78 63" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M50 72 Q61 88 72 72Z" fill="${INK}"/>`; break;
      case "happy": mouth = `<path d="M50 74 Q61 84 72 74" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; break;
      case "ok": mouth = `<path d="M53 76 Q61 80 69 76" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; break;
      case "worried":
        eyes += `<path d="M44 54 L55 51 M78 54 L67 51" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`;
        mouth = `<path d="M52 79 Q61 73 70 79" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; break;
      case "scared":
        eyes = `<circle cx="50" cy="61" r="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="62" r="2.5" fill="${INK}"/>` +
               `<circle cx="72" cy="61" r="7" fill="#fff" stroke="${INK}" stroke-width="2.5"/><circle cx="72" cy="62" r="2.5" fill="${INK}"/>`;
        mouth = `<ellipse cx="61" cy="79" rx="5" ry="6" fill="${INK}"/>`;
        extra = `<path d="M86 46 q6 9 0 14 q-6 -5 0 -14z" fill="#7fd8ff" stroke="${INK}" stroke-width="1.5"/>`; break;
      case "sad":
        eyes += `<path d="M46 70 q2 7 -1 9" stroke="#4cb8f0" stroke-width="3" fill="none" stroke-linecap="round"/>`;
        mouth = `<path d="M51 80 Q61 70 71 80" stroke="${INK}" stroke-width="3.5" fill="none" stroke-linecap="round"/>`; break;
    }
    const blush = mood === "happy" || mood === "cheering" ? `<ellipse cx="42" cy="72" rx="5" ry="3" fill="#ff8fa3"/><ellipse cx="80" cy="72" rx="5" ry="3" fill="#ff8fa3"/>` : "";
    return `<svg class="face face-${mood}" viewBox="0 0 122 122" role="img" aria-label="${label || "astronaut"}">
      <path d="M18 122 Q18 96 61 96 Q104 96 104 122Z" fill="#fff" stroke="${INK}" stroke-width="4"/>
      <path d="M44 100 L61 110 L78 100" stroke="${L.rim}" stroke-width="6" fill="none" stroke-linecap="round"/>
      <circle cx="61" cy="56" r="45" fill="#fff" stroke="${INK}" stroke-width="5"/>
      <circle cx="61" cy="58" r="33" fill="${L.skin}" stroke="${INK}" stroke-width="3"/>
      <path d="${L.hairPath}" fill="${L.hair}" stroke="${INK}" stroke-width="2"/>
      ${eyes}${mouth}${blush}${extra}
      <path d="M30 34 Q40 18 58 14" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".9"/>
      <circle cx="61" cy="56" r="45" fill="none" stroke="${L.rim}" stroke-width="3" opacity=".6"/>
    </svg>`;
  }

  /* ---------------- the Mars scene ---------------- */
  function scene(id = "s") {
    let streaks = "";
    for (let i = 0; i < 16; i++) {
      const x = 120 + ((i * 53) % 640), d = ((i * 0.17) % 1.2).toFixed(2);
      streaks += `<line class="pr" x1="${x}" y1="-30" x2="${x - 22}" y2="20" style="animation-delay:-${d}s"/>`;
    }
    let cells = "";
    for (let i = 0; i < 5; i++) cells += `<g transform="translate(${i * 30} 0)"><path class="cell" d="M0 0 L26 0 L20 -26 L-6 -26Z"/></g>`;
    return `<svg class="scene-svg" viewBox="0 0 800 380" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id="${id}SkyCalm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffab80"/><stop offset=".65" stop-color="#ffd7a6"/><stop offset="1" stop-color="#ffeccb"/></linearGradient>
        <linearGradient id="${id}SkyStorm" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a0a22"/><stop offset=".55" stop-color="#9c2a2a"/><stop offset="1" stop-color="#e2683a"/></linearGradient>
      </defs>
      <rect class="sky sky-calm" width="800" height="380" fill="url(#${id}SkyCalm)"/>
      <rect class="sky sky-storm" width="800" height="380" fill="url(#${id}SkyStorm)"/>
      <g fill="#fff" class="specks"><circle cx="90" cy="60" r="3"/><circle cx="220" cy="34" r="2.5"/><circle cx="420" cy="54" r="2"/><circle cx="520" cy="26" r="2.5"/></g>
      <g class="sun" transform="translate(660 86)">
        <g class="sun-happy" filter="url(#wobble)">
          <g class="rays" stroke="${INK}" stroke-width="6" stroke-linecap="round">
            <line x1="0" y1="-74" x2="0" y2="-56"/><line x1="0" y1="74" x2="0" y2="56"/><line x1="-74" y1="0" x2="-56" y2="0"/><line x1="74" y1="0" x2="56" y2="0"/>
            <line x1="52" y1="52" x2="40" y2="40"/><line x1="-52" y1="52" x2="-40" y2="40"/><line x1="52" y1="-52" x2="40" y2="-40"/><line x1="-52" y1="-52" x2="-40" y2="-40"/></g>
          <circle r="42" fill="#ffc53d" stroke="${INK}" stroke-width="6"/>
          <circle cx="-13" cy="-6" r="5" fill="${INK}"/><circle cx="13" cy="-6" r="5" fill="${INK}"/>
          <path d="M-14 12 Q0 24 14 12" stroke="${INK}" stroke-width="5" fill="none" stroke-linecap="round"/>
        </g>
        <g class="sun-angry" filter="url(#wobble)">
          <path class="spikes" d="M0 -100 L17 -57 L57 -82 L50 -38 L95 -34 L61 -6 L95 25 L50 29 L59 74 L17 50 L0 93 L-17 50 L-59 74 L-50 29 L-95 25 L-61 -6 L-95 -34 L-50 -38 L-57 -82 L-17 -57Z" fill="#ffc53d" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>
          <circle r="44" fill="#ff8a3d" stroke="${INK}" stroke-width="5"/>
          <path d="M-24 -16 L-8 -8 M24 -16 L8 -8" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>
          <circle cx="-14" cy="0" r="5" fill="${INK}"/><circle cx="14" cy="0" r="5" fill="${INK}"/>
          <ellipse cx="0" cy="20" rx="10" ry="8" fill="${INK}"/>
        </g>
      </g>
      <g filter="url(#wobble)" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
        <path class="hill far" d="M-20 236 Q90 176 210 214 T450 196 Q560 172 660 210 T820 200 V400 H-20Z"/>
        <path class="hill mid" d="M-20 270 Q130 224 280 262 T560 250 Q690 236 820 262 V400 H-20Z"/>
        <path class="hill near" d="M-20 318 Q180 290 400 312 T820 306 V400 H-20Z"/>
        <ellipse class="crater" cx="110" cy="346" rx="46" ry="11"/><ellipse class="crater" cx="700" cy="350" rx="34" ry="9"/>
        <path class="rock" d="M40 318 L62 296 L88 306 L96 322Z"/><path class="rock" d="M736 316 L752 300 L774 308 L780 320Z"/><path class="rock" d="M300 352 L314 340 L332 346 L336 356Z"/>
      </g>
      <g class="base" transform="translate(400 250)">
        <g filter="url(#wobble)" stroke="${INK}" stroke-width="5" stroke-linejoin="round">
          <path d="M-200 54 A62 50 0 0 1 -76 54Z" class="greenhouse"/>
          <path d="M-182 54 Q-176 30 -168 54 M-152 54 Q-144 22 -136 54 M-122 54 Q-114 30 -106 54" stroke-width="3" class="plants"/>
          <path d="M-84 54 A84 72 0 0 1 84 54Z" fill="#fff"/>
          <rect x="-100" y="50" width="200" height="16" rx="6" fill="#ff6b4a"/>
          <line x1="0" y1="-18" x2="0" y2="-52"/><path d="M0 -52 L30 -44 L0 -36Z" fill="#2ec4b6" stroke-width="4"/>
          <g transform="translate(118 64)" stroke-width="3">${cells}</g>
        </g>
        <circle class="win" cx="-44" cy="24" r="12"/><circle class="win" cx="0" cy="6" r="12"/><circle class="win" cx="44" cy="24" r="12"/>
      </g>
      <path class="shield" d="M168 316 A232 196 0 0 1 632 316" />
      <g class="protons">${streaks}</g>
    </svg>`;
  }

  /** Update the scene without redrawing it. */
  function updateScene(el, o) {
    el.classList.toggle("storm", !!o.storm);
    el.classList.toggle("trouble", o.health < 0.6);
    el.classList.toggle("failed", !!o.fail);
    el.style.setProperty("--h", Math.max(0.15, Math.min(1, o.health)).toFixed(2));
    const sh = el.querySelector(".shield");
    sh.style.opacity = o.shield ? (0.25 + 0.25 * o.shield).toFixed(2) : "0";
    sh.style.strokeWidth = 3 + 2 * o.shield;
    el.querySelectorAll(".cell").forEach((c, i) => c.classList.toggle("on", i < o.power));
    el.querySelector(".plants").style.opacity = (0.3 + 0.7 * (o.food == null ? 1 : o.food)).toFixed(2);
  }

  window.Art = { rovi, face, scene, updateScene, CREW_LOOK };
})();
