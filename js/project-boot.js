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
      hasVideo: true,
      description: 'Viking Gear forges strength through primal movement. Rooted in the warrior spirit, it reimagines ancient training tools such as maces, clubs, and hammers as modern extensions of discipline, flow, and mastery. Every piece honours resilience, balance, and raw power, turning training into ritual.\n\nWe built the brand from the ground up. We shaped the strategy, art direction, and complete visual identity, creating a bold, purposeful world where ancient form meets contemporary performance.',
      images: [
        'assets/Project_Img_01.webp',
        'assets/Project_Img_Viking_02.webp',
        'assets/Project_Img_Viking_03.webp',
        'assets/Project_Img_Viking_04.webp',
        'assets/Project_Img_Viking_05.webp',
        'assets/Project_Img_Viking_06.webp',
        'assets/Project_Img_Viking_07.webp',
        'assets/Project_Img_Viking_08.webp',
        'assets/Project_Img_Viking_09.webp',
        'assets/Project_Img_Viking_10.webp',
        'assets/Project_Img_Viking_11.webp'
      ]
    },
    {
      index:    '002',
      title:    'Rebel Kids Club',
      services: 'Brand Development · Photography · E-Commerce · Web Design',
      hasVideo: false,
      description: 'Rebel Kids Club breaks the pink and blue code. It redefines toddler fashion with gender neutral clothing that celebrates individuality, intention, and timeless style from day one. Bold yet grounded, modern yet wearable, every piece gives parents a fresh way to dress their little rebels.\n\nWe built the brand from the ground up. We created the full identity system, from name and positioning to visual language and guidelines, crafting a distinctive voice that feels confident, inclusive, and unmistakably its own.',
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
      hasVideo: false,
      description: 'Mannequin Films captures the raw poetry of visual storytelling. Through photography and video, they transform fleeting moments into enduring narratives that resonate with authenticity and precision. Every frame is crafted with intention, blending creativity, emotion, and technical excellence to bring stories to life.\n\nWe led a full rebrand, forging a new identity that honours their cinematic roots while sharpening their contemporary edge. From the refined brandmark to the complete visual system, we distilled their essence into a cohesive language that feels both timeless and alive.',
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
  var aboutText    = document.querySelector('.about-text');
  var videoPreview = document.querySelector('[data-video-preview]');

  /* ============================================================
     META OVERLAY
     ============================================================ */
  function updateMeta(project, index) {
    if (metaNum)      metaNum.textContent     = project.index;
    if (metaServices) metaServices.textContent = project.services;
    if (metaCount)    metaCount.textContent    = '0' + (index + 1) + ' / 0' + PROJECTS.length;
    if (metaFill)     metaFill.style.width     = ((index / Math.max(PROJECTS.length - 1, 1)) * 100) + '%';
    if (metaTitle)    metaTitle.textContent    = project.title;

    /* Update about-text with project-specific description */
    if (aboutText && project.description) {
      aboutText.textContent = project.description;
    }

    /* Show/hide video preview based on project */
    if (videoPreview) {
      videoPreview.style.display = project.hasVideo ? '' : 'none';
    }
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
  var transitioning = false;

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

  /**
   * Transition to another project via shader wipe.
   * direction: 'forward' — new project starts at first image
   *            'backward' — new project starts at last image
   */
  function transitionToProject(index, direction) {
    if (transitioning || !gallery) return;
    transitioning = true;

    var ST = window.ShaderTransition;
    if (!ST) {
      /* No shader — instant swap */
      _doSwap(index, direction);
      transitioning = false;
      return;
    }

    ST.resetLock();
    ST.wipeOut(function () {
      /* Screen is black — swap content */
      _doSwap(index, direction);

      /* Reveal the new project */
      setTimeout(function () {
        ST.revealIn(0.0);
        setTimeout(function () { transitioning = false; }, 2200);
      }, 120);
    });
  }

  function _doSwap(index, direction) {
    currentIndex = index;
    var project = PROJECTS[index];

    /* Update UI */
    updateMeta(project, index);
    if (isMobile) updateMobileTitle(project);

    if (!isMobile) {
      document.querySelectorAll('[data-project-index]').forEach(function (el) {
        el.classList.toggle('is-active', parseInt(el.dataset.projectIndex, 10) === index);
      });
    }

    /* Load new images (resets scroll to start) */
    gallery.loadImages(project.images);

    /* If going backward, jump camera to last image */
    if (direction === 'backward') {
      gallery.scrollToEnd();
    }
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

    /* ── Scroll past end → next project ── */
    gallery.onReachEnd = function () {
      var nextIdx = (currentIndex + 1) % PROJECTS.length;
      transitionToProject(nextIdx, 'forward');
    };

    /* ── Scroll before start → previous project ── */
    gallery.onReachStart = function () {
      var prevIdx = (currentIndex - 1 + PROJECTS.length) % PROJECTS.length;
      transitionToProject(prevIdx, 'backward');
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

    /* Desktop cursor tooltip — "scroll" follows the mouse */
    if (!isMobile) initCursorTooltip();
  }

  /* ============================================================
     DESKTOP CURSOR TOOLTIP
     ============================================================ */
  var tooltipEl  = null;
  var tooltipRaf = null;
  var tipTargetX = 0, tipTargetY = 0;
  var tipCurrentX = 0, tipCurrentY = 0;
  var TIP_LERP   = 0.12;

  /** Read the current CSS zoom applied to <html> by scale.js.
      Returns 1 when no zoom is set. clientX/clientY are in screen
      pixels; dividing by zoom converts to CSS-pixel space so the
      fixed-position tooltip lands under the actual cursor. */
  function getZoom() {
    var z = parseFloat(document.documentElement.style.zoom);
    return (z && z > 0) ? z : 1;
  }

  function initCursorTooltip() {
    /* Create element */
    tooltipEl = document.createElement('span');
    tooltipEl.className = 'project-cursor-tooltip';
    tooltipEl.textContent = 'scroll';
    tooltipEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(tooltipEl);

    /* Track mouse */
    document.addEventListener('mousemove', onTipMove, { passive: true });
    document.addEventListener('mouseleave', onTipLeave, { passive: true });
    document.addEventListener('mouseenter', onTipEnter, { passive: true });
  }

  function onTipMove(e) {
    var z = getZoom();
    tipTargetX = e.clientX / z;
    tipTargetY = e.clientY / z;

    if (!tooltipEl.classList.contains('is-visible')) {
      /* Snap to position on first show (no lag) */
      tipCurrentX = tipTargetX;
      tipCurrentY = tipTargetY;
      tooltipEl.style.left = tipCurrentX + 'px';
      tooltipEl.style.top  = tipCurrentY + 'px';
      tooltipEl.classList.add('is-visible');
    }

    if (!tooltipRaf) startTipLoop();
  }

  function onTipLeave() {
    if (tooltipEl) tooltipEl.classList.remove('is-visible');
  }

  function onTipEnter(e) {
    var z = getZoom();
    tipTargetX = e.clientX / z;
    tipTargetY = e.clientY / z;
  }

  function startTipLoop() {
    function tick() {
      tipCurrentX += (tipTargetX - tipCurrentX) * TIP_LERP;
      tipCurrentY += (tipTargetY - tipCurrentY) * TIP_LERP;
      if (tooltipEl) {
        tooltipEl.style.left = tipCurrentX + 'px';
        tooltipEl.style.top  = tipCurrentY + 'px';
      }

      if (Math.abs(tipTargetX - tipCurrentX) > 0.3 ||
          Math.abs(tipTargetY - tipCurrentY) > 0.3) {
        tooltipRaf = requestAnimationFrame(tick);
      } else {
        tooltipRaf = null;
      }
    }
    tooltipRaf = requestAnimationFrame(tick);
  }

  function destroyCursorTooltip() {
    document.removeEventListener('mousemove', onTipMove);
    document.removeEventListener('mouseleave', onTipLeave);
    document.removeEventListener('mouseenter', onTipEnter);
    if (tooltipRaf) { cancelAnimationFrame(tooltipRaf); tooltipRaf = null; }
    if (tooltipEl) { tooltipEl.remove(); tooltipEl = null; }
  }

  function destroy() {
    destroyCursorTooltip();
    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    currentIndex = 0;
    document.body.classList.remove('is-ready');
  }

  /* Auto-init only if we're on the project page at load time */
  if (document.body.classList.contains('project-page')) {
    (function waitForLibs() {
      if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') init();
      else setTimeout(waitForLibs, 50);
    })();
  }

  /* Expose for Barba transitions */
  window.colabProject = {
    init: function () {
      isMobile = window.matchMedia('(max-width: 767px)').matches;
      mobileTitle = document.querySelector('[data-mobile-title]');
      canvas = document.querySelector('[data-depth-canvas]');
      canvasWrap = document.querySelector('[data-project-canvas-wrap]');
      metaNum = document.querySelector('[data-meta-num]');
      metaTitle = document.querySelector('[data-meta-title]');
      metaServices = document.querySelector('[data-meta-services]');
      metaFill = document.querySelector('[data-meta-fill]');
      metaCount = document.querySelector('[data-meta-count]');
      scrollHint = document.querySelector('[data-scroll-hint]');
      aboutText = document.querySelector('.about-text');
      videoPreview = document.querySelector('[data-video-preview]');
      if (!canvas || !canvasWrap) return;
      (function waitForLibs() {
        if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') init();
        else setTimeout(waitForLibs, 50);
      })();
    },
    destroy: destroy
  };

}());
