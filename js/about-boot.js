/* ============================================================
   ABOUT — Depth-gallery boot
   Architecture:
     Section 1 = live HTML (.studio-display + .studio-meta) — stays
                 in the DOM, dissolves forward via JS-driven CSS as
                 the user scrolls.
     Sections 2+ = baked WebPs rendered on WebGL planes by
                   /js/depth-gallery.js, layered BEHIND the section-1
                   HTML on the same canvas envelope.

   The depth engine (camera, scroll lerp, velocity, parallax, breath,
   noise-dissolve reveal shader) is reused unchanged. Differences
   from /js/project-boot:
     - All auto-scroll disabled (idle + touch-hold).
     - No end-of-gallery cue / overscroll commit.
     - Plane x-offsets zeroed (text is baked in — no side-to-side
       drift).
     - Device-specific texture per section: { desktop, mobile }.
     - A separate RAF loop polls gallery.scrollCurrent and drives
       section-1's CSS so the HTML appears to rush forward and
       dissolve out as the camera advances into the depth planes.
   ============================================================ */
(function () {
  'use strict';

  /* Depth planes — section 1 is HTML, NOT in this list.
     Each entry can supply per-device WebPs; until mobile variants
     exist, both keys point at the same file. */
  var SECTIONS = [
    { desktop: '/assets/about_us-02.webp', mobile: '/assets/about_us-02.webp' },
    { desktop: '/assets/about_us-03.webp', mobile: '/assets/about_us-03.webp' }
  ];

  /* Scroll range over which section 1 fully dissolves (in scroll
     units, same scale as gallery.scrollCurrent). Roughly matches
     one plane's worth of scroll (planeGap / scrollToWorldFactor
     = 6 / 0.02 = 300), tuned slightly shorter so section 1 is
     gone before the section-2→3 crossfade ramps up. */
  var SECTION1_FADE_RANGE = 260;

  var gallery = null;
  var activeContainer = null;
  var initInFlight = false;
  var section1Raf = null;
  var section1SetupTimer = null;

  function pickImages() {
    var isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    return SECTIONS.map(function (s) {
      return isMobile ? (s.mobile || s.desktop) : (s.desktop || s.mobile);
    });
  }

  function resolveScope(nextContainer) {
    if (nextContainer && nextContainer.querySelector) return nextContainer;
    var nodes = document.querySelectorAll('[data-barba-namespace="about"]');
    if (nodes.length) return nodes[nodes.length - 1];
    return document;
  }

  /* ─────────────────────────────────────────────────────────────
     SECTION 1 SCROLL DRIVER
     Polls gallery.scrollCurrent each frame and writes inline CSS
     onto the section-1 elements. Easing matches the gallery's
     own smoothing so the HTML's exit feels continuous with the
     depth planes behind it.
     ───────────────────────────────────────────────────────────── */
  function startSection1Driver(scope) {
    var display = scope.querySelector('.studio-display');
    var img     = display && display.querySelector('.studio-display-img');
    var metas   = scope.querySelectorAll('.studio-meta');
    if (!display || !img) return;

    /* Wait for the existing entrance reveal (title-reveal.js applies
       .is-revealed ~1.5s after page load; the CSS transition is 1.8s).
       After ~2.2s the transition is done — kill it and own the
       inline styles. The .about-scroll-active class on <body> drops
       the CSS transition so per-frame writes are immediate. */
    section1SetupTimer = setTimeout(function () {
      document.body.classList.add('about-scroll-active');
      tick();
    }, 2200);

    function tick() {
      if (!gallery) return;
      var s = Math.max(0, gallery.scrollCurrent);
      var t = Math.min(1, s / SECTION1_FADE_RANGE);
      /* Smoothstep — softens the start and end of the fade */
      var ease = t * t * (3 - 2 * t);

      var opacity = 1 - ease;

      /* Title: opacity + scale (forward-toward-camera) + blur
         (out-of-focus as it passes). Applied to the inner <img>
         which has no positional transform to overwrite. */
      img.style.opacity   = opacity;
      img.style.transform = 'scale(' + (1 + ease * 0.45) + ')';
      img.style.filter    = 'blur(' + (ease * 22) + 'px)';

      /* Meta blocks — opacity only. Their existing CSS transforms
         handle positioning (translate -50%); overwriting would
         break the centering. */
      for (var i = 0; i < metas.length; i++) {
        metas[i].style.opacity = opacity;
      }

      section1Raf = requestAnimationFrame(tick);
    }
  }

  function stopSection1Driver() {
    if (section1SetupTimer) { clearTimeout(section1SetupTimer); section1SetupTimer = null; }
    if (section1Raf)        { cancelAnimationFrame(section1Raf); section1Raf = null; }
    document.body.classList.remove('about-scroll-active');
  }

  /* ─────────────────────────────────────────────────────────────
     GALLERY INIT / DESTROY
     ───────────────────────────────────────────────────────────── */
  function initGallery(scope) {
    var canvas = scope.querySelector('[data-depth-canvas]');
    var wrap   = scope.querySelector('[data-about-canvas-wrap]');
    if (!canvas || !wrap) return;

    /* Safe across hot Barba swaps */
    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    stopSection1Driver();

    canvas.style.display = 'block';

    gallery = new DepthGallery();
    gallery.init(canvas, wrap, pickImages());

    /* ── Strip all auto-motion ─────────────────────────────────
       The engine's idle drift + touch hold-to-scroll are killed.
       Scroll is purely input-driven. */
    gallery.pauseIdle();
    gallery._idleSpeed       = 0;
    gallery._autoScrollSpeed = 0;

    /* ── Centre every plane ────────────────────────────────────
       Project-mode uses PLANE_X_OFFSETS for side-to-side rhythm;
       About text is baked into each image, so any x drift reads
       as the page wobbling. Flatten basePos.x to 0. */
    gallery.planes.forEach(function (p) {
      if (p.userData && p.userData.basePos) p.userData.basePos.x = 0;
    });

    /* No onReachEnd / onEndLabelReveal — the engine's bounds
       clamp at [minScroll, maxScroll] in _updateScroll(), so the
       camera simply stops at the final section. */

    gallery.start();
    startSection1Driver(scope);

    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
    });
  }

  function waitForLibsThen(fn) {
    if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') {
      fn();
    } else {
      setTimeout(function () { waitForLibsThen(fn); }, 50);
    }
  }

  function bootInto(scope) {
    if (initInFlight) return;
    initInFlight = true;
    waitForLibsThen(function () {
      initInFlight = false;
      initGallery(scope);
    });
  }

  function destroy() {
    stopSection1Driver();
    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    document.body.classList.remove('is-ready');
  }

  /* Cold-load: only auto-boot if About is what loaded. */
  if (document.body.classList.contains('about-page')) {
    bootInto(resolveScope(null));
  }

  /* Barba hook — called from /js/barba-init.js enter(about). */
  window.colabAbout = {
    init: function (nextContainer) {
      activeContainer = resolveScope(nextContainer);
      bootInto(activeContainer);
    },
    destroy: destroy
  };
}());
