/* ============================================================
   ABOUT — Depth-scroll boot (live HTML sections)
   Architecture:
     Section 1 = existing studio-display + 3 studio-meta blocks
                 (live HTML/SVG, unchanged markup).
     Section 2 = .about-section--2 — composite layout using
                 about_us / about_us-02 / about_us-03 webps + live
                 <p> copy.
     Section 3 = .about-section--3 — invoice / quotation layout,
                 live text only.
   Sections are stacked in the same DOM, overlayed via absolute
   positioning. /js/depth-gallery.js provides only the scroll
   engine (lerp + velocity + wheel/touch handlers). The WebGL
   plane render path is unused — we pass an empty image list and
   override the scroll bounds so the engine acts purely as a
   "scroll clock". A single RAF tick reads gallery.scrollCurrent
   and drives opacity / scale / blur on each section so they
   crossfade as the camera value advances:

       scrollCurrent            Section visibility
       ─────────────            ──────────────────
       0                        S1 full,  S2 0,    S3 0
       FADE_LEN                 S1 0,     S2 full, S3 0
       FADE_LEN+SECTION_GAP     S2 still full — held at rest
       2·FADE_LEN+SECTION_GAP   S1 0,     S2 0,    S3 full

   Within each FADE_LEN-unit segment the transition uses a smoothstep
   easing curve, matching the look of the depth gallery's
   noise-dissolve crossfade between project planes. SECTION_GAP holds
   each section fully visible between transitions, spacing them apart.
   ============================================================ */
(function () {
  'use strict';

  /* Per-section scroll ranges (in scroll units — same scale as
     gallery.scrollCurrent). Each range is a half-open interval
     [start, end] where the transition runs from 0 → 1.

     FADE_LEN    — scroll units one section takes to dissolve into
                   the next. Larger = the gallery advances more
                   slowly per unit of scroll input.
     SECTION_GAP — scroll units a section stays fully visible, at
                   rest, between transitions. Larger = more distance
                   between sections. */
  var FADE_LEN    = 390;
  var SECTION_GAP = 220;
  var SECTION_BOUNDARIES = {
    s1Exit:  [0, FADE_LEN],                                        /* section 1 fades out */
    s2Enter: [0, FADE_LEN],                                        /* section 2 fades in  */
    s2Exit:  [FADE_LEN + SECTION_GAP, FADE_LEN * 2 + SECTION_GAP],  /* section 2 fades out */
    s3Enter: [FADE_LEN + SECTION_GAP, FADE_LEN * 2 + SECTION_GAP]   /* section 3 fades in  */
  };
  /* Total scroll range — one extra SECTION_GAP past s3Enter end so
     section 3 has a "rest" tail before the bounds clamp. */
  var TOTAL_SCROLL = FADE_LEN * 2 + SECTION_GAP * 2;

  /* Convert TOTAL_SCROLL to a camera-Z range. The gallery converts
     scroll → camera-Z via scrollToWorldFactor (default 0.02). */
  var SCROLL_TO_WORLD = 0.02;
  var CAM_RANGE = TOTAL_SCROLL * SCROLL_TO_WORLD;  /* ≈ 24.4 units */

  var gallery = null;
  var activeContainer = null;
  var initInFlight = false;
  var sectionRaf = null;
  var sectionSetupTimer = null;
  var sectionRefs = null;

  /* ─────────────────────────────────────────────────────────────
     Easing — same curve used by the depth gallery's plane blend
     ───────────────────────────────────────────────────────────── */
  function smoothstep(a, b, x) {
    if (x <= a) return 0;
    if (x >= b) return 1;
    var t = (x - a) / (b - a);
    return t * t * (3 - 2 * t);
  }

  /* ─────────────────────────────────────────────────────────────
     Scope resolver — supports Barba's container or cold-load
     ───────────────────────────────────────────────────────────── */
  function resolveScope(nextContainer) {
    if (nextContainer && nextContainer.querySelector) return nextContainer;
    var nodes = document.querySelectorAll('[data-barba-namespace="about"]');
    if (nodes.length) return nodes[nodes.length - 1];
    return document;
  }

  /* ─────────────────────────────────────────────────────────────
     Section driver — per-frame style writes
     ───────────────────────────────────────────────────────────── */
  function collectRefs(scope) {
    return {
      s1Img:   scope.querySelector('.studio-display-img'),
      s1Metas: scope.querySelectorAll('.studio-meta'),
      s2:      scope.querySelector('.about-section--2'),
      s3:      scope.querySelector('.about-section--3')
    };
  }

  function driveSections(s) {
    if (!sectionRefs) return;

    /* ── Section 1 — dissolves out 0 → FADE_LEN ── */
    var s1ExitE = smoothstep(SECTION_BOUNDARIES.s1Exit[0],
                             SECTION_BOUNDARIES.s1Exit[1], s);
    var s1Opacity = 1 - s1ExitE;
    if (sectionRefs.s1Img) {
      sectionRefs.s1Img.style.opacity   = s1Opacity;
      sectionRefs.s1Img.style.transform = 'scale(' + (1 + s1ExitE * 0.45) + ')';
      sectionRefs.s1Img.style.filter    = 'blur(' + (s1ExitE * 22) + 'px)';
    }
    for (var i = 0; i < sectionRefs.s1Metas.length; i++) {
      sectionRefs.s1Metas[i].style.opacity = s1Opacity;
    }

    /* ── Section 2 — fades in 0 → FADE_LEN, fades out FADE_LEN → 2× ── */
    if (sectionRefs.s2) {
      var s2EnterE = smoothstep(SECTION_BOUNDARIES.s2Enter[0],
                                SECTION_BOUNDARIES.s2Enter[1], s);
      var s2ExitE  = smoothstep(SECTION_BOUNDARIES.s2Exit[0],
                                SECTION_BOUNDARIES.s2Exit[1], s);
      var s2Opacity = s2EnterE * (1 - s2ExitE);
      sectionRefs.s2.style.opacity   = s2Opacity;
      sectionRefs.s2.style.transform = 'scale(' + (1 + s2ExitE * 0.45) + ')';
      sectionRefs.s2.style.filter    = 'blur(' + (s2ExitE * 22) + 'px)';
      /* a11y / pointer toggle — flip when the section is meaningfully visible */
      var s2Active = s2Opacity > 0.05;
      sectionRefs.s2.classList.toggle('is-active', s2Active);
    }

    /* ── Section 3 — fades in FADE_LEN → 2× FADE_LEN ── */
    if (sectionRefs.s3) {
      var s3EnterE = smoothstep(SECTION_BOUNDARIES.s3Enter[0],
                                SECTION_BOUNDARIES.s3Enter[1], s);
      sectionRefs.s3.style.opacity = s3EnterE;
      var s3Active = s3EnterE > 0.05;
      sectionRefs.s3.classList.toggle('is-active', s3Active);
    }
  }

  function startSectionDriver(scope) {
    sectionRefs = collectRefs(scope);
    if (!sectionRefs.s1Img) return;

    /* Wait for the existing entrance reveal (title-reveal.js applies
       .is-revealed ~1.5s after page load; the CSS transition is 1.8s).
       After ~2.2s the transition is done — flip about-scroll-active
       so the CSS strips that transition and own the inline styles. */
    sectionSetupTimer = setTimeout(function () {
      document.body.classList.add('about-scroll-active');
      tick();
    }, 2200);

    function tick() {
      if (!gallery) return;
      var s = Math.max(0, gallery.scrollCurrent);
      driveSections(s);
      sectionRaf = requestAnimationFrame(tick);
    }
  }

  function stopSectionDriver() {
    if (sectionSetupTimer) { clearTimeout(sectionSetupTimer); sectionSetupTimer = null; }
    if (sectionRaf)        { cancelAnimationFrame(sectionRaf);  sectionRaf = null; }
    document.body.classList.remove('about-scroll-active');
    sectionRefs = null;
  }

  /* ─────────────────────────────────────────────────────────────
     GALLERY INIT / DESTROY
     The gallery is started with ZERO images. Its WebGL render
     path is dormant (no planes). We override the camera-Z range
     so the engine clamps scrollCurrent to [0, TOTAL_SCROLL].
     ───────────────────────────────────────────────────────────── */
  function initGallery(scope) {
    var canvas = scope.querySelector('[data-depth-canvas]');
    var wrap   = scope.querySelector('[data-about-canvas-wrap]');
    if (!canvas || !wrap) return;

    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    stopSectionDriver();

    canvas.style.display = 'block';

    gallery = new DepthGallery();
    gallery.init(canvas, wrap, []);   /* no planes — engine is scroll-only */

    /* Strip all auto-motion */
    gallery.pauseIdle();
    gallery._idleSpeed       = 0;
    gallery._autoScrollSpeed = 0;

    /* Manual scroll bounds — overrides what _initScrollBounds would
       set (it returns early when there are no planes, leaving
       camera-Z at ±Infinity). cameraStartZ / max/min control the
       [minScroll, maxScroll] clamp inside _updateScroll. */
    gallery.cameraStartZ = 0;
    gallery.maxCameraZ   = 0;
    gallery.minCameraZ   = -CAM_RANGE;
    gallery.scrollTarget = 0;
    gallery.scrollCurrent = 0;
    gallery.prevScrollCurrent = 0;
    if (gallery.camera) gallery.camera.position.z = 0;

    /* No onReachEnd / onEndLabelReveal — scroll simply clamps at
       maxScroll. Section 3 stays at rest there. */

    gallery.start();
    startSectionDriver(scope);

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
    stopSectionDriver();
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
