/**
 * co:lab — Barba.js Page Transition Orchestration
 *
 * Manages seamless transitions between homepage and project page.
 * Persistent elements (nav, menu, visualizer, tesseract, audio) stay
 * alive across transitions. Only the Barba container swaps.
 *
 * Transition flow:
 *   1. Submerge audio (underwater low-pass)
 *   2. Shader wipe-out (screen goes black)
 *   3. Swap container content
 *   4. Toggle body class + show/hide persistent elements
 *   5. Init new view's JS (project-boot or main.js)
 *   6. Shader reveal-in
 *   7. Surface audio
 */

(function () {
  'use strict';

  function waitForBarba(cb) {
    if (typeof barba !== 'undefined') cb();
    else setTimeout(function () { waitForBarba(cb); }, 50);
  }

  function initBarba() {

    /* ── Helper: store project index from clicked link ── */
    function storeProjectIndex(trigger) {
      if (!trigger || !trigger.getAttribute) return;
      var idx = trigger.getAttribute('data-project-link');
      if (idx !== null) {
        try { sessionStorage.setItem('colab_activeProject', idx); } catch (e) {}
      }
    }

    /* ── Helper: toggle persistent elements for each view ── */
    function enterHome() {
      document.body.classList.remove('project-page');

      /* Show tesseract */
      var tesseract = document.querySelector('[data-tesseract]');
      if (tesseract) tesseract.style.display = '';

      /* Show visualizer */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = '';
        viz.setAttribute('aria-hidden', 'false');
      }

      /* Resume or init tesseract */
      if (window.colabTesseract) {
        window.colabTesseract.init();
        window.colabTesseract.resume();
      }

      /* Re-init homepage JS (scroll thumb, project hovers, etc.) */
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function enterProject() {
      document.body.classList.add('project-page');

      /* Hide tesseract on project page (CSS handles it, but ensure display) */
      var tesseract = document.querySelector('[data-tesseract]');
      if (tesseract) tesseract.style.display = 'none';

      /* Hide visualizer on project page */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = 'none';
        viz.setAttribute('aria-hidden', 'true');
      }

      /* Pause tesseract animation to save GPU */
      if (window.colabTesseract) window.colabTesseract.pause();

      /* Init project page JS (depth gallery, video preview, etc.) */
      if (window.colabProject) window.colabProject.init();
      if (window.colabVideoPreview) window.colabVideoPreview.init();

      /* Re-bind nav toggle for the new container context */
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function leaveProject() {
      /* Destroy depth gallery before container is removed */
      if (window.colabProject) window.colabProject.destroy();
    }

    /* ── Barba init ── */
    barba.init({
      /* Don't let Barba intercept non-page protocols or anchor-only links.
         Note: Barba already blocks cross-origin, cross-port, target="_blank",
         and download links internally — no need to duplicate here.
         data.href is the RESOLVED full URL, so never test for http/https. */
      prevent: function (data) {
        var href = data.href;
        if (!href) return true;
        /* Skip non-page protocols */
        if (/^(javascript:|mailto:|tel:)/.test(href)) return true;
        /* Skip anchor-only links (raw attribute starts with #) */
        var el = data.el;
        if (el && el.getAttribute) {
          var raw = el.getAttribute('href') || '';
          if (raw.charAt(0) === '#') return true;
        }
        return false;
      },

      transitions: [{
        name: 'shader-wipe',

        /* Store project index before anything happens */
        before: function (data) {
          storeProjectIndex(data.trigger);
        },

        leave: function (data) {
          var done = this.async();
          var ST = window.ShaderTransition;

          /* Submerge audio */
          if (window.colabAudio) window.colabAudio.submerge(0.6);

          /* Tear down current view */
          var leaving = data.current.namespace;
          if (leaving === 'project') leaveProject();

          /* Shader wipe out */
          if (ST) {
            ST.resetLock();
            ST.wipeOut(function () {
              done();
            });
          } else {
            done();
          }
        },

        enter: function (data) {
          var entering = data.next.namespace;

          /* Set up new view */
          if (entering === 'home') {
            enterHome();
          } else if (entering === 'project') {
            enterProject();
          }
        },

        after: function (data) {
          var done = this.async();
          var ST = window.ShaderTransition;
          var entering = data.next.namespace;

          /* Small delay then reveal */
          setTimeout(function () {
            if (ST) {
              ST.revealIn(0.0);
            }

            /* Surface audio after reveal — both pages get full audio */
            setTimeout(function () {
              if (window.colabAudio) {
                window.colabAudio.surface(0.6);
              }
            }, 300);

            /* Signal complete after reveal finishes */
            setTimeout(function () {
              done();
            }, 1800);
          }, 150);
        }
      }]
    });
  }

  waitForBarba(initBarba);

}());
