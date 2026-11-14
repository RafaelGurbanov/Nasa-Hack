/*
 * Sfx: tiny sound effects made with the Web Audio API (no sound files).
 * Sound is OFF by default. Sfx.toggle() turns it on/off (needs a click first, as browsers require).
 * If audio is not available, every call quietly does nothing; the game never breaks.
 */
(function () {
  "use strict";
  let ctx = null, on = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // One note: wave type, start/end pitch, length, volume, start delay.
  function tone(type, f1, f2, len, vol = 0.18, delay = 0) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + len + 0.05);
  }

  // Short burst of noise (whoosh / zap crackle).
  function noise(len, vol = 0.12, delay = 0) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + delay;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    f.type = "bandpass"; f.frequency.value = 1200;
    s.buffer = buf; g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination);
    s.start(t);
  }

  const SOUNDS = {
    click: () => tone("sine", 660, 520, 0.08, 0.12),
    up: () => tone("triangle", 520, 880, 0.12, 0.14),
    down: () => tone("triangle", 600, 340, 0.12, 0.14),
    go: () => { noise(0.35, 0.1); tone("sine", 300, 900, 0.3, 0.1); },
    zap: () => { tone("sawtooth", 1200, 120, 0.35, 0.08); noise(0.25, 0.08, 0.05); },
    good: () => { tone("triangle", 660, 660, 0.12, 0.14); tone("triangle", 990, 990, 0.18, 0.14, 0.12); },
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone("triangle", f, f, 0.22, 0.16, i * 0.13)),
    fail: () => { tone("square", 220, 180, 0.25, 0.07); tone("square", 180, 140, 0.35, 0.07, 0.28); }
  };

  window.Sfx = {
    get on() { return on; },
    toggle() { on = !on; if (on) { try { ensure(); SOUNDS.good(); } catch (e) { on = false; } } return on; },
    play(name) { if (!on || !SOUNDS[name]) return; try { SOUNDS[name](); } catch (e) { /* no sound is fine */ } }
  };
})();
