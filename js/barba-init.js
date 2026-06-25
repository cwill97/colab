
(function () {
  'use strict';

  function waitForBarba(cb) {
    if (typeof barba !== 'undefined') cb();
    else setTimeout(function () { waitForBarba(cb); }, 50);
  }

  function initBarba() {

    /* Per-page audio routing. About uses a dedicated track; every other
       view falls back to the site-wide ambient bed. setTrack() handles
       both pre- and post-activation states. */
    var DEFAULT_TRACK = '';
    function routeAudio() {
      if (!window.colabAudio || !window.colabAudio.setTrack) return;
      window.colabAudio.setTrack(DEFAULT_TRACK);
    }

    /* Lazy-mount the tesseract on return to home. Non-home HTML files
       intentionally omit both the <div data-tesseract> wrap and the
       tesseract.js script tag (saves GPU on cold loads of those pages),
       so when Barba navigates back to home we must (re)create whatever
       is missing. The script auto-boots on execution, so injecting it
       after the div is enough to start rendering. */
    function ensureTesseract() {
      if (!document.querySelector('[data-tesseract]')) {
        var div = document.createElement('div');
        div.className = 'tesseract-wrap';
        div.setAttribute('aria-hidden', 'true');
        div.setAttribute('data-tesseract', '');
        document.body.insertBefore(div, document.body.firstChild);
      }

      if (window.colabTesseract) {
        window.colabTesseract.init();
        window.colabTesseract.resume();
        return;
      }

      if (document.querySelector('script[data-tesseract-script]')) return;
      var s = document.createElement('script');
      s.src = '/js/tesseract.js';
      s.setAttribute('data-tesseract-script', '');
      document.body.appendChild(s);
    }

    /* ── Helper: toggle persistent elements for each view ── */
    function enterHome() {
      document.body.classList.remove('project-page');
      document.body.classList.remove('about-page');
      document.body.classList.remove('projects-index-page');

      /* Show tesseract */
      var tesseract = document.querySelector('[data-tesseract]');
      if (tesseract) tesseract.style.display = '';

      /* Show visualizer */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = '';
        viz.setAttribute('aria-hidden', 'false');
      }

      ensureTesseract();

      /* Re-init homepage JS (scroll thumb, project hovers, etc.) */
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function enterProject(nextContainer) {
      document.body.classList.add('project-page');
      document.body.classList.remove('about-page');
      document.body.classList.remove('projects-index-page');

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

      /* Init project page JS — pass the new container so queries
         resolve to it, not the still-attached leaving container. */
      if (window.colabProject) window.colabProject.init(nextContainer);
      if (window.colabVideoPreview) window.colabVideoPreview.init();

      /* Re-bind nav toggle for the new container context */
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function enterProjectsIndex() {
      document.body.classList.remove('project-page');
      document.body.classList.remove('about-page');
      document.body.classList.add('projects-index-page');

      var tesseract = document.querySelector('[data-tesseract]');
      if (tesseract) tesseract.style.display = 'none';

      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = 'none';
        viz.setAttribute('aria-hidden', 'true');
      }

      if (window.colabTesseract) window.colabTesseract.pause();
      if (window.colabMainBoot) window.colabMainBoot();
    }

    function enterAbout(nextContainer) {
      document.body.classList.remove('project-page');
      document.body.classList.remove('projects-index-page');
      document.body.classList.add('about-page');

      /* Hide tesseract on about page */
      var tesseract = document.querySelector('[data-tesseract]');
      if (tesseract) tesseract.style.display = 'none';

      /* Hide visualizer on about page */
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        viz.style.display = 'none';
        viz.setAttribute('aria-hidden', 'true');
      }

      /* Pause tesseract to save GPU */
      if (window.colabTesseract) window.colabTesseract.pause();

      /* Studio page is a normal-scroll document — no depth gallery to
         mount. Reset scroll to the top after the container swap. */
      window.scrollTo(0, 0);
      if (nextContainer) nextContainer.scrollTop = 0;

      /* Re-bind nav toggle for the new container context */
      if (window.colabMainBoot) window.colabMainBoot();

      /* Mount the Studio's smooth scroll (Lenis). The initial page
         load auto-inits via DOMContentLoaded, but Barba navigations
         swap in a fresh container that needs its own instance.
         Defer one frame so layout has settled before Lenis measures. */
      if (window.colabLocoAbout) {
        requestAnimationFrame(function () {
          window.colabLocoAbout.init();
          if (window.colabScrollAbout) {
            requestAnimationFrame(function () {
              window.colabScrollAbout.init();
            });
          }
        });
      }

    }

    function leaveProject() {
      /* Destroy depth gallery before container is removed */
      if (window.colabProject) window.colabProject.destroy();
    }

    function leaveAbout() {
      if (window.colabScrollAbout) window.colabScrollAbout.destroy();
      if (window.colabLocoAbout) window.colabLocoAbout.destroy();
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

        leave: function (data) {
          var done = this.async();
          var ST = window.ShaderTransition;

          /* Submerge audio */
          if (window.colabAudio) window.colabAudio.submerge(0.6);

          /* Tear down current view */
          var leaving = data.current.namespace;
          if (leaving === 'project') leaveProject();
          if (leaving === 'about')   leaveAbout();

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

        /* afterLeave — fires after wipeOut completes and BEFORE the DOM swap.
           Screen is fully black at this point. If a menu-link click triggered
           this transition, the menu is still visually open; close its chrome
           silently here so the upcoming revealIn doesn't reveal the menu
           sitting on top of the new container (menu is z-index:90, above
           the swapped container). */
        afterLeave: function (data) {
          if (window.colabHideMenuChrome &&
              document.body.hasAttribute('data-menu-open')) {
            window.colabHideMenuChrome();
          }
        },

        enter: function (data) {
          var entering = data.next.namespace;

          /* Set up new view */
          if (entering === 'home') {
            enterHome();
          } else if (entering === 'project') {
            enterProject(data.next.container);
          } else if (entering === 'projects-index') {
            enterProjectsIndex();
          } else if (entering === 'about') {
            enterAbout(data.next.container);
          }

          /* Route the ambient bed to the per-page track */
          routeAudio(entering);
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

            /* Surface audio after reveal — submerge on about/project, surface elsewhere */
            setTimeout(function () {
              if (window.colabAudio) {
                if (entering === 'about' || entering === 'project') {
                  window.colabAudio.submerge();
                } else {
                  window.colabAudio.surface(0.6);
                }
              }
            }, 150);

            /* Signal complete after reveal finishes */
            setTimeout(function () {
              done();
            }, 800);
          }, 50);
        }
      }]
    });
  }

  waitForBarba(initBarba);

}());
