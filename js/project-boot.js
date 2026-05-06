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
  /* NOTE: project metadata is mirrored in scripts/build-projects.js for static
     HTML generation. If you add or rename a project, update both. */
  var PROJECTS = [
    {
      slug:     'viking-gear',
      index:    '001',
      title:    'Viking Gear',
      services: 'Brand Development · Web Design · E-Commerce · 3D · Animation',
      logoSrc:  '/assets/Project_Logo_Viking.svg',
      timeline: 'October 2025 — May 2026',
      metaDescription: 'Brand development, web design, e-commerce, 3D and animation for Viking Gear — primal training tools reimagined as modern rituals of discipline and mastery.',
      description: 'Viking Gear forges strength through primal movement. Rooted in the warrior spirit, it reimagines ancient training tools such as maces, clubs, and hammers as modern extensions of discipline, flow, and mastery. Every piece honours resilience, balance, and raw power, turning training into ritual.\n\nWe built the brand from the ground up. We shaped the strategy, art direction, and complete visual identity, creating a bold, purposeful world where ancient form meets contemporary performance.',
      images: [
        '/assets/Project_Img_01.webp',
        '/assets/Project_Img_Viking_02.webp',
        '/assets/Project_Img_Viking_03.webp',
        '/assets/Project_Img_Viking_04.webp',
        '/assets/Project_Img_Viking_05.webp',
        '/assets/Project_Img_Viking_06.webp',
        '/assets/Project_Img_Viking_07.webp',
        '/assets/Project_Img_Viking_08.webp',
        '/assets/Project_Img_Viking_09.webp',
        '/assets/Project_Img_Viking_10.webp',
        '/assets/Project_Img_Viking_11.webp'
      ]
    },
    {
      slug:     'rebel-kids-club',
      index:    '002',
      title:    'Rebel Kids Club',
      services: 'Brand Development · Photography · E-Commerce · Web Design',
      logoSrc:  '',
      timeline: 'TBD',
      metaDescription: 'Gender-neutral toddler fashion brand. Full identity system, photography direction and e-commerce design for Rebel Kids Club — bold, inclusive and unmistakably its own.',
      description: 'Rebel Kids Club breaks the pink and blue code. It redefines toddler fashion with gender neutral clothing that celebrates individuality, intention, and timeless style from day one. Bold yet grounded, modern yet wearable, every piece gives parents a fresh way to dress their little rebels.\n\nWe built the brand from the ground up. We created the full identity system, from name and positioning to visual language and guidelines, crafting a distinctive voice that feels confident, inclusive, and unmistakably its own.',
      images: [
        '/assets/Project_Img_02.webp',
        '/assets/Project_Img_Rebel_02.webp',
        '/assets/Project_Img_Rebel_03.webp',
        '/assets/Project_Img_Rebel_04.webp',
        '/assets/Project_Img_Rebel_05.webp',
        '/assets/Project_Img_Rebel_06.webp',
        '/assets/Project_Img_Rebel_07.webp',
        '/assets/Project_Img_Rebel_08.webp',
        '/assets/Project_Img_Rebel_09.webp',
        '/assets/Project_Img_Rebel_10.webp'
      ]
    },
    {
      slug:     'mannequin-films',
      index:    '003',
      title:    'Mannequin Films',
      services: 'Brand Development · Web Design · Motion',
      logoSrc:  '',
      timeline: 'TBD',
      metaDescription: 'Cinematic rebrand for Mannequin Films — brand identity, web design and motion that distil their visual storytelling into a timeless, alive language.',
      description: 'Mannequin Films captures the raw poetry of visual storytelling. Through photography and video, they transform fleeting moments into enduring narratives that resonate with authenticity and precision. Every frame is crafted with intention, blending creativity, emotion, and technical excellence to bring stories to life.\n\nWe led a full rebrand, forging a new identity that honours their cinematic roots while sharpening their contemporary edge. From the refined brandmark to the complete visual system, we distilled their essence into a cohesive language that feels both timeless and alive.',
      images: [
        '/assets/Project_Img_03.webp',
        '/assets/Project_Img_Mannequin_02.webp',
        '/assets/Project_Img_Mannequin_03.webp',
        '/assets/Project_Img_Mannequin_04.webp',
        '/assets/Project_Img_Mannequin_05.webp',
        '/assets/Project_Img_Mannequin_06.webp',
        '/assets/Project_Img_Mannequin_07.webp',
        '/assets/Project_Img_Mannequin_08.webp',
        '/assets/Project_Img_Mannequin_09.webp',
        '/assets/Project_Img_Mannequin_10.webp',
        '/assets/Project_Img_Mannequin_10.webp'
      ]
    },
    {
      slug:     'hyde-park-ventures',
      index:    '004',
      title:    'Hyde Park Ventures (Five Guys)',
      services: 'Web Design · Web Development · Brand Consolidation',
      logoSrc:  '',
      timeline: 'TBD',
      metaDescription: 'Website consolidation and digital modernisation for Hyde Park Ventures — a unified platform that brings clarity to a diverse portfolio.',
      description: 'Website consolidation and digital modernisation for Hyde Park Ventures, creating a unified platform that brings clarity to a diverse portfolio. Delivered a streamlined, future-ready experience that improves navigation, strengthens brand consistency, and supports ongoing growth.',
      images: [
        '/assets/Project_Img_04.webp',
        '/assets/Project_Img_HydePark_02.webp',
        '/assets/Project_Img_HydePark_03.webp',
        '/assets/Project_Img_HydePark_04.webp',
        '/assets/Project_Img_HydePark_05.webp',
        '/assets/Project_Img_HydePark_06.webp',
        '/assets/Project_Img_HydePark_07.webp',
        '/assets/Project_Img_HydePark_08.webp',
        '/assets/Project_Text_HydePark_01.webp',
        '/assets/Project_Text_HydePark_02.webp',
        '/assets/Project_Text_HydePark_03.webp'
      ]
    }
  ];

  /* Split a description into (projectDetail, strategy) on the first
     paragraph break. Single-paragraph descriptions go to projectDetail
     and leave strategy empty. */
  function splitDescription(text) {
    if (!text) return { detail: '', strategy: '' };
    var idx = text.indexOf('\n\n');
    if (idx < 0) return { detail: text.trim(), strategy: '' };
    return {
      detail:   text.slice(0, idx).trim(),
      strategy: text.slice(idx + 2).trim()
    };
  }

  /* ============================================================
     TEXT SCRAMBLE — same rain-style decode used by the preloader.
     Animates a group of elements in lockstep so resolves cascade
     across the whole panel rather than each paragraph independently.
     Re-running on the same elements cancels any in-flight tick.
     ============================================================ */
  var SCRAMBLE_GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWX1234567890!@#$%^&*()_+{}[]?/><';
  var SCRAMBLE_COLORS = ['rgba(255,255,255,1)', 'rgba(255,255,255,0.5)'];
  var SCRAMBLE_TICK_MS = 600 / 35;
  var SCRAMBLE_RESOLVES_PER_TICK = 9;

  function _scrambleGlyph() {
    return SCRAMBLE_GLYPHS[(Math.random() * SCRAMBLE_GLYPHS.length) | 0];
  }
  function _scrambleColor() {
    return SCRAMBLE_COLORS[(Math.random() * SCRAMBLE_COLORS.length) | 0];
  }

  function scrambleElements(items) {
    var allChars = [];

    for (var r = 0; r < items.length; r++) {
      var el = items[r] && items[r].el;
      if (!el) continue;
      var text = items[r].text == null ? '' : String(items[r].text);

      /* Cancel any prior scramble bound to this element */
      if (el._scrambleTimer) { clearInterval(el._scrambleTimer); el._scrambleTimer = null; }
      el.textContent = '';

      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var code = ch.charCodeAt(0);
        /* Whitespace stays as a plain text node so the browser can
           wrap lines at word boundaries. */
        if (code === 0x20 || code === 0x09 || code === 0x0A ||
            code === 0x0D || code === 0xA0) {
          el.appendChild(document.createTextNode(code === 0x0A ? '\n' : ' '));
          continue;
        }
        /* Seed with the FINAL char so we can measure each slot's
           natural width before swapping in random glyphs. */
        var span = document.createElement('span');
        span.textContent = ch;
        el.appendChild(span);

        allChars.push({
          el: span,
          final: ch,
          resolved: false,
          threshold: (r * 0.6) + (i * 0.15) + (Math.random() * 8)
        });
      }
    }

    if (!allChars.length) return;

    /* Pin each character slot to its natural width. Inline-block plus a
       measured width prevents wider scramble glyphs from nudging
       neighbouring characters during the cycle. Letter-spacing is added
       to each slot so wrap points match the un-locked layout. */
    var letterSpacingPx = 0;
    var firstParent = allChars[0].el.parentNode;
    if (firstParent) {
      var ls = parseFloat(getComputedStyle(firstParent).letterSpacing);
      if (!isNaN(ls)) letterSpacingPx = ls;
    }
    for (var p = 0; p < allChars.length; p++) {
      var sp = allChars[p].el;
      var w = sp.offsetWidth;
      if (w > 0) {
        sp.style.display = 'inline-block';
        sp.style.width = (w + letterSpacingPx) + 'px';
        sp.style.textAlign = 'left';
        sp.style.verticalAlign = 'baseline';
        sp.style.overflow = 'hidden';
      }
      sp.textContent = _scrambleGlyph();
      sp.style.color = _scrambleColor();
    }

    var tickCount = 0;
    var timer = setInterval(function () {
      tickCount++;

      for (var i = 0; i < allChars.length; i++) {
        var c = allChars[i];
        if (!c.resolved) {
          c.el.textContent = _scrambleGlyph();
          c.el.style.color = _scrambleColor();
        }
      }

      var resolvedThisTick = 0;
      var anyUnresolved = false;
      for (var j = 0; j < allChars.length; j++) {
        var c2 = allChars[j];
        if (c2.resolved) continue;
        if (resolvedThisTick < SCRAMBLE_RESOLVES_PER_TICK && tickCount >= c2.threshold) {
          c2.el.textContent = c2.final;
          c2.el.style.color = '';
          c2.resolved = true;
          resolvedThisTick++;
        } else {
          anyUnresolved = true;
        }
      }

      if (!anyUnresolved) {
        clearInterval(timer);
        /* Restore natural inline rendering once everything has resolved
           so letter-spacing applies normally and the final layout
           matches what the page would render without the scramble. */
        for (var u = 0; u < allChars.length; u++) {
          var rs = allChars[u].el;
          rs.style.display = '';
          rs.style.width = '';
          rs.style.textAlign = '';
          rs.style.verticalAlign = '';
          rs.style.overflow = '';
        }
        for (var k = 0; k < items.length; k++) {
          if (items[k] && items[k].el && items[k].el._scrambleTimer === timer) {
            items[k].el._scrambleTimer = null;
          }
        }
      }
    }, SCRAMBLE_TICK_MS);

    for (var n = 0; n < items.length; n++) {
      if (items[n] && items[n].el) items[n].el._scrambleTimer = timer;
    }
  }

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

  /* New right-rail panel + mobile overlay */
  var projectLogo      = document.querySelector('[data-project-logo]');
  var projectDetailEl  = document.querySelector('[data-project-detail]');
  var projectStrategy  = document.querySelector('[data-project-strategy]');
  var projectTimeline  = document.querySelector('[data-project-timeline]');
  var nextProjectLink  = document.querySelector('[data-next-project]');
  var overviewModal    = document.querySelector('[data-overview-modal]');
  var overviewLogo     = document.querySelector('[data-overview-modal-logo]');
  var overviewDetail   = document.querySelector('[data-overview-detail]');
  var overviewStrategy = document.querySelector('[data-overview-strategy]');
  var overviewTimeline = document.querySelector('[data-overview-timeline]');
  var overviewTrigger  = document.querySelector('[data-mobile-overview-trigger]');
  var overviewClose    = document.querySelector('[data-overview-close]');

  /* ============================================================
     META + RIGHT-RAIL OVERLAY
     ============================================================ */
  function setLogo(target, project) {
    if (!target) return;
    target.innerHTML = '';
    if (project.logoSrc) {
      var img = document.createElement('img');
      if (target === projectLogo) img.className = 'project-logo-img';
      img.src = project.logoSrc;
      img.alt = project.title;
      target.appendChild(img);
      target.classList.remove('project-logo--text');
    } else {
      var span = document.createElement('span');
      span.className = 'project-logo-text';
      span.textContent = project.title;
      target.appendChild(span);
      if (target === projectLogo) target.classList.add('project-logo--text');
    }
  }

  function updateMeta(project, index) {
    if (metaNum)      metaNum.textContent     = project.index;
    if (metaServices) metaServices.textContent = project.services;
    if (metaCount)    metaCount.textContent    = '0' + (index + 1) + ' / 0' + PROJECTS.length;
    if (metaFill)     metaFill.style.width     = ((index / Math.max(PROJECTS.length - 1, 1)) * 100) + '%';
    if (metaTitle)    metaTitle.textContent    = project.title;

    /* Right-rail panel — text decodes in via the preloader scramble */
    var parts = splitDescription(project.description);
    scrambleElements([
      { el: projectDetailEl, text: parts.detail },
      { el: projectStrategy, text: parts.strategy },
      { el: projectTimeline, text: project.timeline || '' }
    ]);
    setLogo(projectLogo, project);

    /* Next-project anchor */
    var nextIdx = (index + 1) % PROJECTS.length;
    var next = PROJECTS[nextIdx];
    if (nextProjectLink && next) {
      nextProjectLink.setAttribute('href', '/project/' + next.slug + '/');
    }

    /* Mobile overlay mirrors the same fields */
    if (overviewDetail)   overviewDetail.textContent   = parts.detail;
    if (overviewStrategy) overviewStrategy.textContent = parts.strategy;
    if (overviewTimeline) overviewTimeline.textContent = project.timeline || '';
    setLogo(overviewLogo, project);
  }

  /* ============================================================
     SLUG → INDEX RESOLUTION
     Each per-project HTML stamps its slug onto the Barba container
     (data-project-slug). Falls back to the first project if missing
     or unknown. Legacy sessionStorage handoff is supported for any
     in-flight tabs from the previous deploy.
     ============================================================ */
  function indexFromSlug(slug) {
    if (!slug) return -1;
    for (var i = 0; i < PROJECTS.length; i++) {
      if (PROJECTS[i].slug === slug) return i;
    }
    return -1;
  }

  /* Module-level pointer to the active project container. Set by
     colabProject.init(scope) during Barba transitions. Falls back to
     a query — but during project→project swaps, both old and new
     containers exist briefly and the old one is first in document
     order, so the explicit scope passed by barba-init is the only
     reliable source. */
  var activeContainer = null;

  function getActiveContainer() {
    if (activeContainer && activeContainer.isConnected) return activeContainer;
    /* Cold-load fallback: prefer the last-in-document match, since
       Barba appends new containers after old ones. */
    var nodes = document.querySelectorAll('[data-barba-namespace="project"]');
    if (nodes.length) return nodes[nodes.length - 1];
    return document.body;
  }

  function getInitialIndex() {
    var scope = getActiveContainer();
    var slug = scope && scope.getAttribute && scope.getAttribute('data-project-slug');
    var idx = indexFromSlug(slug);
    if (idx >= 0) return idx;

    /* Legacy fallback — drain stale sessionStorage from older deploys. */
    try {
      var s = sessionStorage.getItem('colab_activeProject');
      if (s !== null) {
        sessionStorage.removeItem('colab_activeProject');
        var legacy = parseInt(s, 10);
        if (legacy >= 0 && legacy < PROJECTS.length) return legacy;
      }
    } catch (e) {}
    return 0;
  }

  function projectUrl(project) {
    return '/project/' + project.slug + '/';
  }

  /* ============================================================
     MOBILE DETECTION
     ============================================================ */
  var isMobile = window.matchMedia('(max-width: 767px)').matches;
  var mobileTitle = document.querySelector('[data-mobile-title]');

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

    /* Load new images (resets scroll to start) */
    gallery.loadImages(project.images);

    /* If going backward, jump camera to last image */
    if (direction === 'backward') {
      gallery.scrollToEnd();
    }

    /* Reflect the active project in the URL + title without a full
       Barba navigation. Keeps each project independently shareable
       even when reached via swipe-to-next, without re-running the
       whole transition pipeline. */
    try {
      var newUrl = projectUrl(project);
      if (window.location.pathname !== newUrl) {
        window.history.replaceState({}, '', newUrl);
      }
    } catch (e) {}
    document.title = project.title + ' — co:lab';

    /* Update the container slug so future _doSwap-after-Barba calls
       resolve to the right project. */
    var scope = getActiveContainer();
    if (scope && scope.setAttribute) {
      scope.setAttribute('data-project-slug', project.slug);
    }
  }

  /* ============================================================
     NEXT PROJECT LINK
     Use the same shader-wipe transition as gallery scroll-past-end
     instead of letting Barba handle the navigation, so the next
     project loads in-place with the existing animation.
     ============================================================ */
  function bindNextProjectLink() {
    if (!nextProjectLink || nextProjectLink._colabBound) return;
    nextProjectLink._colabBound = true;
    nextProjectLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (scrollHint) scrollHint.classList.add('is-hidden');
      var nextIdx = (currentIndex + 1) % PROJECTS.length;
      transitionToProject(nextIdx, 'forward');
    });
  }

  /* ============================================================
     MOBILE OVERVIEW MODAL
     Tap "read overview" → modal slides in. Close via [ CLOSE PROJECT ]
     button. Click outside the inner content also dismisses.
     ============================================================ */
  function openOverviewModal() {
    if (!overviewModal) return;
    overviewModal.classList.add('is-open');
    overviewModal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('has-overview-modal-open');
    if (gallery && gallery.pauseIdle) gallery.pauseIdle();

    /* Re-run the scramble decode each time the overview opens so the
       text reveals in like the preloader rather than appearing flat. */
    var p = PROJECTS[currentIndex];
    if (p) {
      var parts = splitDescription(p.description);
      scrambleElements([
        { el: overviewDetail,   text: parts.detail },
        { el: overviewStrategy, text: parts.strategy },
        { el: overviewTimeline, text: p.timeline || '' }
      ]);
    }
  }

  function closeOverviewModal() {
    if (!overviewModal) return;
    overviewModal.classList.remove('is-open');
    overviewModal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('has-overview-modal-open');
    if (gallery && gallery.resumeIdle) gallery.resumeIdle();
  }

  function bindOverviewModal() {
    if (overviewTrigger && !overviewTrigger._colabBound) {
      overviewTrigger._colabBound = true;
      overviewTrigger.addEventListener('click', function (e) {
        e.preventDefault();
        openOverviewModal();
      });
    }
    if (overviewClose && !overviewClose._colabBound) {
      overviewClose._colabBound = true;
      overviewClose.addEventListener('click', function (e) {
        e.preventDefault();
        closeOverviewModal();
      });
    }
  }

  /* ============================================================
     INIT — UI (no gallery deps)
     Runs as soon as the DOM is in place so the right-rail panel,
     next-project link, and mobile overview modal are functional
     even on cold loads where THREE.js hasn't been pulled in yet.
     ============================================================ */
  function initUI() {
    var startIdx = getInitialIndex();
    currentIndex = startIdx;
    var project  = PROJECTS[startIdx];

    updateMeta(project, startIdx);
    bindNextProjectLink();
    bindOverviewModal();

    if (isMobile) updateMobileTitle(project);
  }

  /* ============================================================
     INIT — GALLERY (waits for THREE + DepthGallery)
     ============================================================ */
  function initGallery() {
    var project = PROJECTS[currentIndex];

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

    /* Signal page ready */
    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
    });
  }

  function destroy() {
    if (gallery) {
      gallery.destroy();
      gallery = null;
    }
    currentIndex = 0;
    document.body.classList.remove('is-ready');
    document.body.classList.remove('has-overview-modal-open');
  }

  /* Auto-init on cold load: UI immediately, gallery once libs land. */
  if (document.body.classList.contains('project-page')) {
    initUI();
    (function waitForLibs() {
      if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') initGallery();
      else setTimeout(waitForLibs, 50);
    })();
  }

  /* Expose for Barba transitions.
     Accepts the new container explicitly (data.next.container) so we
     scope to the right one — during a project→project swap the old
     container is still in the DOM and would otherwise win the query. */
  window.colabProject = {
    init: function (nextContainer) {
      var scope = nextContainer
        || document.querySelectorAll('[data-barba-namespace="project"]')[
             document.querySelectorAll('[data-barba-namespace="project"]').length - 1
           ]
        || document;
      activeContainer = scope;
      isMobile = window.matchMedia('(max-width: 767px)').matches;
      mobileTitle = scope.querySelector('[data-mobile-title]');
      canvas = scope.querySelector('[data-depth-canvas]');
      canvasWrap = scope.querySelector('[data-project-canvas-wrap]');
      metaNum = scope.querySelector('[data-meta-num]');
      metaTitle = scope.querySelector('[data-meta-title]');
      metaServices = scope.querySelector('[data-meta-services]');
      metaFill = scope.querySelector('[data-meta-fill]');
      metaCount = scope.querySelector('[data-meta-count]');
      scrollHint = scope.querySelector('[data-scroll-hint]');
      projectLogo      = scope.querySelector('[data-project-logo]');
      projectDetailEl  = scope.querySelector('[data-project-detail]');
      projectStrategy  = scope.querySelector('[data-project-strategy]');
      projectTimeline  = scope.querySelector('[data-project-timeline]');
      nextProjectLink  = scope.querySelector('[data-next-project]');
      overviewModal    = scope.querySelector('[data-overview-modal]');
      overviewLogo     = scope.querySelector('[data-overview-modal-logo]');
      overviewDetail   = scope.querySelector('[data-overview-detail]');
      overviewStrategy = scope.querySelector('[data-overview-strategy]');
      overviewTimeline = scope.querySelector('[data-overview-timeline]');
      overviewTrigger  = scope.querySelector('[data-mobile-overview-trigger]');
      overviewClose    = scope.querySelector('[data-overview-close]');
      if (!canvas || !canvasWrap) return;
      initUI();
      (function waitForLibs() {
        if (typeof THREE !== 'undefined' && typeof DepthGallery !== 'undefined') initGallery();
        else setTimeout(waitForLibs, 50);
      })();
    },
    destroy: destroy
  };

}());
