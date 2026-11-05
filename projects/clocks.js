/* clocks.js — "Four 24-Clocks": the current time written by 96 analogue
   clocks. Each digit is a 4×6 grid of clocks; both hands are full length,
   so neighbouring clocks join up into the strokes of the digit.

   Motion is one slow, continuous cycle:
     form    (~6 s)  hands drift out of a flowing field and settle into the time
     hold    (~14 s) the time sits still and readable
     distort (~6 s)  the digits warp and dissolve back into the field
     drift   (~4 s)  the field keeps flowing; the next form shows the new time
   A minute change during "hold" starts the distort early, so the display
   is never more than a few seconds behind.

   How the distortion stays smooth: each hand's angle is
       digitAngle + m · flow(x, y, t)
   where m (0 = crisp digit, 1 = fully dissolved) eases per clock with a
   left-to-right stagger, and flow() is a slowly drifting sine field. The
   offset is added, never wrapped/lerped between two angles, so a hand can
   never snap or spin the long way round. Digit changes happen only while
   m ≈ 1 and are themselves eased, hidden inside the flow.

   Plain canvas 2D. Angles in degrees, 0 = 12 o'clock, clockwise.
   prefers-reduced-motion: no cycle, the digits just update in place. */
(function () {
  'use strict';
  var canvas = document.getElementById('clock-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Hand pairs for each glyph.
  var CONFIGS = {
    nw: [0, 270],   // ┘ up + left
    ne: [0, 90],    // └ up + right
    se: [90, 180],  // ┌ right + down
    sw: [270, 180], // ┐ left + down
    vt: [0, 180],   // │
    ht: [90, 270],  // ─
    ex: [225, 225]  // idle: both hands parked together, drawn dim
  };
  // Row-major 4 columns × 6 rows per digit (layouts from the original clocks.py).
  var DIGITS = {
    0: 'se-ht-ht-sw-vt-se-sw-vt-vt-vt-vt-vt-vt-vt-vt-vt-vt-ne-nw-vt-ne-ht-ht-nw',
    1: 'se-ht-sw-ex-ne-sw-vt-ex-ex-vt-vt-ex-ex-vt-vt-ex-se-nw-ne-sw-ne-ht-ht-nw',
    2: 'se-ht-ht-sw-ne-ht-sw-vt-se-ht-nw-vt-vt-se-ht-nw-vt-ne-ht-sw-ne-ht-ht-nw',
    3: 'se-ht-ht-sw-ne-ht-sw-vt-se-ht-nw-vt-ne-ht-sw-vt-se-ht-nw-vt-ne-ht-ht-nw',
    4: 'se-sw-se-sw-vt-vt-vt-vt-vt-ne-nw-vt-ne-ht-sw-vt-ex-ex-vt-vt-ex-ex-ne-nw',
    5: 'se-ht-ht-sw-vt-se-ht-nw-vt-ne-ht-sw-ne-ht-sw-vt-se-ht-nw-vt-ne-ht-ht-nw',
    6: 'se-ht-ht-sw-vt-se-ht-nw-vt-ne-ht-sw-vt-se-sw-vt-vt-ne-nw-vt-ne-ht-ht-nw',
    7: 'se-ht-ht-sw-ne-ht-sw-vt-ex-ex-vt-vt-ex-ex-vt-vt-ex-ex-vt-vt-ex-ex-ne-nw',
    8: 'se-ht-ht-sw-vt-se-sw-vt-vt-ne-nw-vt-vt-se-sw-vt-vt-ne-nw-vt-ne-ht-ht-nw',
    9: 'se-ht-ht-sw-vt-se-sw-vt-vt-ne-nw-vt-ne-ht-sw-vt-se-ht-nw-vt-ne-ht-ht-nw'
  };
  var COLS = 4, ROWS = 6, GCOLS = COLS * 4;

  // Phase lengths (ms). User-adjustable via the Timing panel (see bottom).
  var DEFAULTS = { hold: 14, trans: 6, drift: 4 };   // seconds
  var FORM = 6000, HOLD = 14000, DISTORT = 6000, DRIFT = 4000;
  var STAGGER = 0.45;      // fraction of a transition spent rolling across the grid
  var MORPH = 3200;        // ms for the underlying digit to change while dissolved

  // ---------- state ----------
  var clocks = [];
  for (var d = 0; d < 4; d++)
    for (var r = 0; r < ROWS; r++)
      for (var c = 0; c < COLS; c++)
        clocks.push({ d: d, r: r, c: c, gc: d * COLS + c, x: 0, y: 0,
                      base: [{ from: 225, to: 225 }, { from: 225, to: 225 }], dimFrom: 1, dimTo: 1 });
  var morphStart = -1e9;
  var shown = null;
  var R = 20, colon = [], W = 0, H = 0, dpr = 1;

  // phase: 'form' | 'hold' | 'distort' | 'drift'
  var phase = 'form', phaseStart = 0;

  function easeSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  function mod(n, m) { return ((n % m) + m) % m; }

  function currentDigits() {
    var t = new Date();
    var hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0');
    return [+hh[0], +hh[1], +mm[0], +mm[1]];
  }

  // Point every clock's underlying (undistorted) angles at `digits`,
  // easing over MORPH ms along the shortest way round.
  function setDigits(digits, now, instant) {
    var p = instant ? 1 : easeSine(clamp01((now - morphStart) / MORPH));
    clocks.forEach(function (k) {
      var code = DIGITS[digits[k.d]].split('-')[k.r * COLS + k.c];
      var target = CONFIGS[code];
      for (var i = 0; i < 2; i++) {
        var b = k.base[i];
        var cur = b.from + (b.to - b.from) * p;
        var delta = mod(target[i] - cur + 180, 360) - 180;
        k.base[i] = { from: cur, to: cur + delta };
      }
      var dimCur = k.dimFrom + (k.dimTo - k.dimFrom) * p;
      k.dimFrom = dimCur;
      k.dimTo = code === 'ex' ? 1 : 0;
    });
    morphStart = instant ? -1e9 : now;
    shown = digits;
    canvas.setAttribute('aria-label', 'Current time ' + digits[0] + digits[1] + ':' + digits[2] + digits[3]);
  }

  // Slowly drifting flow field (degrees). Different for the two hands so
  // they splay apart; smooth in x, y and t.
  function flow(k, hand, t) {
    var s = t / 1000;
    return 150 * Math.sin(k.gc * 0.42 + s * 0.32 + hand * 1.9) +
           70 * Math.sin(k.r * 0.75 - k.gc * 0.18 + s * 0.23 + hand * 0.8) +
           (hand ? -40 : 40);
  }

  // Distortion amount m for one clock at this moment (0 = crisp digit).
  function distortion(k, now) {
    var colFrac = k.gc / (GCOLS - 1);
    var p;
    if (phase === 'hold') return 0;
    if (phase === 'drift') return 1;
    var dur = phase === 'form' ? FORM : DISTORT;
    var g = (now - phaseStart) / dur;                         // 0..1 overall
    p = clamp01((g * (1 + STAGGER) - colFrac * STAGGER));     // per-clock, rolling left→right
    p = easeSine(p);
    return phase === 'form' ? 1 - p : p;
  }

  function advance(now) {
    var el = now - phaseStart;
    if (phase === 'form' && el >= FORM) { phase = 'hold'; phaseStart = now; }
    else if (phase === 'hold') {
      var changed = currentDigits().join() !== shown.join();
      if (el >= HOLD || changed) { phase = 'distort'; phaseStart = now; }
    }
    else if (phase === 'distort' && el >= DISTORT) {
      phase = 'drift'; phaseStart = now;
      var dg = currentDigits();
      if (dg.join() !== shown.join()) setDigits(dg, now, false);   // morph hidden inside the flow
    }
    else if (phase === 'drift' && el >= DRIFT) {   // a digit morph still running here just finishes during the early, still-dissolved part of form
      phase = 'form'; phaseStart = now;
    }
  }

  // ---------- layout ----------
  // Wide: four digits in a row with a colon gap. Narrow: hours over minutes.
  // Two arrangements: four digits in a row ("wide", with a colon gap) or
  // hours over minutes ("stacked"). Inline on the page the canvas fills
  // the card's width and takes whatever height it needs; in full screen
  // it fills the screen, picking whichever arrangement gives bigger clocks,
  // centred both ways.
  var stage = canvas.parentElement;
  var GAP = 0.45, COLON_GAP = 1.3, ROW_GAP = 0.8;     // in clock diameters
  var ARR = {
    wide: { w: COLS * 4 + GAP * 2 + COLON_GAP, h: ROWS,
            xs: [0, COLS + GAP, 2 * COLS + GAP + COLON_GAP, 3 * COLS + 2 * GAP + COLON_GAP], ys: [0, 0, 0, 0] },
    stacked: { w: COLS * 2 + GAP, h: ROWS * 2 + ROW_GAP,
               xs: [0, COLS + GAP, 0, COLS + GAP], ys: [0, 0, ROWS + ROW_GAP, ROWS + ROW_GAP] }
  };
  function isFull() { return document.fullscreenElement === stage || stage.classList.contains('is-full'); }

  function layout() {
    var cs = getComputedStyle(stage);
    var availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    var full = isFull();
    var a, D;
    if (full) {
      var availH = stage.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var dW = Math.min(availW / ARR.wide.w, availH / ARR.wide.h);
      var dS = Math.min(availW / ARR.stacked.w, availH / ARR.stacked.h);
      a = dW >= dS ? ARR.wide : ARR.stacked;
      D = Math.max(dW, dS);
      W = availW; H = availH;
    } else {
      a = availW >= 640 ? ARR.wide : ARR.stacked;
      D = availW / a.w;
      W = availW; H = Math.ceil(a.h * D);
    }
    var ox = (W - a.w * D) / 2, oy = (H - a.h * D) / 2;
    R = D / 2;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    clocks.forEach(function (k) {
      k.x = ox + (a.xs[k.d] + k.c + 0.5) * D;
      k.y = oy + (a.ys[k.d] + k.r + 0.5) * D;
    });
    colon = a === ARR.wide
      ? [[ox + (a.xs[2] - COLON_GAP / 2) * D, oy + 2 * D], [ox + (a.xs[2] - COLON_GAP / 2) * D, oy + 4 * D]]
      : [];
  }

  // ---------- drawing ----------
  var css = getComputedStyle(document.documentElement);
  var INK = (css.getPropertyValue('--text') || '#eeeae2').trim();
  var ACCENT = (css.getPropertyValue('--accent') || '#ff9d5c').trim();

  function hand(x, y, deg, len) {
    var rad = (deg - 90) * Math.PI / 180;      // 0° = 12 o'clock, clockwise
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(rad) * len, y + Math.sin(rad) * len);
    ctx.stroke();
  }

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    var face = R * 0.93, len = R * 0.97;
    var mp = easeSine(clamp01((now - morphStart) / MORPH));
    ctx.lineCap = 'round';
    for (var i = 0; i < clocks.length; i++) {
      var k = clocks[i];
      ctx.beginPath();
      ctx.arc(k.x, k.y, face, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.028)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.075)';
      ctx.lineWidth = 1;
      ctx.stroke();

      var m = reduce ? 0 : distortion(k, now);
      // idle (dim) clocks brighten as the field takes over, so the
      // dissolved state reads as one even texture
      var dim = (k.dimFrom + (k.dimTo - k.dimFrom) * mp) * (1 - m);
      ctx.strokeStyle = INK;
      ctx.globalAlpha = 1 - dim * 0.85;
      ctx.lineWidth = Math.max(2, R * 0.17);
      for (var h = 0; h < 2; h++) {
        var b = k.base[h];
        var baseAngle = b.from + (b.to - b.from) * mp;
        hand(k.x, k.y, baseAngle + m * flow(k, h, now), len);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(12,13,18,0.9)';
      ctx.beginPath(); ctx.arc(k.x, k.y, Math.max(1.2, R * 0.06), 0, Math.PI * 2); ctx.fill();
    }
    if (colon.length) {
      // gentle breathing; fades out while the digits are dissolved
      var crisp = 1;
      if (phase === 'drift') crisp = 0;
      else if (phase === 'form') crisp = easeSine(clamp01((now - phaseStart) / FORM));
      else if (phase === 'distort') crisp = 1 - easeSine(clamp01((now - phaseStart) / DISTORT));
      var breathe = reduce ? 1 : 0.55 + 0.45 * Math.sin(now / 1000 * Math.PI);
      ctx.fillStyle = ACCENT;
      ctx.globalAlpha = Math.max(0.12, crisp) * breathe;
      colon.forEach(function (p) { ctx.beginPath(); ctx.arc(p[0], p[1], R * 0.22, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }
  }

  // ---------- loop ----------
  var running = false;
  function frame(now) {
    if (!running) return;
    if (reduce) {
      var dg = currentDigits();
      if (dg.join() !== shown.join()) setDigits(dg, now, true);
    } else {
      advance(now);
    }
    draw(now);
    requestAnimationFrame(frame);
  }
  function start() { if (!running && !document.hidden) { running = true; requestAnimationFrame(frame); } }
  function stop() { running = false; }

  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('ResizeObserver' in window) new ResizeObserver(function () { layout(); draw(performance.now()); }).observe(canvas.parentElement);
  else window.addEventListener('resize', layout);

  // "Distort" button: dissolve now and re-form (from hold or form only)
  var btn = document.getElementById('spin');
  if (btn) btn.addEventListener('click', function () {
    if (reduce) return;
    if (phase === 'hold') { phase = 'distort'; phaseStart = performance.now(); }
  });

  // ---------- full screen / screensaver ----------
  // Real Fullscreen API where available; otherwise (e.g. iPhone Safari,
  // which only allows video full screen) a fixed overlay filling the
  // window. The cursor and exit button hide after a few idle seconds, and
  // a screen wake lock keeps the display on where supported.
  var fsBtn = document.getElementById('fullscreen');
  var exitBtn = stage.querySelector('.clock-exit');
  var wakeLock = null, idleTimer = 0;
  var canNative = !!(stage.requestFullscreen && document.fullscreenEnabled);

  function lockWake() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (l) {
      wakeLock = l;
      l.addEventListener('release', function () { wakeLock = null; });
    }, function () {});
  }
  function unlockWake() { if (wakeLock) { wakeLock.release().catch(function () {}); wakeLock = null; } }
  function poke() {
    stage.classList.remove('idle');
    clearTimeout(idleTimer);
    if (isFull()) idleTimer = setTimeout(function () { stage.classList.add('idle'); }, 2500);
  }
  function onFullChange() {
    var full = isFull();
    document.documentElement.classList.toggle('clock-fs', full);
    if (fsBtn) fsBtn.setAttribute('aria-pressed', String(full));
    if (full) { lockWake(); poke(); } else { unlockWake(); stage.classList.remove('idle'); }
    layout();
    draw(performance.now());
  }
  function enterFull() {
    if (canNative) stage.requestFullscreen().catch(function () { stage.classList.add('is-full'); onFullChange(); });
    else { stage.classList.add('is-full'); onFullChange(); }
  }
  function exitFull() {
    if (document.fullscreenElement) document.exitFullscreen();
    else { stage.classList.remove('is-full'); onFullChange(); }
  }
  function toggleFull() { isFull() ? exitFull() : enterFull(); }

  document.addEventListener('fullscreenchange', onFullChange);
  if (fsBtn) fsBtn.addEventListener('click', toggleFull);
  if (exitBtn) exitBtn.addEventListener('click', exitFull);
  stage.addEventListener('pointermove', poke);
  stage.addEventListener('pointerdown', poke);
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input, textarea, select')) return;
    if (e.key === 'f' || e.key === 'F') { e.preventDefault(); toggleFull(); }
    else if (e.key === 'Escape' && stage.classList.contains('is-full')) exitFull();  // native FS handles its own Esc
  });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && isFull()) lockWake(); });

  // ---------- timing settings ----------
  // Sliders for hold / form-&-distort / drift, remembered per browser.
  // Changing a length mid-phase rescales phaseStart so the current
  // progress fraction is kept — the animation never jumps.
  var store = {
    get: function () { try { return JSON.parse(localStorage.getItem('clocks-timing')) || {}; } catch (e) { return {}; } },
    set: function (v) { try { localStorage.setItem('clocks-timing', JSON.stringify(v)); } catch (e) {} }
  };
  var timing = Object.assign({}, DEFAULTS, store.get());
  function phaseLength(ph) { return ph === 'form' ? FORM : ph === 'hold' ? HOLD : ph === 'distort' ? DISTORT : DRIFT; }
  function applyTiming() {
    var now = performance.now();
    var old = phaseLength(phase);
    var frac = old > 0 ? (now - phaseStart) / old : 1;
    HOLD = timing.hold * 1000;
    FORM = DISTORT = timing.trans * 1000;
    DRIFT = timing.drift * 1000;
    var nu = phaseLength(phase);
    if (frac < 1) phaseStart = now - frac * nu;
  }
  var inputs = {
    hold: document.getElementById('set-hold'),
    trans: document.getElementById('set-trans'),
    drift: document.getElementById('set-drift')
  };
  function syncInputs() {
    Object.keys(inputs).forEach(function (key) {
      var el = inputs[key];
      if (!el) return;
      el.value = timing[key];
      var out = document.querySelector('output[for="' + el.id + '"]');
      if (out) out.textContent = (+timing[key]).toString().replace(/\.0$/, '') + ' s';
    });
  }
  Object.keys(inputs).forEach(function (key) {
    var el = inputs[key];
    if (!el) return;
    el.addEventListener('input', function () {
      timing[key] = parseFloat(el.value);
      store.set(timing);
      applyTiming();
      syncInputs();
    });
  });
  var resetBtn = document.getElementById('set-reset');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    timing = Object.assign({}, DEFAULTS);
    store.set(timing);
    applyTiming();
    syncInputs();
  });
  applyTiming();
  syncInputs();

  layout();
  var t0 = performance.now();
  setDigits(currentDigits(), t0, true);
  phase = reduce ? 'hold' : 'form';     // start dissolved, form slowly into the time
  phaseStart = t0;
  draw(t0);
  start();
})();
