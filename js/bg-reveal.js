
(function () {
  const root = document.documentElement;

  /* ================================================================
     CURSOR SPOTLIGHT (existing behaviour — unchanged)
     ================================================================ */
  let targetX = window.innerWidth  / 2;
  let targetY = window.innerHeight / 2;
  let currentX = targetX;
  let currentY = targetY;

  let active   = false;
  let animating = false;

  const LERP = 0.15;

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


  /* ================================================================
     AMBIENT AUTO-REVEAL SPOTS
     Pools a small number of div overlays. Each one fades in at a
     random viewport position, holds briefly, then fades out —
     giving the blue background a living, breathing quality.
     ================================================================ */

  var POOL_SIZE      = 3;       // max simultaneous spots
  var SPAWN_MIN      = 900;     // ms between spawns (min)
  var SPAWN_MAX      = 1250;    // ms between spawns (max)
  var FADE_IN        = 600;     // ms to fade in
  var HOLD           = 600;     // ms fully visible
  var FADE_OUT       = 1300;    // ms to fade out
  var RADIUS_MIN     = 90;      // px — smallest ambient spot
  var RADIUS_MAX     = 300;     // px — largest ambient spot
  var MARGIN         = 0.08;    // keep spots 8% away from edges
  var DRIFT_MIN      = 15;      // px — minimum drift distance
  var DRIFT_MAX      = 40;      // px — maximum drift distance

  var pool = [];
  var ambientTimer = null;

  /**
   * Each pool entry has TWO elements: one in the body (visible on the
   * homepage / project page) and a twin inside .site-menu (visible when
   * the overlay menu is open). Both animate in lockstep so the effect
   * is seamless regardless of which layer is showing.
   */
  function createSpot() {
    /* Body-level spot — sits behind cursor hover layer */
    var el = document.createElement('div');
    el.className = 'bg-ambient-spot';
    el.setAttribute('aria-hidden', 'true');
    var firstHover = document.querySelector('body > .bg-hover-layer');
    if (firstHover && firstHover.parentNode) {
      firstHover.parentNode.insertBefore(el, firstHover);
    } else {
      document.body.appendChild(el);
    }

    /* Menu-level twin — sits behind menu's own hover layer */
    var twin = document.createElement('div');
    twin.className = 'bg-ambient-spot';
    twin.setAttribute('aria-hidden', 'true');
    var menu = document.querySelector('[data-nav-menu]');
    if (menu) {
      var menuHover = menu.querySelector('.bg-hover-layer');
      if (menuHover) {
        menu.insertBefore(twin, menuHover);
      } else {
        menu.insertBefore(twin, menu.firstChild);
      }
    }

    return { el: el, twin: twin, busy: false };
  }

  function initPool() {
    for (var i = 0; i < POOL_SIZE; i++) {
      pool.push(createSpot());
    }
  }

  function getFreeSpot() {
    for (var i = 0; i < pool.length; i++) {
      if (!pool[i].busy) return pool[i];
    }
    return null;
  }

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  /** Random drift in viewport-% units */
  function randomDrift() {
    var angle = Math.random() * Math.PI * 2;
    var dist  = randomBetween(DRIFT_MIN, DRIFT_MAX);
    /* Convert px drift to % of viewport so mask position stays in % */
    var dx = (Math.cos(angle) * dist) / window.innerWidth  * 100;
    var dy = (Math.sin(angle) * dist) / window.innerHeight * 100;
    return { dx: dx, dy: dy };
  }

  var LIFE = FADE_IN + HOLD + FADE_OUT;

  /* Smooth ease-out curve for drift */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  /** Build the mask gradient string for a given center position */
  function buildGrad(radius, core, cx, cy) {
    return 'radial-gradient(circle ' + radius + 'px at ' +
      cx.toFixed(3) + '% ' + cy.toFixed(3) + '%, black 0%, black ' +
      core + '%, transparent 100%)';
  }

  /** Set initial mask and start opacity fade-in (no transform at all) */
  function showSpot(el, grad) {
    if (!el) return;
    el.style.transition = 'none';
    el.style.transform  = '';         /* ensure no leftover transform */
    el.style.webkitMaskImage = grad;
    el.style.maskImage       = grad;
    void el.offsetWidth;
    el.style.transition = 'opacity ' + FADE_IN + 'ms cubic-bezier(0.16, 1, 0.3, 1)';
    el.classList.add('is-visible');
  }

  /** Fade out element */
  function hideSpot(el) {
    if (!el) return;
    el.style.transition = 'opacity ' + FADE_OUT + 'ms cubic-bezier(0.33, 0, 0.67, 1)';
    el.classList.remove('is-visible');
  }

  /** Update mask position on an element (no transform) */
  function setMask(el, grad) {
    if (!el) return;
    el.style.webkitMaskImage = grad;
    el.style.maskImage       = grad;
  }

  function fireSpot() {
    var spot = getFreeSpot();
    if (!spot) return;            // all busy — skip this cycle

    spot.busy = true;

    /* Random position (% of viewport, avoiding extreme edges) */
    var startX = randomBetween(MARGIN, 1 - MARGIN) * 100;
    var startY = randomBetween(MARGIN, 1 - MARGIN) * 100;
    var radius = Math.round(randomBetween(RADIUS_MIN, RADIUS_MAX));
    var core   = Math.round(randomBetween(20, 35));

    /* Drift target in viewport % */
    var drift = randomDrift();
    var endX  = startX + drift.dx;
    var endY  = startY + drift.dy;

    /* Show at starting position */
    var initGrad = buildGrad(radius, core, startX, startY);
    showSpot(spot.el, initGrad);
    showSpot(spot.twin, initGrad);

    /* Animate mask position via rAF over the full lifetime */
    var t0  = performance.now();
    var raf = 0;

    function driftTick(now) {
      var elapsed = now - t0;
      var t = Math.min(elapsed / LIFE, 1);
      var e = easeOutCubic(t);

      var cx = startX + (endX - startX) * e;
      var cy = startY + (endY - startY) * e;
      var grad = buildGrad(radius, core, cx, cy);
      setMask(spot.el, grad);
      setMask(spot.twin, grad);

      if (t < 1) raf = requestAnimationFrame(driftTick);
    }

    raf = requestAnimationFrame(driftTick);

    /* Hold, then fade out */
    setTimeout(function () {
      hideSpot(spot.el);
      hideSpot(spot.twin);

      /* Mark free after fade-out completes */
      setTimeout(function () {
        cancelAnimationFrame(raf);
        spot.busy = false;
      }, FADE_OUT + 50);
    }, FADE_IN + HOLD);
  }

  function scheduleNext() {
    var delay = randomBetween(SPAWN_MIN, SPAWN_MAX);
    ambientTimer = setTimeout(function () {
      fireSpot();
      scheduleNext();
    }, delay);
  }

  function startAmbient() {
    if (ambientTimer) return;     // already running
    if (!pool.length) initPool();
    /* Fire one shortly after load for instant life */
    setTimeout(fireSpot, 600);
    scheduleNext();
  }

  function stopAmbient() {
    clearTimeout(ambientTimer);
    ambientTimer = null;
    pool.forEach(function (s) {
      s.el.classList.remove('is-visible');
      if (s.twin) s.twin.classList.remove('is-visible');
      s.busy = false;
    });
  }

  /* Kick off once DOM is ready */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAmbient);
  } else {
    startAmbient();
  }
})();
