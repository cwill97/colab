/**
 * co:lab — Project Page Bootstrap
 *
 * Holds project data, meta overlay updates, related-project
 * switching, and session restore. Uses DepthGallery exclusively
 * for the gallery view (no infinite canvas).
 */
(function () {
  'use strict';

  /* ============================================================
     PROJECT DATA
     ============================================================ */
  var PROJECTS = [
    {
      index:    '001',
      title:    'Viking Gear',
      services: 'Brand Development · Web Design · E-Commerce · 3D · Animation',
      images: [
        'assets/Project_Img_01.webp',
        'assets/Project_Img_Viking_02.webp',
        'assets/Project_Img_Viking_03.webp',
        'assets/Project_Img_Viking_04.webp',
        'assets/Project_Img_Viking_05.webp',
        'assets/Project_Img_Viking_06.webp',
        'assets/Project_Img_Viking_07.webp',
        'assets/Project_Img_Viking_08.webp'
      ]
    },
    {
      index:    '002',
      title:    'Rebel Kids Club',
      services: 'Brand Development · Photography · E-Commerce · Web Design',
      images: [
        'assets/Project_Img_02.webp',
        'assets/Project_Img_Rebel_02.webp',
        'assets/Project_Img_Rebel_03.webp',
        'assets/Project_Img_Rebel_04.webp',
        'assets/Project_Img_Rebel_05.webp',
        'assets/Project_Img_Rebel_06.webp',
        'assets/Project_Img_Rebel_07.webp'
      ]
    },
    {
      index:    '003',
      title:    'Mannequin Films',
      services: 'Brand Development · Web Design · Motion',
      images: [
        'assets/Project_Img_03.webp',
        'assets/Project_Img_Mannequin_02.webp',
        'assets/Project_Img_Mannequin_03.webp',
        'assets/Project_Img_Mannequin_04.webp',
        'assets/Project_Img_Mannequin_05.webp',
        'assets/Project_Img_Mannequin_06.webp',
        'assets/Project_Img_Mannequin_07.webp',
        'assets/Project_Img_Mannequin_08.webp',
        'assets/Project_Img_Mannequin_09.webp',
        'assets/Project_Img_Mannequin_10.webp',
        'assets/Project_Img_Mannequin_10.webp'
      ]
    }
  ];

  /* ============================================================
     DOM REFS
     ============================================================ */
  var canvas     = document.querySelector('[data-depth-canvas]');
  var canvasWrap = document.querySelector('[data-project-canvas-wrap]');
  var metaNum      = document.querySelector('[data-meta-num]');
  var metaTitle    = document.querySelector('[data-meta-title]');
  var metaServices = document.querySelector('[data-meta-services]');
  var metaFill     = document.querySelector('[data-meta-fill]');
  var metaCount    = document.querySelector('[data-meta-count]');
  var scrollHint   = document.querySelector('[data-scroll-hint]');

  if (!canvas || !canvasWrap) return;

  /* ============================================================
     META OVERLAY
     ============================================================ */
  function updateMeta(project, index) {
    if (metaNum)      metaNum.textContent     = project.index;
    if (metaServices) metaServices.textContent = project.services;
    if (metaCount)    metaCount.textContent    = '0' + (index + 1) + ' / 0' + PROJECTS.length;
    if (metaFill)     metaFill.style.width     = ((index / Math.max(PROJECTS.length - 1, 1)) * 100) + '%';
    if (metaTitle)    metaTitle.textContent    = project.title;
  }

  /* ============================================================
     SESSION RESTORE
     ============================================================ */
  function getInitialIndex() {
    try {
      var s = sessionStorage.getItem('colab_activeProject');
      if (s !== null) {
        sessionStorage.removeItem('colab_activeProject');
        var idx = parseInt(s, 10);
        return (idx >= 0 && idx < PROJECTS.length) ? idx : 0;
      }
    } catch (e) {}
    return 0;
  }

  /* ============================================================
     MOBILE DETECTION
     ============================================================ */
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var mobileTitle = document.querySelector('[data-mobile-title]');

  /* ============================================================
     MOBILE HELPERS
     ============================================================ */

  /**
   * Inject thumbnail images into related project list items.
   * Uses same class names as homepage: .project-thumb-mobile + .project-content-mobile
   */
  function injectRelatedThumbnails() {
    document.querySelectorAll('[data-project-index]').forEach(function (item) {
      var idx = parseInt(item.dataset.projectIndex, 10);
      var project = PROJECTS[idx];
      if (!project) return;
      if (item.querySelector('.project-thumb-mobile')) return;

      /* Create thumbnail — same class as homepage */
      var thumb = document.createElement('img');
      thumb.className = 'project-thumb-mobile';
      thumb.src = project.images[0];
      thumb.alt = '';
      thumb.setAttribute('aria-hidden', 'true');

      /* Wrap existing children — same class as homepage */
      var wrapper = document.createElement('div');
      wrapper.className = 'project-content-mobile';
      while (item.firstChild) {
        wrapper.appendChild(item.firstChild);
      }

      item.appendChild(thumb);
      item.appendChild(wrapper);
    });
  }

  /**
   * Scroll-based activation — identical to homepage initMobileProjects().
   * Activates whichever related-project-item is nearest the top of the
   * scroll area, toggling .is-scrolled-active.
   */
  function initScrollActivation() {
    var items = document.querySelectorAll('.related-project-item');
    var list  = document.querySelector('.related-project-list');
    if (!items.length || !list) return;

    var activeItem = null;

    function updateActive() {
      var listRect = list.getBoundingClientRect();
      var best     = null;
      var bestDist = Infinity;

      for (var i = 0; i < items.length; i++) {
        var rect = items[i].getBoundingClientRect();
        if (rect.bottom < listRect.top || rect.top > listRect.bottom) continue;
        var dist = Math.abs(rect.top - listRect.top);
        if (dist < bestDist) {
          bestDist = dist;
          best = items[i];
        }
      }

      if (best && best !== activeItem) {
        if (activeItem) activeItem.classList.remove('is-scrolled-active');
        best.classList.add('is-scrolled-active');
        activeItem = best;

        /* Also update the gallery + title when scroll changes active item */
        var idx = parseInt(best.dataset.projectIndex, 10);
        if (idx !== currentIndex && gallery) {
          currentIndex = idx;
          var project = PROJECTS[idx];
          updateMeta(project, idx);
          updateMobileTitle(project);
          gallery.loadImages(project.images);
        }
      }
    }

    /* Initial activation */
    requestAnimationFrame(updateActive);

    /* Update on scroll */
    list.addEventListener('scroll', function () {
      requestAnimationFrame(updateActive);
    }, { passive: true });
  }

  /** Update the mobile-only title heading */
  function updateMobileTitle(project) {
    if (mobileTitle) mobileTitle.textContent = project.title;
  }

  /* ============================================================
     PROJECT SWITCHING
     ============================================================ */
  var currentIndex = 0;
  var gallery      = null;

  function switchProject(index) {
    if (index === currentIndex || !gallery) return;
    currentIndex = index;

    /* Desktop uses is-active; mobile relies on is-scrolled-active from scroll observer */
    if (!isMobile) {
      document.querySelectorAll('[data-project-index]').forEach(function (el) {
        el.classList.toggle('is-active', parseInt(el.dataset.projectIndex, 10) === index);
      });
    }

    var project = PROJECTS[index];
    updateMeta(project, index);
    if (isMobile) updateMobileTitle(project);
    gallery.loadImages(project.images);
  }

  /* ============================================================
     RELATED PROJECT RAIL EVENTS
     ============================================================ */
  document.querySelectorAll('[data-project-switch]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (scrollHint) scrollHint.classList.add('is-hidden');
      switchProject(parseInt(btn.dataset.projectSwitch, 10));
    });
  });

  document.querySelectorAll('[data-project-index]').forEach(function (item) {
    item.addEventListener('click', function () {
      switchProject(parseInt(item.dataset.projectIndex, 10));
    });
  });

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    var startIdx = getInitialIndex();
    currentIndex = startIdx;
    var project  = PROJECTS[startIdx];

    /* Set initial meta */
    updateMeta(project, startIdx);

    /* Highlight active related project */
    document.querySelectorAll('[data-project-index]').forEach(function (el) {
      el.classList.toggle('is-active', parseInt(el.dataset.projectIndex, 10) === startIdx);
    });

    /* Mobile-specific setup */
    if (isMobile) {
      injectRelatedThumbnails();
      updateMobileTitle(project);

      /* Remove desktop is-active classes — mobile uses is-scrolled-active */
      document.querySelectorAll('[data-project-index]').forEach(function (el) {
        el.classList.remove('is-active');
      });
    }

    /* Show the depth canvas */
    canvas.style.display = 'block';

    /* Create and start the gallery */
    gallery = new DepthGallery();
    gallery.init(canvas, canvasWrap, project.images);

    /* End-of-gallery → shader reveal → next project */
    gallery.onReachEnd = function () {
      var nextIdx = (currentIndex + 1) % PROJECTS.length;

      /* Store next project index for session restore */
      try { sessionStorage.setItem('colab_activeProject', String(nextIdx)); } catch (e) {}

      /* Flag so destination page starts covered by shader */
      try { sessionStorage.setItem('colab_shaderNav', '1'); } catch (e) {}

      /* Submerge audio during transition */
      if (window.colabAudio) window.colabAudio.submerge(0.6);

      var ST = window.ShaderTransition;
      if (ST) {
        ST.resetLock();
        ST.wipeOut(function () {
          window.location.href = 'project.html';
        });
      } else {
        /* Fallback: no shader system — hard navigate */
        window.location.href = 'project.html';
      }
    };

    gallery.start();

    /* Scroll activation after gallery is ready (mobile only) */
    if (isMobile) {
      requestAnimationFrame(function () {
        initScrollActivation();
      });
    }

    /* Signal page ready */
    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
    });
  }

  /* Wait for THREE + DepthGallery */
  (function waitForLibs() {
    if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') init();
    else setTimeout(waitForLibs, 50);
  })();

}());
