/* reader-zoom.js — +/- reading-size control for long-form story/poem pages.
   Two round, themed buttons pinned to the side of the viewport
   (position:fixed — independent of page scroll). Growing the zoom level
   enlarges both the body text AND the story/poem's bounding box itself,
   so it actually spreads into the free margin on wide screens instead of
   just inflating text inside an unchanged box. Double-click either button
   to reset to 100%. Persists across pages via localStorage. */
(function () {
  var target = document.querySelector('.story-body, .poem-text, .poem-body');
  if (!target) return;

  var STEP = 0.1, MIN = 0.8, MAX = 1.8, KEY = 'readerZoom';
  var SIDE_MARGIN = 32; // px kept clear on each side of the viewport at max zoom

  var box = target.closest('.card') || target;
  var mainContainer = document.querySelector('main.container');

  var baseFont = parseFloat(getComputedStyle(target).fontSize) || 16;
  var baseBoxWidth = box.getBoundingClientRect().width;

  var zoom = parseFloat(localStorage.getItem(KEY)) || 1;
  if (isNaN(zoom) || zoom < MIN || zoom > MAX) zoom = 1;

  function maxAllowedWidth() {
    return window.innerWidth - SIDE_MARGIN * 2;
  }

  function apply() {
    target.style.fontSize = (baseFont * zoom) + 'px';

    var desiredWidth = Math.min(baseBoxWidth * zoom, maxAllowedWidth());
    box.style.maxWidth = desiredWidth + 'px';
    if (mainContainer && mainContainer !== box) {
      mainContainer.style.maxWidth = desiredWidth + 'px';
    }

    plus.disabled = zoom >= MAX - 1e-9;
    minus.disabled = zoom <= MIN + 1e-9;
    wrap.setAttribute('aria-label', 'Text size ' + Math.round(zoom * 100) + '%');
  }

  function setZoom(z) {
    zoom = Math.min(MAX, Math.max(MIN, Math.round(z * 10) / 10));
    localStorage.setItem(KEY, zoom);
    apply();
  }

  var wrap = document.createElement('div');
  wrap.className = 'reader-zoom';
  wrap.setAttribute('role', 'group');

  var plus = document.createElement('button');
  plus.type = 'button';
  plus.className = 'reader-zoom-btn grow';
  plus.textContent = '+';
  plus.title = 'Increase reading size (double-click to reset)';
  plus.setAttribute('aria-label', 'Increase text and box size');

  var minus = document.createElement('button');
  minus.type = 'button';
  minus.className = 'reader-zoom-btn shrink';
  minus.textContent = '−';
  minus.title = 'Decrease reading size (double-click to reset)';
  minus.setAttribute('aria-label', 'Decrease text and box size');

  plus.addEventListener('click', function () { setZoom(zoom + STEP); });
  minus.addEventListener('click', function () { setZoom(zoom - STEP); });
  plus.addEventListener('dblclick', function () { setZoom(1); });
  minus.addEventListener('dblclick', function () { setZoom(1); });

  wrap.appendChild(plus);
  wrap.appendChild(minus);
  document.body.appendChild(wrap);

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(apply, 120);
  });

  apply();
})();
