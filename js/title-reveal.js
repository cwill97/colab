/**
 * co:lab — About / Studio title burn-reveal
 *
 * Plays a noise-edged radial reveal on the .studio-display SVG title,
 * starting 1.5s after the page-level shader-reveal completes. Mirrors
 * the visual language of shader-reveal.js but scoped to the title.
 *
 * Two trigger paths:
 *   1. Direct load of /about → wait for the 'colab:shader-revealed'
 *      event from shader-reveal.js, then start the 1.5s countdown.
 *   2. Barba navigation INTO /about → the page is already visible by
 *      the time the after-hook fires, so start the countdown
 *      immediately.
 *
 * Safety net: if no event arrives, the burn fires anyway after a
 * generous timeout so the title is never left permanently hidden.
 */

(function () {
  'use strict';

  var POST_REVEAL_DELAY = 1500;   /* ms — wait after page is visible */
  var BURN_DURATION     = 1800;   /* ms — matches shader-reveal revealIn */
  var SAFETY_NET        = 6000;   /* ms — last-resort fallback delay */

  /* power2.inOut — same easing as gsap uses in shader-reveal.js */
  function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  function runBurn(target) {
    var start = performance.now();
    target.classList.add('is-burning');

    function tick(now) {
      var t = Math.min((now - start) / BURN_DURATION, 1);
      var eased = easeInOutQuad(t);
      /* Progress goes 0 → 1.35 — past 100% so the soft outer edge of
         the radial mask clears the corners on every aspect ratio. */
      var progress = eased * 1.35;
      target.style.setProperty('--burn', progress.toFixed(4));
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        target.classList.remove('is-burning');
        target.classList.add('is-burned');
      }
    }
    requestAnimationFrame(tick);
  }

  /* Single-shot scheduler: starts the post-reveal delay timer.
     Subsequent calls are ignored, so multiple triggers (event + safety
     net + barba hook) all collapse to one animation. */
  function makeScheduler(target) {
    var fired = false;
    var pending = null;
    return function scheduleBurn() {
      if (fired) return;
      fired = true;
      pending = setTimeout(function () {
        pending = null;
        runBurn(target);
      }, POST_REVEAL_DELAY);
    };
  }

  function setupReveal(opts) {
    var target = document.querySelector('.studio-display');
    if (!target) return;

    /* Reset to fully hidden — important when re-entering via Barba */
    target.classList.remove('is-burned', 'is-burning');
    target.style.setProperty('--burn', '0');

    var schedule = makeScheduler(target);

    if (opts && opts.pageAlreadyVisible) {
      /* Barba path — the after-hook fires once the new container is
         on screen, so begin the post-reveal countdown immediately. */
      schedule();
      return;
    }

    /* Direct-load path — wait for the page-level shader to clear,
       then start the countdown. */
    document.addEventListener('colab:shader-revealed', schedule, { once: true });

    /* Safety net so the title never stays hidden if the event misses. */
    setTimeout(schedule, SAFETY_NET);
  }

  /* ── Initial page load (direct load) ──────────────────────── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setupReveal({ pageAlreadyVisible: false }); });
  } else {
    setupReveal({ pageAlreadyVisible: false });
  }

  /* ── Re-run on Barba transitions INTO the about page ──────── */
  function hookBarba(retry) {
    if (typeof barba !== 'undefined' && barba.hooks) {
      barba.hooks.after(function (data) {
        if (data && data.next && data.next.namespace === 'about') {
          setupReveal({ pageAlreadyVisible: true });
        }
      });
      return;
    }
    if (retry > 60) return;   /* give up after ~3s of polling */
    setTimeout(function () { hookBarba(retry + 1); }, 50);
  }
  hookBarba(0);
}());
