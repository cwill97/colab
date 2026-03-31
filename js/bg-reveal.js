/**
 * bg-reveal.js
 * The mask uses a fixed-position element, so coordinates must be
 * relative to the viewport — clientX/clientY are correct for this.
 * The spotlight center is pinned exactly to the cursor tip via lerp.
 */

(function () {
  const root = document.documentElement;

  let targetX = window.innerWidth  / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  let active   = false;
  let animating = false;

  const LERP = 0.055;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function tick() {
    currentX = lerp(currentX, targetX, LERP);
    currentY = lerp(currentY, targetY, LERP);

    // Use percentage of viewport so the fixed layer aligns perfectly
    const pctX = (currentX / window.innerWidth  * 100).toFixed(3) + '%';
    const pctY = (currentY / window.innerHeight * 100).toFixed(3) + '%';

    root.style.setProperty('--cx', pctX);
    root.style.setProperty('--cy', pctY);

    const dx = targetX - currentX;
    const dy = targetY - currentY;
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) {
      requestAnimationFrame(tick);
    } else {
      animating = false;
    }
  }

  function activate(x, y) {
    targetX = x;
    targetY = y;

    if (!active) {
      active = true;
      document.body.classList.add('cursor-active');
    }

    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  function deactivate() {
    active = false;
    document.body.classList.remove('cursor-active');
  }

  /* ── Desktop: mouse ── */
  document.addEventListener('mousemove', function (e) {
    activate(e.clientX, e.clientY);
  }, { passive: true });

  document.addEventListener('mouseleave', deactivate, { passive: true });

  /* ── Mobile: press + hold / drag ── */
  document.addEventListener('touchstart', function (e) {
    var touch = e.touches[0];
    if (touch) activate(touch.clientX, touch.clientY);
  }, { passive: true });

  document.addEventListener('touchmove', function (e) {
    var touch = e.touches[0];
    if (touch) activate(touch.clientX, touch.clientY);
  }, { passive: true });

  document.addEventListener('touchend', deactivate, { passive: true });
  document.addEventListener('touchcancel', deactivate, { passive: true });
})();
