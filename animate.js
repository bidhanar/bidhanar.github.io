/* animate.js — lightweight scroll-reveal.
   Progressive enhancement: elements only get the .reveal (hidden) class if
   this script actually runs, so nothing breaks if JS is unavailable. Bails
   out entirely for users who've asked for reduced motion. */
(function () {
  var prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) return;

  var targets = document.querySelectorAll(
    '.card, .hero-left, .hero-right, .about-compact, .story-container, .skill, .section > h1, .section > h2'
  );
  if (!targets.length) return;

  var groups = new Map(); // stagger delay per parent container, reset for each container
  targets.forEach(function (el) {
    var parent = el.parentElement;
    var count = groups.get(parent) || 0;
    el.style.setProperty('--d', Math.min(count * 60, 360) + 'ms');
    groups.set(parent, count + 1);
    el.classList.add('reveal');
  });

  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('in-view'); });
    return;
  }

  // threshold:0 — fire as soon as ANY part of a target intersects, not once
  // a fraction of its own height is visible. A percentage threshold breaks
  // for tall single-block targets (e.g. .story-container wrapping an
  // entire long story): on a phone-height viewport, the visible slice can
  // be a couple percent of the element's total height and never cross a
  // 12% bar, leaving it stuck at opacity:0 — a permanently blank page.
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach(function (el) { io.observe(el); });
})();
