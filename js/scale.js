/**
 * co:lab — Viewport Scale System
 *
 * Two design baselines:
 *   Desktop/tablet (≥768px): 1440 × 900px master artboard
 *   Mobile        (<768px):  393  × 852px (iPhone 14 Pro — source of truth)
 *
 * All CSS values are authored against the matching baseline.
 *
 * This script applies a proportional CSS zoom to <html> so that
 * every element — including position:fixed — scales uniformly
 * across all breakpoints. Same approach, two reference frames.
 *
 * Scale is derived from BOTH viewport dimensions:
 *   scale = min(vw / DESIGN_WIDTH, vh / DESIGN_HEIGHT)
 * This guarantees the layout always fits inside the viewport
 * on both axes — nothing gets pushed off-screen when the
 * viewport is wider but shorter than the design artboard.
 *
 * "zoom" is used (not transform:scale) because:
 *  - zoom scales position:fixed elements correctly relative to viewport
 *  - zoom avoids the stacking-context issues of transform
 *  - zoom is supported in all modern browsers (Chrome, Safari, Firefox 126+, Edge)
 *  - media queries are evaluated against the actual viewport, NOT the
 *    zoomed logical viewport — so @media (max-width: 767px) still fires
 *    correctly on every iPhone after zoom is applied.
 */

(function () {
  'use strict';

  var DESKTOP_W = 1440;  // px — desktop master artboard width
  var DESKTOP_H = 900;   // px — desktop master artboard height

  var MOBILE_W  = 393;   // px — iPhone 14 Pro width  (design source of truth)
  var MOBILE_H  = 852;   // px — iPhone 14 Pro height

  var MOBILE_BP = 768;   // px — below this, use the mobile baseline

  function applyScale() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    var designW, designH;
    if (vw < MOBILE_BP) {
      designW = MOBILE_W;
      designH = MOBILE_H;
    } else {
      designW = DESKTOP_W;
      designH = DESKTOP_H;
    }

    // Scale by whichever axis is the limiting constraint.
    // This prevents content from being taller or wider than the viewport.
    var scaleW = vw / designW;
    var scaleH = vh / designH;
    var scale  = Math.min(scaleW, scaleH);

    // Round to 4 decimal places to avoid sub-pixel churn on resize
    scale = Math.round(scale * 10000) / 10000;

    // Apply zoom to <html> — browser multiplies all layout units by this value
    var root = document.documentElement;
    root.style.zoom = scale;

    // ---- Real-viewport custom properties --------------------------
    // Browsers resolve `vh`/`vw` against the ACTUAL viewport and then
    // multiply the result by zoom — so `100vh` on a zoomed page
    // overflows the screen. Expose unzoomed values for CSS that needs
    // to express "fill the actual viewport" (modals, canvas heights).
    //
    //   --rvw  = vw / zoom   (logical-px width of the actual viewport)
    //   --rvh  = vh / zoom   (logical-px height of the actual viewport)
    //   --rdvh = same, kept for parity with `100dvh` usage sites
    //
    // After zoom is applied, `width: var(--rvw)` renders to vw actual px,
    // which is what the author of `100vw` intended.
    var rvw = Math.round((vw / scale) * 100) / 100;
    var rvh = Math.round((vh / scale) * 100) / 100;
    root.style.setProperty('--rvw',  rvw + 'px');
    root.style.setProperty('--rvh',  rvh + 'px');
    root.style.setProperty('--rdvh', rvh + 'px');
  }

  // Apply immediately (synchronous) to avoid a flash of unscaled layout
  applyScale();

  // Re-apply on resize (debounced to ~60fps)
  var rafPending = false;
  window.addEventListener('resize', function () {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      applyScale();
      rafPending = false;
    });
  }, { passive: true });

}());
