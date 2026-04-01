/**
 * co:lab — Barba.js Page Transition Orchestration
 *
 * Manages seamless transitions between homepage and project page.
 * Persistent elements (nav, menu, visualizer, globe, audio) stay
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

      /* Show globe */
      var globe = document.querySelector('[data-globe]');
      if (globe) globe.style.display = '';

      /* Show visualizer */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = '';
        viz.setAttribute('aria-hidden', 'false');
      }

      /* Resume or re-init globe */
      if (window.colabGlobeInit) {
        window.colabGlobeInit();
      } else if (window.colabGlobe) {
        window.colabGlobe.resume();
      }

      /* Re-init homepage JS (scroll thumb, project hovers, etc.) */
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function enterProject() {
      document.body.classList.add('project-page');

      /* Hide globe on project page (CSS handles it, but ensure display) */
      var globe = document.querySelector('[data-globe]');
      if (globe) globe.style.display = 'none';

      /* Hide visualizer on project page */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = 'none';
        viz.setAttribute('aria-hidden', 'true');
      }

      /* Pause globe animation to save GPU */
      if (window.colabGlobe) window.colabGlobe.pause();

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
      /* Don't let Barba intercept external, anchor, or same-page links */
      prevent: function (data) {
        var href = data.href;
        if (!href) return true;
        /* Skip external links */
        if (/^(https?:|javascript:|mailto:|tel:)/.test(href)) return true;
        /* Skip anchor-only links */
        if (href.indexOf('#') === 0) return true;
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

          /* Small delay then reveal */
          setTimeout(function () {
            if (ST) {
              ST.revealIn(0.0);
            }

            /* Surface audio after reveal starts */
            setTimeout(function () {
              if (window.colabAudio) window.colabAudio.surface(0.6);
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
