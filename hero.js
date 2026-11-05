/* hero.js — rotor & rain: the home-page hero canvas.
   Rain falls across the hero; a rotor disc hovers where the pointer is
   (or flies a slow autopilot Lissajous path when there is no pointer,
   e.g. on phones) and its downwash shoves the drops outward, lighting
   them up as they pass through the disc.

   Cheap by design: ~250 line segments per frame, DPR capped at 2, the
   loop pauses when the hero is off-screen or the tab is hidden, and
   prefers-reduced-motion gets a single still frame. */
(function () {
  'use strict';
  var canvas = document.querySelector('.hero-canvas');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var hero = canvas.parentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // amber (verse), indigo (rotor), cyan (tech), paper
  var PALETTE = [
    [236, 235, 230], [236, 235, 230], [236, 235, 230],
    [79, 214, 224], [79, 214, 224],
    [255, 157, 92],
    [124, 92, 255]
  ];
  var WIND = -40;           // px/s — slight slant, like rain in a breeze
  var W = 0, H = 0, dpr = 1, R = 160;
  var drops = [];
  var hub = { x: 0, y: 0, tx: 0, ty: 0, power: 0, targetPower: 0.65 };
  var pointerActive = false, lastPointer = 0;
  var running = false, visible = true, last = 0, time = 0, angle = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function makeDrop(initial) {
    var z = Math.pow(Math.random(), 1.6) * 0.85 + 0.15; // most drops far away
    return {
      x: rand(-60, W + 60),
      y: initial ? rand(-H, H) : rand(-120, -10),
      z: z,
      vx: 0,
      vy: 520 + 900 * z,
      len: 8 + 26 * z,
      c: PALETTE[(Math.random() * PALETTE.length) | 0],
      glow: 0
    };
  }

  function resize() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    R = Math.max(110, Math.min(220, Math.min(W, H) * 0.24));
    var n = Math.min(260, Math.round((W * H) / 4800));
    while (drops.length < n) drops.push(makeDrop(true));
    drops.length = n;
    if (!hub.x) { hub.x = hub.tx = W * 0.72; hub.y = hub.ty = H * 0.42; }
  }

  function autopilot(t) {
    // slow figure-eight over the right half of the hero
    // (on narrow screens the hero stacks photo-over-text, so the rotor
    // roams the band around the photo instead of crossing the copy)
    var wide = W > 900;
    var cx = wide ? W * 0.7 : W * 0.5;
    hub.tx = cx + Math.sin(t * 0.23) * W * (wide ? 0.18 : 0.42);
    hub.ty = (wide ? H * 0.42 : H * 0.22) + Math.sin(t * 0.46) * H * (wide ? 0.2 : 0.08);
  }

  function step(dt) {
    time += dt;
    if (!pointerActive || time - lastPointer > 4) { pointerActive = false; autopilot(time); }
    var ease = 1 - Math.pow(0.002, dt);       // frame-rate independent smoothing
    hub.x += (hub.tx - hub.x) * ease;
    hub.y += (hub.ty - hub.y) * ease;
    hub.power += (hub.targetPower - hub.power) * ease;
    angle += dt * 22;                          // rotor rpm, in rad/s

    var R2 = R * R;
    for (var i = 0; i < drops.length; i++) {
      var p = drops[i];
      var dx = p.x - hub.x, dy = p.y - hub.y;
      var dist2 = dx * dx + dy * dy;
      if (dist2 < R2) {
        var dist = Math.sqrt(dist2) || 1;
        var f = 1 - dist / R;
        var force = f * f * 5200 * hub.power * (0.4 + p.z);
        p.vx += (dx / dist) * force * dt;
        p.vx += (-dy / dist) * force * 0.35 * dt;   // a touch of swirl
        p.glow = Math.max(p.glow, f * hub.power);
      }
      p.vx *= Math.pow(0.18, dt);                    // air drag back toward the wind
      p.glow *= Math.pow(0.08, dt);
      p.x += (WIND * p.z + p.vx) * dt;
      p.y += p.vy * dt;
      if (p.y - p.len > H || p.x < -120 || p.x > W + 120) drops[i] = makeDrop(false);
    }
  }

  function drawRotor() {
    var a = 0.16 * hub.power;
    if (a < 0.01) return;
    ctx.save();
    ctx.translate(hub.x, hub.y);
    // rotor disc wash
    var g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
    g.addColorStop(0, 'rgba(124,92,255,' + (a * 0.9) + ')');
    g.addColorStop(0.6, 'rgba(255,157,92,' + (a * 0.35) + ')');
    g.addColorStop(1, 'rgba(255,157,92,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
    // tip-path plane
    ctx.strokeStyle = 'rgba(236,235,230,' + (a * 0.9) + ')';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 7]);
    ctx.lineDashOffset = -angle * 6;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // four blades, each a motion-blurred wedge
    var bl = R * 0.62;
    for (var b = 0; b < 4; b++) {
      var th = angle + (b * Math.PI) / 2;
      for (var k = 0; k < 6; k++) {
        var tt = th - k * 0.07;
        ctx.strokeStyle = 'rgba(236,235,230,' + (a * 2.4 * (1 - k / 6)) + ')';
        ctx.lineWidth = 2.2 - k * 0.25;
        ctx.beginPath();
        ctx.moveTo(Math.cos(tt) * 6, Math.sin(tt) * 6);
        ctx.lineTo(Math.cos(tt) * bl, Math.sin(tt) * bl);
        ctx.stroke();
      }
    }
    // hub
    ctx.fillStyle = 'rgba(255,157,92,' + Math.min(1, a * 5) + ')';
    ctx.beginPath(); ctx.arc(0, 0, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawRotor();
    ctx.lineCap = 'round';
    for (var i = 0; i < drops.length; i++) {
      var p = drops[i];
      var vx = WIND * p.z + p.vx;
      var k = p.len / p.vy;                      // tail follows the velocity vector
      var alpha = 0.06 + 0.32 * p.z + p.glow * 0.7;
      var c = p.glow > 0.15 ? [255, 190, 140] : p.c;
      ctx.strokeStyle = 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + Math.min(0.95, alpha) + ')';
      ctx.lineWidth = 0.5 + 1.3 * p.z;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - vx * k, p.y - p.len);
      ctx.stroke();
    }
  }

  function frame(t) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
    last = t;
    step(dt);
    draw();
    requestAnimationFrame(frame);
  }
  function start() {
    if (running || reduce || !visible || document.hidden) return;
    running = true; last = 0;
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  function setPointer(e) {
    var r = canvas.getBoundingClientRect();
    hub.tx = e.clientX - r.left;
    hub.ty = e.clientY - r.top;
    pointerActive = true;
    lastPointer = time;
    hub.targetPower = 1;
  }
  hero.addEventListener('pointermove', setPointer, { passive: true });
  hero.addEventListener('pointerdown', setPointer, { passive: true });
  hero.addEventListener('pointerleave', function () { pointerActive = false; hub.targetPower = 0.65; });

  window.addEventListener('resize', function () { resize(); if (reduce) draw(); });
  document.addEventListener('visibilitychange', function () { document.hidden ? stop() : start(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }

  resize();
  if (reduce) {
    for (var s = 0; s < 30; s++) step(0.016);
    draw();
  } else {
    start();
  }
})();
