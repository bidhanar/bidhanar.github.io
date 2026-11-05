/* site.js — shared behaviour for every page of "Rotor Verse".
   Progressive enhancement throughout: pages are complete without it,
   anything hidden-until-animated is only hidden under the .js class,
   and everything motion-heavy bails out for prefers-reduced-motion.

   Modules (in order): footer year · header/progress · mobile nav ·
   nav indicator · split headline · rotating word · scroll reveal ·
   counters · scroll-lit quote · poem line reveal · story reading meta ·
   spotlight/tilt cards · magnetic buttons · cursor glow · portrait tilt ·
   project filters · copy-to-clipboard. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var mq = function (q) { return window.matchMedia ? window.matchMedia(q).matches : false; };
  var reduce = mq('(prefers-reduced-motion: reduce)');
  var finePointer = mq('(hover: hover) and (pointer: fine)');
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || d).querySelectorAll(sel)); };
  root.classList.add('js');

  /* ---------- Footer year ---------- */
  $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- Header state, scroll progress, brand rotor ---------- */
  var header = d.querySelector('.site-header');
  var progress = d.querySelector('.scroll-progress');
  var rotor = d.querySelector('.brand-rotor');
  var scrollTicking = false;
  var scrollHandlers = [];
  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;
    requestAnimationFrame(function () {
      scrollTicking = false;
      var y = window.scrollY || 0;
      var max = Math.max(1, root.scrollHeight - window.innerHeight);
      if (header) header.classList.toggle('is-scrolled', y > 8);
      if (progress) progress.style.transform = 'scaleX(' + Math.min(1, y / max) + ')';
      if (rotor && !reduce) rotor.style.setProperty('--spin', (y * 0.6) + 'deg');
      scrollHandlers.forEach(function (fn) { fn(y); });
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  /* ---------- Mobile nav ---------- */
  var nav = d.querySelector('.main-nav');
  var toggle = d.querySelector('.nav-toggle');
  if (nav) $$('a', nav).forEach(function (a, i) { a.style.setProperty('--i', i); });
  function setNav(open) {
    root.classList.toggle('nav-open', open);
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    }
  }
  if (toggle && nav) {
    toggle.addEventListener('click', function () { setNav(!root.classList.contains('nav-open')); });
    nav.addEventListener('click', function (e) { if (e.target.closest('a')) setNav(false); });
    d.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && root.classList.contains('nav-open')) { setNav(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 760) setNav(false); });
  }

  /* ---------- Sliding nav indicator (desktop) ---------- */
  if (nav && finePointer) {
    var ind = d.createElement('span');
    ind.className = 'nav-indicator';
    ind.setAttribute('aria-hidden', 'true');
    nav.insertBefore(ind, nav.firstChild);
    var current = nav.querySelector('[aria-current="page"]');
    var moveTo = function (a, show) {
      if (!a) { ind.style.opacity = '0'; return; }
      ind.style.width = a.offsetWidth + 'px';
      ind.style.height = a.offsetHeight + 'px';
      ind.style.transform = 'translate(' + a.offsetLeft + 'px,' + a.offsetTop + 'px)';
      ind.style.opacity = show ? '1' : '0';
    };
    // start under the current link, invisible, so the first hover slides from there
    requestAnimationFrame(function () { moveTo(current, false); });
    $$('a', nav).forEach(function (a) {
      a.addEventListener('mouseenter', function () { moveTo(a, true); });
      a.addEventListener('focus', function () { moveTo(a, true); });
    });
    nav.addEventListener('mouseleave', function () { moveTo(current, false); });
  }

  /* ---------- Split headline into characters ---------- */
  // Walks text nodes so nested markup (e.g. <span class="accent">) keeps
  // its structure; accent characters get a per-letter colour along the
  // amber→indigo gradient (background-clip:text doesn't survive splitting).
  if (!reduce) $$('[data-split]').forEach(function (el) {
    var label = el.textContent.replace(/\s+/g, ' ').trim();
    var ci = 0;
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = d.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(' ')); return; }
            var w = d.createElement('span');
            w.className = 'word';
            Array.from(part).forEach(function (ch) {
              var c = d.createElement('span');
              c.className = 'char';
              c.textContent = ch;
              c.style.setProperty('--ci', ci++);
              w.appendChild(c);
            });
            frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          walk(child);
        }
      });
    };
    walk(el);
    $$('.accent', el).forEach(function (acc) {
      var chars = $$('.char', acc);
      chars.forEach(function (c, i) { c.style.setProperty('--t', chars.length > 1 ? i / (chars.length - 1) : 0); });
    });
    el.setAttribute('aria-label', label);
    $$('.word', el).forEach(function (w) { w.setAttribute('aria-hidden', 'true'); });
    el.classList.add('split');
  });

  /* ---------- Rotating word ---------- */
  $$('[data-rotate]').forEach(function (el) {
    var words = el.getAttribute('data-rotate').split('|');
    if (words.length < 2) return;
    el.textContent = '';
    el.setAttribute('aria-hidden', 'true');
    var sr = d.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = words.join(', ');
    el.parentNode.insertBefore(sr, el.nextSibling);
    var cur = d.createElement('span');
    cur.textContent = words[0];
    el.appendChild(cur);
    if (reduce) return;
    var i = 0;
    setInterval(function () {
      if (d.hidden) return;
      i = (i + 1) % words.length;
      var next = d.createElement('span');
      next.textContent = words[i];
      next.className = 'is-pre';
      el.appendChild(next);
      var old = cur;
      cur = next;
      void next.offsetWidth; // commit the start position before transitioning
      next.className = '';
      old.className = 'is-out';
      setTimeout(function () { if (old.parentNode) old.parentNode.removeChild(old); }, 650);
    }, 2400);
  });

  /* ---------- Scroll reveal ---------- */
  // threshold:0 — fire as soon as any part is visible. A percentage
  // threshold never fires for tall single blocks (a whole story inside
  // one card is a few % of its height on a phone), leaving it blank.
  var io = null;
  if ('IntersectionObserver' in window) {
    io = new IntersectionObserver(function (entries) {
      var batch = 0;
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        if (el.classList.contains('line')) el.style.setProperty('--d', Math.min(batch++ * 70, 900) + 'ms');
        el.classList.add('in-view');
        io.unobserve(el);
        if (el._onView) el._onView();
        // Once revealed, drop the reveal transition (and its stagger delay)
        // so hover/tilt transitions on the same element respond instantly.
        if (el.classList.contains('reveal')) {
          var delay = parseInt(el.style.getPropertyValue('--d'), 10) || 0;
          setTimeout(function () { el.classList.remove('reveal', 'in-view'); }, 900 + delay);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
  }
  function observe(el, cb) {
    if (cb) el._onView = cb;
    if (io) io.observe(el);
    else { el.classList.add('in-view'); if (cb) cb(); }
  }

  if (!reduce) {
    var targets = $$(
      '.reveal-me, .card, .about-compact, .section > h1, .section > h2, .section > p.muted, ' +
      '.page-head > *, .block-head > *, .story-row, .marquee, .cta-band, .timeline li, .footer-inner > *'
    ).filter(function (el) { return !el.closest('.hero'); });
    var groups = new Map();
    targets.forEach(function (el) {
      var parent = el.parentElement;
      var n = groups.get(parent) || 0;
      el.style.setProperty('--d', Math.min(n * 70, 420) + 'ms');
      groups.set(parent, n + 1);
      el.classList.add('reveal');
      observe(el);
    });
  }

  /* ---------- Counters ---------- */
  $$('[data-count]').forEach(function (el) {
    var target = parseFloat(el.getAttribute('data-count'));
    var suffix = el.getAttribute('data-suffix') || '';
    if (reduce || isNaN(target)) return;
    el.textContent = '0' + suffix;
    observe(el, function () {
      var t0 = null, dur = 1400 + Math.min(target, 3000) * 0.15;
      var step = function (t) {
        if (!t0) t0 = t;
        var p = Math.min(1, (t - t0) / dur);
        var e = 1 - Math.pow(1 - p, 4);
        var v = Math.round(target * e);
        el.textContent = (target >= 10000 ? v.toLocaleString('en-IN') : v) + suffix;
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  });

  /* ---------- Scroll-lit quote ---------- */
  $$('[data-scrub]').forEach(function (el) {
    if (reduce) return;
    var hl = (el.getAttribute('data-highlight') || '').split('|').filter(Boolean);
    var walk = function (node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        if (child.nodeType === 3) {
          var frag = d.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach(function (part) {
            if (!part) return;
            if (/^\s+$/.test(part)) { frag.appendChild(d.createTextNode(part)); return; }
            var w = d.createElement('span');
            w.className = 'w';
            if (hl.some(function (h) { return part.toLowerCase().indexOf(h) === 0; })) w.classList.add('hl');
            w.textContent = part;
            frag.appendChild(w);
          });
          child.parentNode.replaceChild(frag, child);
        } else if (child.nodeType === 1) walk(child);
      });
    };
    walk(el);
    var words = $$('.w', el);
    var update = function () {
      var r = el.getBoundingClientRect();
      var vh = window.innerHeight;
      var start = vh * 0.9, end = vh * 0.35;
      var p = (start - r.top) / (start - end + r.height * 0.6);
      p = Math.max(0, Math.min(1, p));
      var lit = Math.round(p * words.length);
      words.forEach(function (w, i) { w.classList.toggle('lit', i < lit); });
    };
    scrollHandlers.push(update);
    update();
  });

  /* ---------- Poem lines ---------- */
  // Wraps each line of a pre-wrap poem in a span while keeping the '\n'
  // text nodes, so textContent (used by TTS and book-export.js) is
  // byte-for-byte unchanged.
  $$('.poem-text').forEach(function (el) {
    if (reduce || !io) return;
    // leading/trailing blank lines are source-formatting only (TTS and
    // book-export.js both trim them), so drop them from the layout
    var lines = el.textContent.replace(/^\s*\n/, '').replace(/\n\s*$/, '').split('\n');
    el.textContent = '';
    lines.forEach(function (line, i) {
      if (line.trim()) {
        var s = d.createElement('span');
        s.className = 'line';
        s.textContent = line;
        el.appendChild(s);
        observe(s);
      } else if (line) {
        el.appendChild(d.createTextNode(line));
      }
      if (i < lines.length - 1) el.appendChild(d.createTextNode('\n'));
    });
  });

  /* ---------- Story reading meta + end mark ---------- */
  var storyBody = d.querySelector('.story-body');
  if (storyBody) {
    var article = storyBody.closest('article') || storyBody.parentElement;
    var h1 = article.querySelector('h1');
    var words = storyBody.textContent.trim().split(/\s+/).length;
    var mins = Math.max(1, Math.round(words / 220));
    var meta = d.createElement('div');
    meta.className = 'story-meta';
    meta.innerHTML = '<span>' + mins + ' min read</span><span>' + words.toLocaleString('en-IN') + ' words</span>';
    if (h1) h1.parentNode.insertBefore(meta, h1.nextSibling);
    // drop cap only when the opening paragraph is long enough to wrap
    // around it (a one-line "Hi Susan," would drag the next paragraph in)
    var firstP = storyBody.querySelector('p');
    if (firstP && firstP === storyBody.firstElementChild && firstP.textContent.trim().length > 180) storyBody.classList.add('dropcap');
    // Reader controls: text size and serif/sans, remembered per browser.
    // localStorage can be unavailable (private mode, blocked storage), so
    // every access is guarded and the defaults still work without it.
    var store = {
      get: function (k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window.localStorage.setItem(k, v); } catch (e) {} }
    };
    var row = article.querySelector('.story-actions');
    if (!row) {
      // book-export.js (runs after us) puts its PDF/ePub buttons in this row too
      row = d.createElement('div');
      row.className = 'story-actions';
      meta.parentNode.insertBefore(row, meta.nextSibling);
    }
    var STEPS = [0.85, 0.92, 1, 1.1, 1.22, 1.36];
    var si = STEPS.indexOf(parseFloat(store.get('rv-read-scale')));
    if (si < 0) si = 2;
    var bar = d.createElement('div');
    bar.className = 'reader-bar';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Reading settings');
    bar.innerHTML = '<button type="button" data-rs="-1" aria-label="Smaller text">A−</button>' +
      '<button type="button" data-rs="1" aria-label="Larger text">A+</button>' +
      '<button type="button" data-rf aria-pressed="false">Sans</button>';
    row.appendChild(bar);
    var fontBtn = bar.querySelector('[data-rf]');
    var sans = store.get('rv-read-font') === 'sans';
    var applyReader = function () {
      storyBody.style.setProperty('--read-scale', STEPS[si]);
      bar.querySelector('[data-rs="-1"]').disabled = si === 0;
      bar.querySelector('[data-rs="1"]').disabled = si === STEPS.length - 1;
      storyBody.classList.toggle('sans', sans);
      fontBtn.setAttribute('aria-pressed', String(sans));
    };
    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      if (btn.hasAttribute('data-rs')) {
        si = Math.max(0, Math.min(STEPS.length - 1, si + parseInt(btn.getAttribute('data-rs'), 10)));
        store.set('rv-read-scale', STEPS[si]);
      } else {
        sans = !sans;
        store.set('rv-read-font', sans ? 'sans' : 'serif');
      }
      applyReader();
    });
    applyReader();

    var end = d.createElement('div');
    end.className = 'end-mark';
    end.textContent = 'fin';
    storyBody.appendChild(end);
  }

  /* ---------- Spotlight + tilt cards ---------- */
  $$('.cards > .card, .poem-grid > .card, .worlds > .card, .stat-grid > .card, .contact-grid > .card, [data-fx]').forEach(function (card) {
    card.classList.add('fx-card');
    if (!finePointer) return;
    var tilt = !reduce && !card.hasAttribute('data-no-tilt');
    var rect = null;
    card.addEventListener('pointerenter', function () { rect = card.getBoundingClientRect(); card.classList.add('is-hover'); });
    card.addEventListener('pointermove', function (e) {
      if (!rect) rect = card.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width, y = (e.clientY - rect.top) / rect.height;
      card.style.setProperty('--x', (x * 100) + '%');
      card.style.setProperty('--y', (y * 100) + '%');
      if (tilt) {
        var max = card.offsetWidth > 600 ? 2.5 : 5;
        card.style.setProperty('--rx', ((0.5 - y) * max).toFixed(2) + 'deg');
        card.style.setProperty('--ry', ((x - 0.5) * max).toFixed(2) + 'deg');
      }
    });
    card.addEventListener('pointerleave', function () {
      rect = null;
      card.classList.remove('is-hover');
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------- Magnetic buttons ---------- */
  if (finePointer && !reduce) $$('.btn, .feature .go').forEach(function (btn) {
    if (btn.closest('.main-nav')) return;
    var strength = btn.classList.contains('primary') ? 0.35 : 0.22;
    btn.addEventListener('pointermove', function (e) {
      var r = btn.getBoundingClientRect();
      btn.style.setProperty('--mx', ((e.clientX - r.left - r.width / 2) * strength).toFixed(1) + 'px');
      btn.style.setProperty('--my', ((e.clientY - r.top - r.height / 2) * strength).toFixed(1) + 'px');
    });
    btn.addEventListener('pointerleave', function () {
      btn.style.setProperty('--mx', '0px');
      btn.style.setProperty('--my', '0px');
    });
  });

  /* ---------- Cursor glow ---------- */
  if (finePointer && !reduce) {
    var glow = d.createElement('div');
    glow.className = 'cursor-glow';
    glow.setAttribute('aria-hidden', 'true');
    d.body.appendChild(glow);
    var gx = -999, gy = -999, tx = -999, ty = -999, raf = 0;
    var tick = function () {
      gx += (tx - gx) * 0.14; gy += (ty - gy) * 0.14;
      glow.style.transform = 'translate3d(' + gx.toFixed(1) + 'px,' + gy.toFixed(1) + 'px,0)';
      raf = (Math.abs(tx - gx) + Math.abs(ty - gy) > 0.5) ? requestAnimationFrame(tick) : 0;
    };
    window.addEventListener('pointermove', function (e) {
      if (gx === -999) { gx = e.clientX; gy = e.clientY; }
      tx = e.clientX; ty = e.clientY;
      if (!raf) raf = requestAnimationFrame(tick);
    }, { passive: true });
    d.addEventListener('mouseleave', function () { glow.style.opacity = '0'; });
    d.addEventListener('mouseenter', function () { glow.style.opacity = '1'; });
  }

  /* ---------- Portrait tilt ---------- */
  if (finePointer && !reduce) $$('[data-tilt-portrait]').forEach(function (p) {
    var zone = p.closest('section') || p;
    zone.addEventListener('pointermove', function (e) {
      var r = p.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / window.innerWidth;
      var y = (e.clientY - (r.top + r.height / 2)) / window.innerHeight;
      p.style.setProperty('--ry', (x * 14).toFixed(2) + 'deg');
      p.style.setProperty('--rx', (-y * 14).toFixed(2) + 'deg');
    });
    zone.addEventListener('pointerleave', function () {
      p.style.setProperty('--rx', '0deg'); p.style.setProperty('--ry', '0deg');
    });
  });

  /* ---------- Project filters ---------- */
  $$('[data-filters]').forEach(function (bar) {
    var grid = d.querySelector(bar.getAttribute('data-filters'));
    if (!grid) return;
    var items = $$('[data-cat]', grid);
    var buttons = $$('[data-filter]', bar);
    buttons.forEach(function (b) {
      var f = b.getAttribute('data-filter');
      var n = f === 'all' ? items.length : items.filter(function (it) { return it.getAttribute('data-cat') === f; }).length;
      var badge = d.createElement('span');
      badge.className = 'n';
      badge.textContent = n;
      b.appendChild(badge);
      b.addEventListener('click', function () {
        if (b.getAttribute('aria-pressed') === 'true') return;
        var apply = function () {
          buttons.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
          items.forEach(function (it) {
            it.classList.toggle('is-hidden', f !== 'all' && it.getAttribute('data-cat') !== f);
            it.classList.add('in-view');
          });
        };
        if (d.startViewTransition && !reduce) {
          items.forEach(function (it, i) { it.style.viewTransitionName = 'proj-' + i; });
          var vt = d.startViewTransition(apply);
          vt.finished.finally(function () { items.forEach(function (it) { it.style.viewTransitionName = ''; }); });
        } else apply();
      });
    });
  });

  /* ---------- Copy to clipboard ---------- */
  $$('[data-copy]').forEach(function (btn) {
    var label = btn.textContent;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var text = btn.getAttribute('data-copy');
      var done = function () {
        btn.textContent = 'Copied ✓';
        btn.classList.add('is-done');
        setTimeout(function () { btn.textContent = label; btn.classList.remove('is-done'); }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () {});
    });
  });

  onScroll();
})();
