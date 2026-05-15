/**
 * co:lab — About / Studio title reveal
 *
 * Toggles the `is-revealed` class on .studio-display 450ms after the
 * page-level shader-reveal completes. CSS handles the actual animation
 * (a 1.8s blur + opacity transition on .studio-display-img).
 *
 * Two trigger paths:
 *   1. Direct load of /about → wait for the 'colab:shader-revealed'
 *      event from shader-reveal.js, then start the 1.5s countdown.
 *   2. Barba navigation INTO /about → the page is already visible by
 *      the time the after-hook fires, so start the countdown
 *      immediately.
 *
 * Safety net: if no event arrives, the reveal fires anyway after a
 * generous timeout so the title is never left permanently hidden.
 */

(function () {
  'use strict';

  var POST_REVEAL_DELAY = 450;    /* ms — wait after page is visible (1500ms × 0.30) */
  var SAFETY_NET        = 6000;   /* ms — last-resort fallback delay */

  /* Single-shot scheduler: starts the post-reveal delay timer.
     Subsequent calls are ignored, so multiple triggers (event + safety
     net + barba hook) all collapse to one reveal. */
  function makeScheduler(target) {
    var fired = false;
    return function scheduleReveal() {
      if (fired) return;
      fired = true;
      setTimeout(function () {
        target.classList.add('is-revealed');
      }, POST_REVEAL_DELAY);
    };
  }

  function setupReveal(opts) {
    var target = document.querySelector('.studio-display');
    if (!target) return;

    /* Reset to hidden — important when re-entering via Barba */
    target.classList.remove('is-revealed');

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
