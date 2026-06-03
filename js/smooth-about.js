/* ============================================================
   Smooth scroll for the Studio (about) page.
   Uses Lenis (Studio Freight) — natively handles macOS trackpad
   input where Locomotive Scroll v4 falls short. Lenis smooths
   the *native* browser scroll via rAF transforms, so no
   data-scroll-container wrapper or overflow:hidden lock is
   needed; html/body keep their normal auto-overflow.
   ============================================================ */
(function () {
  'use strict';

  var lenis = null;
  var rafId = null;

  function loop(time) {
    if (lenis) lenis.raf(time);
    rafId = requestAnimationFrame(loop);
  }

  function init() {
    destroy();
    if (typeof Lenis === 'undefined') return;

    lenis = new Lenis({
      duration: 1.2,
      easing: function (t) { return Math.min(1, 1.001 - Math.pow(2, -10 * t)); },
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 1.0,
      touchMultiplier: 2.0,
      lerp: 0.1
    });

    rafId = requestAnimationFrame(loop);
    window.colabLenis = lenis;
  }

  function destroy() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (lenis) {
      lenis.destroy();
      lenis = null;
    }
    window.colabLenis = null;
    /* Reset scroll position when leaving the page so the next entry
       starts at the top of its own content. */
    if (typeof window !== 'undefined') window.scrollTo(0, 0);
  }

  /* Same exported name as the old Locomotive module so callers in
     barba-init.js work without changes. */
  window.colabLocoAbout = { init: init, destroy: destroy };

  function waitForLib(cb, attempts) {
    if (typeof Lenis !== 'undefined') return cb();
    if ((attempts || 0) > 60) return;
    setTimeout(function () { waitForLib(cb, (attempts || 0) + 1); }, 50);
  }

  if (document.body && document.body.classList.contains('about-page')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { waitForLib(init); });
    } else {
      waitForLib(init);
    }
  }
}());
