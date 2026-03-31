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

  function onMouseMove(e) {
    targetX = e.clientX;
    targetY = e.clientY;

    if (!active) {
      active = true;
      document.body.classList.add('cursor-active');
    }

    if (!animating) {
      animating = true;
      requestAnimationFrame(tick);
    }
  }

  function onMouseLeave() {
    active = false;
    document.body.classList.remove('cursor-active');
  }

  document.addEventListener('mousemove', onMouseMove, { passive: true });
  document.addEventListener('mouseleave', onMouseLeave, { passive: true });
})();
