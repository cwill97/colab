
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
      services: 'Visual Language · Development · 3D',
      logoSrc:  'https://colab-site.b-cdn.net/viking/Project_Logo_Viking.svg',
      liveUrl:  'https://viking-gear.store/',
      timeline: 'October 2025 — May 2026',
      credits:  'Creative Direction, Design & Development — co:lab',
      metaDescription: 'Brand development, web design, e-commerce, 3D and animation for Viking Gear — primal training tools reimagined as modern rituals of discipline and mastery.',
      description: 'Viking Gear forges strength through primal movement. Rooted in the warrior spirit, it reimagines ancient training tools such as maces, clubs, and hammers as modern extensions of discipline, flow, and mastery. Every piece honours resilience, balance, and raw power, turning training into ritual.\n\nWe built the brand from the ground up. We shaped the strategy, art direction, and complete visual identity, creating a bold, purposeful world where ancient form meets contemporary performance.',
      images: [
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_01.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_02.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_03.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_04.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_05.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_06.webp',
        'https://colab-site.b-cdn.net/viking/Project_video_Viking_1.mp4',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_7.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_8.webp',
        'https://colab-site.b-cdn.net/viking/Project_Img_Viking_9.webp'
      ]
    },
    {
      slug:     'rebel-kids-club',
      index:    '002',
      title:    'Rebel Kids Club',
      services: 'Brand Development · Photography · E-Commerce · Web Design',
      logoSrc:  'https://colab-site.b-cdn.net/rebel-kids/Project_Logo_Rebel.svg',
      liveUrl:  '',
      timeline: 'TBD',
      credits:  'Creative Direction, Design & Development — co:lab',
      metaDescription: 'Gender-neutral toddler fashion brand. Full identity system, photography direction and e-commerce design for Rebel Kids Club — bold, inclusive and unmistakably its own.',
      description: 'Rebel Kids Club breaks the pink and blue code. It redefines toddler fashion with gender neutral clothing that celebrates individuality, intention, and timeless style from day one. Bold yet grounded, modern yet wearable, every piece gives parents a fresh way to dress their little rebels.\n\nWe built the brand from the ground up. We created the full identity system, from name and positioning to visual language and guidelines, crafting a distinctive voice that feels confident, inclusive, and unmistakably its own.',
      images: [
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_01.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_02.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_02.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_03.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_04.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_05.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_06.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_07.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_08.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_09.webp',
        'https://colab-site.b-cdn.net/rebel-kids/Project_Img_Rebel_10.webp',
      ]
    },
    {
      slug:     'mannequin-films',
      index:    '003',
      title:    'Mannequin Films',
      services: 'Brand Development · Web Design · Motion',
      logoSrc:  'https://colab-site.b-cdn.net/mannequin/Project_Logo_Mannequin.svg',
      liveUrl:  'https://www.mannequinfilms.co.za/',
      timeline: 'TBD',
      credits:  'Creative Direction, Design & Development — co:lab',
      metaDescription: 'Cinematic rebrand for Mannequin Films — brand identity, web design and motion that distil their visual storytelling into a timeless, alive language.',
      description: 'Mannequin Films captures the raw poetry of visual storytelling. Through photography and video, they transform fleeting moments into enduring narratives that resonate with authenticity and precision. Every frame is crafted with intention, blending creativity, emotion, and technical excellence to bring stories to life.\n\nWe led a full rebrand, forging a new identity that honours their cinematic roots while sharpening their contemporary edge. From the refined brandmark to the complete visual system, we distilled their essence into a cohesive language that feels both timeless and alive.',
      images: [
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_01.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_02.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_03.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_04.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_05.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_06.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_07.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_08.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_09.webp',
        'https://colab-site.b-cdn.net/mannequin/Project_Img_Mannequin_10.webp'
      ]
    },
    {
      slug:     'hyde-park-ventures',
      index:    '004',
      title:    'Hyde Park Ventures (Five Guys)',
      services: 'Web Design · Web Development · Brand Consolidation',
      logoSrc:  'https://colab-site.b-cdn.net/hyde-park/Project_Logo_Hydepark.svg',
      liveUrl:  'https://www.hydeparkventures.com/five-guys',
      timeline: 'TBD',
      credits:  'Creative Direction, Design & Development — co:lab',
      metaDescription: 'Website consolidation and digital modernisation for Hyde Park Ventures — a unified platform that brings clarity to a diverse portfolio.',
      description: 'Website consolidation and digital modernisation for Hyde Park Ventures, creating a unified platform that brings clarity to a diverse portfolio. Delivered a streamlined, future-ready experience that improves navigation, strengthens brand consistency, and supports ongoing growth.',
      images: [
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_01.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_02.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_03.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_04.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_05.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_06.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_07.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_08.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_09.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_10.webp',
        'https://colab-site.b-cdn.net/hyde-park/Project_Img_HydePark_11.webp'
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
  var nextLabel    = null;

  /* New right-rail panel + mobile overlay */
  var projectLogo      = document.querySelector('[data-project-logo]');
  var projectClient    = document.querySelector('[data-project-client]');
  var projectServices  = document.querySelector('[data-project-services]');
  var projectDetailEl  = document.querySelector('[data-project-detail]');
  var projectStrategy  = document.querySelector('[data-project-strategy]');
  var projectTimeline  = document.querySelector('[data-project-timeline]');
  var projectCredits   = document.querySelector('[data-project-credits]');
  var nextProjectLink  = document.querySelector('[data-next-project]');
  var prevProjectLink  = document.querySelector('[data-prev-project]');
  var overviewModal    = document.querySelector('[data-overview-modal]');
  var overviewLogo     = document.querySelector('[data-overview-modal-logo]');
  var overviewClient   = document.querySelector('[data-overview-client]');
  var overviewServices = document.querySelector('[data-overview-services]');
  var overviewDetail   = document.querySelector('[data-overview-detail]');
  var overviewStrategy = document.querySelector('[data-overview-strategy]');
  var overviewTimeline = document.querySelector('[data-overview-timeline]');
  var overviewCredits  = document.querySelector('[data-overview-credits]');
  var overviewLive     = document.querySelector('[data-overview-live-project]');
  var overviewTrigger  = document.querySelector('[data-mobile-overview-trigger]');
  var mobileServices   = document.querySelector('[data-mobile-services]');
  var mobileYear       = document.querySelector('[data-mobile-year]');
  var mobileLogo       = document.querySelector('[data-mobile-logo]');
  var overviewClose    = document.querySelector('[data-overview-close]');
  var liveProjectLink  = document.querySelector('[data-live-project]');

  /* ============================================================
     META + RIGHT-RAIL OVERLAY
     ============================================================ */
  function setLogo(target, project) {
    if (!target) return;
    target.innerHTML = '';
    if (project.logoSrc) {
      var img = document.createElement('img');
      if (target === projectLogo) img.className = 'project-logo-img';
      else if (target === mobileLogo) img.className = 'project-mobile-logo-img';
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

    /* Mobile info block (Role / Year, between title and CTA) */
    if (mobileServices) mobileServices.textContent = project.services || '';
    if (mobileYear)     mobileYear.textContent     = project.timeline || '';

    /* Right-rail panel */
    var parts = splitDescription(project.description);
    if (projectClient)    projectClient.textContent    = project.title || '';
    if (projectServices)  projectServices.textContent  = project.services || '';
    if (projectDetailEl)  projectDetailEl.textContent  = parts.detail;
    if (projectStrategy)  projectStrategy.textContent  = parts.strategy;
    if (projectTimeline)  projectTimeline.textContent  = project.timeline || '';
    if (projectCredits)   projectCredits.textContent   = project.credits || '';
    setLogo(projectLogo, project);
    setLogo(mobileLogo, project);

    /* View live project link */
    if (liveProjectLink) {
      if (project.liveUrl) {
        liveProjectLink.setAttribute('href', project.liveUrl);
        liveProjectLink.style.display = '';
      } else {
        liveProjectLink.style.display = 'none';
      }
    }

    /* Next + previous project anchors */
    var nextIdx = (index + 1) % PROJECTS.length;
    var prevIdx = (index - 1 + PROJECTS.length) % PROJECTS.length;
    var next = PROJECTS[nextIdx];
    var prev = PROJECTS[prevIdx];
    if (nextProjectLink && next) {
      nextProjectLink.setAttribute('href', '/project/' + next.slug + '/');
    }
    if (prevProjectLink && prev) {
      prevProjectLink.setAttribute('href', '/project/' + prev.slug + '/');
    }

    /* Mobile overlay mirrors the same fields */
    if (overviewClient)   overviewClient.textContent   = project.title || '';
    if (overviewServices) overviewServices.textContent = project.services || '';
    if (overviewDetail)   overviewDetail.textContent   = parts.detail;
    if (overviewStrategy) overviewStrategy.textContent = parts.strategy;
    if (overviewTimeline) overviewTimeline.textContent = project.timeline || '';
    if (overviewCredits)  overviewCredits.textContent  = project.credits || '';
    if (overviewLive) {
      if (project.liveUrl) {
        overviewLive.setAttribute('href', project.liveUrl);
        overviewLive.style.display = '';
      } else {
        overviewLive.style.display = 'none';
      }
    }
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

    if (nextLabel) nextLabel.classList.remove('is-revealed');
    if (canvasWrap) canvasWrap.classList.remove('is-end-revealed');

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

  function bindPrevProjectLink() {
    if (!prevProjectLink || prevProjectLink._colabBound) return;
    prevProjectLink._colabBound = true;
    prevProjectLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (scrollHint) scrollHint.classList.add('is-hidden');
      var prevIdx = (currentIndex - 1 + PROJECTS.length) % PROJECTS.length;
      transitionToProject(prevIdx, 'backward');
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
    bindPrevProjectLink();
    bindOverviewModal();

    if (isMobile) {
      updateMobileTitle(project);
    }
    /* Build the "scroll to next" cue on every viewport — required for
       the two-stage overscroll commit on both mobile and desktop. */
    ensureNextLabel();
  }

  /* Inject the "scroll to next" overscroll cue inside the canvas wrap.
     Hidden by default, revealed when gallery overscroll passes its
     first-stage threshold, then hidden again on retreat or when the
     transition commits. Applies on both mobile and desktop — the user
     must scroll past this cue to navigate to the next project (no
     auto-advance). */
  function ensureNextLabel() {
    if (!canvasWrap) return;
    var existing = canvasWrap.querySelector('[data-scroll-next]');
    if (existing) { nextLabel = existing; return; }
    nextLabel = document.createElement('div');
    nextLabel.className = 'project-scroll-next';
    nextLabel.setAttribute('data-scroll-next', '');
    nextLabel.setAttribute('aria-hidden', 'true');
    nextLabel.innerHTML =
      '<div class="scroll-hint-line"></div>' +
      '<span>scroll to next</span>' +
      '<div class="scroll-hint-line"></div>';
    canvasWrap.appendChild(nextLabel);
  }

  /* ============================================================
     MOBILE TEXT REVEAL
     Word-by-word blur entrance matching the studio-intro effect.
     ============================================================ */
  function _splitWords(el) {
    var text = el.textContent.trim();
    var words = text.split(/\s+/);
    el.innerHTML = words.map(function (w) {
      return '<span class="word">' + w + '</span>';
    }).join(' ');
    el.style.textIndent = '0';
    return el.querySelectorAll('.word');
  }

  function _blurEntrance(el, delay) {
    if (!el || typeof gsap === 'undefined') return;
    var words = _splitWords(el);
    gsap.fromTo(words, {
      opacity: 0,
      filter: 'blur(8px)'
    }, {
      ease: 'sine.out',
      opacity: 1,
      filter: 'blur(0px)',
      stagger: 0.02,
      duration: 0.4,
      delay: delay || 0
    });
  }

  function _triggerMobileReveal() {
    if (!isMobile || typeof gsap === 'undefined') return;

    var infoBlock  = document.querySelector('.project-mobile-info');
    var logoEl     = document.querySelector('.project-mobile-logo');
    var metaValues = document.querySelectorAll('.project-mobile-meta-value');
    var triggerBtn = document.querySelector('[data-mobile-overview-trigger]');

    if (!infoBlock) return;

    /* Override CSS opacity-on-is-ready — GSAP controls all child reveals */
    gsap.set(infoBlock, { opacity: 1 });

    /* Logo — fade up */
    if (logoEl) {
      gsap.fromTo(logoEl,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.6, delay: 0.1, ease: 'power2.out' }
      );
    }

    /* Services / Year values — blur word entrance */
    metaValues.forEach(function (el, i) {
      _blurEntrance(el, 0.25 + i * 0.2);
    });

    /* "Read overview" button — wipe in from left */
    if (triggerBtn) {
      gsap.fromTo(triggerBtn,
        { clipPath: 'inset(0 100% 0 0)' },
        { clipPath: 'inset(0 0% 0 0)', duration: 0.6, delay: 0.9, ease: 'power3.inOut' }
      );
    }
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

    /* ── Scroll past end → next project ──
       Two-stage overscroll on every viewport: the "scroll to next"
       label reveals at the first threshold (UI cue) and the gallery
       canvas fades to hidden, then the project transition commits
       only after the user keeps scrolling past a higher threshold.
       This means a user is never auto-advanced — they must explicitly
       scroll past the cue to navigate forward.
       Backward auto-transition is disabled — the start of a project
       simply blocks. */
    gallery.onReachEnd = function () {
      var nextIdx = (currentIndex + 1) % PROJECTS.length;
      transitionToProject(nextIdx, 'forward');
    };

    gallery._overscrollCommitThreshold = 220;
    gallery.onEndLabelReveal = function () {
      if (nextLabel) nextLabel.classList.add('is-revealed');
      if (canvasWrap) canvasWrap.classList.add('is-end-revealed');
    };
    gallery.onEndLabelHide = function () {
      if (nextLabel) nextLabel.classList.remove('is-revealed');
      if (canvasWrap) canvasWrap.classList.remove('is-end-revealed');
    };

    gallery.start();

    /* Signal page ready + trigger mobile text reveal */
    requestAnimationFrame(function () {
      document.body.classList.add('is-ready');
      _triggerMobileReveal();
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
      nextLabel  = scope.querySelector('[data-scroll-next]');
      projectLogo      = scope.querySelector('[data-project-logo]');
      projectClient    = scope.querySelector('[data-project-client]');
      projectServices  = scope.querySelector('[data-project-services]');
      projectDetailEl  = scope.querySelector('[data-project-detail]');
      projectStrategy  = scope.querySelector('[data-project-strategy]');
      projectTimeline  = scope.querySelector('[data-project-timeline]');
      nextProjectLink  = scope.querySelector('[data-next-project]');
      prevProjectLink  = scope.querySelector('[data-prev-project]');
      overviewModal    = scope.querySelector('[data-overview-modal]');
      overviewLogo     = scope.querySelector('[data-overview-modal-logo]');
      overviewClient   = scope.querySelector('[data-overview-client]');
      overviewServices = scope.querySelector('[data-overview-services]');
      overviewDetail   = scope.querySelector('[data-overview-detail]');
      overviewStrategy = scope.querySelector('[data-overview-strategy]');
      overviewTimeline = scope.querySelector('[data-overview-timeline]');
      overviewLive     = scope.querySelector('[data-overview-live-project]');
      overviewTrigger  = scope.querySelector('[data-mobile-overview-trigger]');
      mobileLogo       = scope.querySelector('[data-mobile-logo]');
      overviewClose    = scope.querySelector('[data-overview-close]');
      liveProjectLink  = scope.querySelector('[data-live-project]');
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
