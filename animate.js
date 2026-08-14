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

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  targets.forEach(function (el) { io.observe(el); });
})();
