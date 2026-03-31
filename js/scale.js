/**
 * co:lab — Viewport Scale System
 *
 * Design baseline: 1440 × 900px (master artboard).
 * All CSS values are authored for this size.
 *
 * This script applies a proportional CSS zoom to <html> so that
 * every element — including position:fixed — scales uniformly
 * across all desktop and tablet breakpoints (768px–3840px).
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
 *
 * Mobile (<768px) is excluded — handled separately.
 */

(function () {
  'use strict';

  var DESIGN_WIDTH  = 1440;  // px — master artboard width
  var DESIGN_HEIGHT = 900;   // px — master artboard height
  var MOBILE_BP     = 768;   // px — below this, skip scaling (handled later)

  function applyScale() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;

    // Mobile: remove any zoom and bail — mobile layout handled separately
    if (vw < MOBILE_BP) {
      document.documentElement.style.zoom = '';
      return;
    }

    // Scale by whichever axis is the limiting constraint.
    // This prevents content from being taller or wider than the viewport.
    var scaleW = vw / DESIGN_WIDTH;
    var scaleH = vh / DESIGN_HEIGHT;
    var scale  = Math.min(scaleW, scaleH);

    // Round to 4 decimal places to avoid sub-pixel churn on resize
    scale = Math.round(scale * 10000) / 10000;

    // Apply zoom to <html> — browser multiplies all layout units by this value
    document.documentElement.style.zoom = scale;
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
