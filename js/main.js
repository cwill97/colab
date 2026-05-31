
(function () {
  'use strict';

  /* ----------------------------------------------------------
     Nav toggle — shader-reveal menu transitions
     Open:  wipe out → show menu → reveal in
     Close: wipe out → hide menu → reveal in
     ---------------------------------------------------------- */
  function initNavToggle() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var menu   = document.querySelector('[data-nav-menu]');
    if (!toggle || !menu) return;

    /* Guard: only bind once — nav is persistent across Barba swaps */
    if (toggle._colabBound) return;
    toggle._colabBound = true;

    var menuTransitioning = false;

    var MENU_TRACK = '/assets/menu.mp3';
    function pageTrack() {
      return document.body.classList.contains('about-page')
        ? '/assets/Colab_Studio-v2.mp3'
        : '/assets/ambient.mp3';
    }

    function showMenu() {
      /* Re-resolve the active page right before the menu paints, so the
         flashing square always lands on the correct row even if the
         page changed without main.js's boot re-running. */
      if (window.colabSyncMenuCurrent) window.colabSyncMenuCurrent();
      toggle.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      document.body.setAttribute('data-menu-open', '');
      /* Swap to the menu-only track, then submerge for the underwater muffle */
      if (window.colabAudio) {
        if (window.colabAudio.setTrack) window.colabAudio.setTrack(MENU_TRACK);
        window.colabAudio.submerge();
      }
    }

    function hideMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      document.body.removeAttribute('data-menu-open');
      /* Restore the page's track, then surface — but stay submerged on project page */
      if (window.colabAudio) {
        if (window.colabAudio.setTrack) window.colabAudio.setTrack(pageTrack());
        if (document.body.classList.contains('project-page')) {
          window.colabAudio.submerge(0.6);
        } else {
          window.colabAudio.surface();
        }
      }
    }

    function doTransition(showOrHide) {
      if (menuTransitioning) return;
      menuTransitioning = true;

      var ST = window.ShaderTransition;
      if (!ST) {
        /* Fallback if shader system not ready — instant swap */
        showOrHide();
        menuTransitioning = false;
        return;
      }

      /* Reset the shader lock so we can fire a new wipe */
      ST.resetLock();

      ST.wipeOut(function () {
        /* Screen is fully black — swap state */
        showOrHide();

        /* Small delay then reveal the new state */
        setTimeout(function () {
          ST.revealIn(0.0);
          /* Unlock after reveal finishes (~2s) */
          setTimeout(function () { menuTransitioning = false; }, 2200);
        }, 120);
      });
    }

    toggle.addEventListener('click', function () {
      var isOpen = toggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        doTransition(hideMenu);
      } else {
        doTransition(showMenu);
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        doTransition(hideMenu);
      }
    });

    /* Menu links — close the menu when a link is clicked.
       - If already on the target page, intercept and just close with shader transition.
       - If navigating to a different page, DO NOT close the menu state here.
         The menu must stay visible so it's hidden BEHIND Barba's shader wipe;
         closing it synchronously briefly exposes the underlying page (homepage
         flash). Barba's afterLeave hook calls colabHideMenuChrome() once the
         screen is fully covered by the shader. */
    function bindMenuLink(selector, targetNs) {
      var link = menu.querySelector(selector);
      if (!link || link._colabBound) return;
      link._colabBound = true;
      link.addEventListener('click', function (e) {
        var container = document.querySelector('[data-barba="container"]');
        var currentNs = container && container.getAttribute('data-barba-namespace');
        if (currentNs === targetNs) {
          /* Already here — just close the menu with the full shader transition */
          e.preventDefault();
          doTransition(hideMenu);
        }
        /* Cross-page nav — fall through. Barba intercepts the click and runs
           its leave transition (wipeOut). Menu stays open under the shader
           and is silently closed in barba-init.js's afterLeave hook. */
      });
    }

    bindMenuLink('[data-menu-home]', 'home');
    bindMenuLink('[data-menu-about]', 'about');

    /* Expose a chrome-only menu close for Barba's afterLeave hook. This
       skips the audio handling because Barba's leave/after manage audio
       directly during page transitions — surfacing here would briefly
       fight Barba's submerge call. */
    window.colabHideMenuChrome = function () {
      toggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      document.body.removeAttribute('data-menu-open');
    };
  }

  /* ----------------------------------------------------------
     Project list — custom scroll thumb
     ---------------------------------------------------------- */
  function initScrollThumb() {
    var list  = document.querySelector('[data-scroll-list]');
    var thumb = document.querySelector('.project-scroll-thumb');
    if (!list || !thumb) return;

    function updateThumb() {
      var trackH    = list.clientHeight;
      var scrollH   = list.scrollHeight;
      var scrollTop = list.scrollTop;
      var thumbH    = Math.max((trackH / scrollH) * trackH, 24);
      var maxTravel = trackH - thumbH;
      var progress  = scrollTop / (scrollH - trackH);
      var thumbY    = progress * maxTravel;
      thumb.style.height    = thumbH + 'px';
      thumb.style.transform = 'translateY(' + thumbY + 'px)';
    }

    updateThumb();
    list.addEventListener('scroll', updateThumb, { passive: true });
  }

  /* ----------------------------------------------------------
     Square button — fires the 3-layer glitch (blink + RGB split
     + crash) every 3s while the menu is closed. The active-page
     hard-blink lives elsewhere; we skip glitching when the menu
     is open so the two effects don't fight.
     ---------------------------------------------------------- */
  function initButtonGlitch() {
    var icon = document.querySelector('.nav-toggle-icon');
    if (!icon) return;

    if (icon._colabGlitch) return;
    icon._colabGlitch = true;

    function triggerGlitch() {
      var toggle = document.querySelector('[data-nav-toggle]');
      if (toggle && toggle.getAttribute('aria-expanded') === 'true') return;
      icon.classList.add('is-glitching');
      setTimeout(function () { icon.classList.remove('is-glitching'); }, 600);
    }

    setInterval(triggerGlitch, 3000);
  }


  /* ----------------------------------------------------------
     About text — swap between full and mobile versions
     ---------------------------------------------------------- */
  function initAboutText() {
    var el = document.querySelector('[data-full-text]');
    if (!el) return;
    // Homepage-only: the project page reuses .about-text for the active
    // project's description (owned by project-boot.js), so skip when
    // there's no mobile variant to swap to.
    if (!el.hasAttribute('data-mobile-text')) return;

    var fullText   = el.getAttribute('data-full-text')   || el.textContent;
    var mobileText = el.getAttribute('data-mobile-text') || fullText;

    function applyText() {
      var isMobile = window.innerWidth < 768;
      var desired  = isMobile ? mobileText : fullText;
      if (el.textContent.trim() !== desired) el.textContent = desired;
    }

    applyText();

    // Guard the global resize listener — Barba calls colabMainBoot() on
    // every navigation, and without a flag we'd accumulate one resize
    // listener per visit.
    if (initAboutText._resizeBound) return;
    initAboutText._resizeBound = true;

    var resizePending = false;
    window.addEventListener('resize', function () {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(function () {
        var live = document.querySelector('[data-full-text][data-mobile-text]');
        if (live) {
          var isMobile = window.innerWidth < 768;
          var desired  = isMobile
            ? (live.getAttribute('data-mobile-text') || '')
            : (live.getAttribute('data-full-text')   || '');
          if (desired && live.textContent.trim() !== desired) live.textContent = desired;
        }
        resizePending = false;
      });
    }, { passive: true });
  }

  /* ----------------------------------------------------------
     Project card click — entire card is clickable; clicks
     anywhere on .project-item delegate to the inner anchor so
     Barba intercepts and runs the wipe transition.
     ---------------------------------------------------------- */
  function initProjectLinks() {
    var items = document.querySelectorAll('.project-item');
    items.forEach(function (item) {
      if (item._colabCardBound) return;
      item._colabCardBound = true;

      item.addEventListener('click', function (e) {
        /* If the click was already on the anchor itself, let it through */
        if (e.target.closest('[data-project-link]')) return;
        var link = item.querySelector('[data-project-link]');
        if (link) link.click();
      });
    });
  }

  /* ----------------------------------------------------------
     Project image mask reveal
     ---------------------------------------------------------- */
  function initProjectImageReveal() {
    var imgA  = document.querySelector('[data-image-current]');
    var imgB  = document.querySelector('[data-image-incoming]');
    var items = document.querySelectorAll('[data-preview-image]');

    if (!imgA || !imgB || !items.length) return;

    var OPEN   = 'inset(0 0% 0 0)';
    var CLOSED = 'inset(0 100% 0 0)';
    var EASE   = 'clip-path 0.65s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

    /* Set initial states — imgA fully visible, imgB fully hidden */
    imgA.style.transition = 'none';
    imgA.style.clipPath   = OPEN;
    imgB.style.transition = 'none';
    imgB.style.clipPath   = CLOSED;
    var hovered    = null;
    var currentSrc = imgA.src; /* track what imgA is actually showing */

    /* Hard-set clip with no animation — two rAF frames to guarantee
       the browser paints the no-transition state before re-enabling */
    function snapClip(el, clip, thenAnimate) {
      el.style.transition = 'none';
      el.style.clipPath   = clip;
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          el.style.transition = EASE;
          if (thenAnimate) thenAnimate();
        });
      });
    }

    function onEnter(item) {
      var src = item.getAttribute('data-preview-image');
      if (!src) return;

      var isNew = (item !== hovered);
      hovered   = item;

      /* Resolve to absolute URL the same way the browser does,
         so we can compare against imgA.src (which is always absolute) */
      var tmpA = document.createElement('a');
      tmpA.href = src;
      var absSrc = tmpA.href;

      if (isNew) {
        /* If imgA is already showing this image, silently swap imgA
           so imgB can animate over it from scratch */
        if (absSrc === currentSrc) {
          /* Give imgA a transparent placeholder so imgB's reveal is visible */
          imgA.style.transition = 'none';
          imgA.style.clipPath   = CLOSED;
        }

        imgB.src = src;
        /* Snap to closed, then animate open once transition is restored */
        snapClip(imgB, CLOSED, function () {
          if (hovered === item) {
            imgB.style.clipPath = OPEN;
          }
        });
      } else {
        /* Same item re-entered mid-retract — just open it */
        imgB.style.transition = EASE;
        imgB.style.clipPath   = OPEN;
      }
    }

    function onLeave(item) {
      if (item !== hovered) return;
      hovered = null;
      /* Restore imgA visibility in case it was hidden for same-src reveal */
      imgA.style.transition = 'none';
      imgA.style.clipPath   = OPEN;
      imgB.style.transition = EASE;
      imgB.style.clipPath   = CLOSED;
    }

    /* Promote imgB → imgA when fully open */
    imgB.addEventListener('transitionend', function (e) {
      if (e.propertyName !== 'clip-path') return;
      if (imgB.style.clipPath !== OPEN || !hovered) return;

      /* Swap silently */
      imgA.style.transition = 'none';
      imgA.src = imgB.src;
      imgA.style.clipPath = OPEN;
      currentSrc = imgA.src; /* keep our tracker in sync */

      imgB.style.transition = 'none';
      imgB.style.clipPath   = CLOSED;
    });

    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () { onEnter(item); });
      item.addEventListener('mouseleave', function () { onLeave(item); });
    });
  }

  /* ----------------------------------------------------------
     Mobile project list — Porto Rocha-style scroll
     ----------------------------------------------------------
     Native touch momentum stays (so iOS feels like iOS), but on
     top of it we run a RAF loop that:
       1. Maps every card's distance-from-focus-line to a 0..1
          "--focus" CSS variable, so opacity/scale/translate
          interpolate smoothly with scroll position rather than
          snapping on a class toggle.
       2. After the user lifts off and momentum settles, eases
          scrollTop to the nearest card top with an expo-out
          curve (the same shape Porto Rocha uses via GSAP).
     The legacy .is-scrolled-active class is still applied for
     downstream code (audio, click handlers) that may listen.
     ---------------------------------------------------------- */
  function initMobileProjects() {
    if (window.innerWidth >= 768) return;

    var items = document.querySelectorAll('.project-item');
    var list  = document.querySelector('[data-scroll-list]');
    if (!items.length || !list) return;

    /* Guard: rebinding would stack RAF loops on every Barba return. */
    if (list._colabSmoothScroll) return;
    list._colabSmoothScroll = true;

    /* ── Inject thumbnails + wrap text content ── */
    items.forEach(function (item) {
      var src = item.getAttribute('data-preview-image');
      if (!src || item.querySelector('.project-thumb-mobile')) return;

      var img = document.createElement('img');
      img.className = 'project-thumb-mobile';
      img.src = src;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');

      var wrapper = document.createElement('div');
      wrapper.className = 'project-content-mobile';
      while (item.firstChild) {
        wrapper.appendChild(item.firstChild);
      }

      item.appendChild(img);
      item.appendChild(wrapper);
    });

    /* ── Measure snap targets ── */
    var snapTops = [];     /* offsetTop of each card, used as snap points */
    var snapSpan = 1;      /* avg distance between snaps — drives focus falloff */

    function measure() {
      snapTops.length = 0;
      for (var i = 0; i < items.length; i++) snapTops.push(items[i].offsetTop);
      if (snapTops.length > 1) {
        var total = 0;
        for (var j = 1; j < snapTops.length; j++) total += (snapTops[j] - snapTops[j - 1]);
        snapSpan = total / (snapTops.length - 1);
      } else {
        snapSpan = list.clientHeight || 1;
      }
    }
    measure();

    /* ── Per-frame focus update — bind --focus to scrollTop ──
       Called directly from the scroll handler. Browsers already cap
       scroll events to the frame rate, so an extra RAF hop adds
       latency without saving work (and in headless/hidden tabs it
       stops the focus pipeline entirely). */
    var activeItem = null;
    var lastScrollTop = -2;

    function updateFocus() {
      var st = list.scrollTop;
      if (st === lastScrollTop) return;
      lastScrollTop = st;

      var bestIdx = 0;
      var bestFocus = -1;

      for (var i = 0; i < items.length; i++) {
        var dist  = Math.abs(snapTops[i] - st);
        /* Focus = 1 at the snap point, 0 at one full span away.
           Smoothstep falloff so the active card holds focus longer
           and neighbours fade in more gently — matches the Porto
           Rocha "weighted center" feel where one card dominates. */
        var t     = Math.min(dist / snapSpan, 1);
        var focus = 1 - t * t * (3 - 2 * t);
        items[i].style.setProperty('--focus', focus.toFixed(3));
        if (focus > bestFocus) {
          bestFocus = focus;
          bestIdx   = i;
        }
      }

      var best = items[bestIdx];
      if (best !== activeItem) {
        if (activeItem) activeItem.classList.remove('is-scrolled-active');
        best.classList.add('is-scrolled-active');
        activeItem = best;
      }
    }

    /* ── Eased snap-to-nearest after momentum settles ── */
    var snapAnim   = null;       /* { startTop, target, startTime, dur } */
    var snapRaf    = 0;
    var idleTimer  = 0;
    var touching   = false;
    var lastScrollEventAt = 0;
    var SNAP_IDLE_MS  = 140;     /* time of no scroll events before we snap */
    var SNAP_DUR_BASE = 520;     /* base ease duration */
    var SNAP_DUR_MAX  = 880;     /* scaled up for longer travel */

    /* Expo-out — the curve Porto Rocha favours (GSAP "expo"). */
    function easeOutExpo(t) {
      return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
    }

    function cancelSnap() {
      if (snapRaf) cancelAnimationFrame(snapRaf);
      snapRaf  = 0;
      snapAnim = null;
    }

    function nearestSnapTop(from) {
      var best = snapTops[0];
      var bestDist = Math.abs(from - best);
      for (var i = 1; i < snapTops.length; i++) {
        var d = Math.abs(from - snapTops[i]);
        if (d < bestDist) { bestDist = d; best = snapTops[i]; }
      }
      /* Clamp to scrollable range so we never animate past the bottom. */
      var max = list.scrollHeight - list.clientHeight;
      if (best > max) best = max;
      if (best < 0)   best = 0;
      return best;
    }

    function tickSnap() {
      if (!snapAnim) return;
      var now = performance.now();
      var p   = (now - snapAnim.startTime) / snapAnim.dur;
      if (p >= 1) {
        list.scrollTop = snapAnim.target;
        snapAnim = null;
        snapRaf  = 0;
        updateFocus();
        return;
      }
      var eased = easeOutExpo(p);
      list.scrollTop = snapAnim.startTop + (snapAnim.target - snapAnim.startTop) * eased;
      snapRaf = requestAnimationFrame(tickSnap);
    }

    function startSnap() {
      if (touching) return;
      var from   = list.scrollTop;
      var target = nearestSnapTop(from);
      if (Math.abs(target - from) < 0.5) return;
      var travel = Math.abs(target - from);
      /* Longer travel = slightly longer ease, capped — keeps short
         settles snappy without making big jumps feel rushed. */
      var dur = Math.min(SNAP_DUR_BASE + travel * 0.6, SNAP_DUR_MAX);
      cancelSnap();
      snapAnim = {
        startTop:  from,
        target:    target,
        startTime: performance.now(),
        dur:       dur
      };
      snapRaf = requestAnimationFrame(tickSnap);
    }

    function scheduleSnap() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        /* Only snap if scroll has actually been quiet for the full window
           and the finger is up — guards against snapping mid-momentum. */
        if (touching) return;
        if (performance.now() - lastScrollEventAt < SNAP_IDLE_MS - 10) return;
        startSnap();
      }, SNAP_IDLE_MS);
    }

    /* ── Wire events ── */
    list.addEventListener('scroll', function () {
      lastScrollEventAt = performance.now();
      updateFocus();
      /* Our own tickSnap writes scrollTop, which fires this same event.
         If a snap is in flight, treating it as user motion would cancel
         the animation by its own movement. The user-grab case is handled
         in touchstart (sets touching + cancelSnap). */
      if (snapAnim || touching) return;
      scheduleSnap();
    }, { passive: true });

    list.addEventListener('touchstart', function () {
      touching = true;
      cancelSnap();
      clearTimeout(idleTimer);
    }, { passive: true });

    list.addEventListener('touchend', function () {
      touching = false;
      /* Give momentum a beat to start before we start watching for idle. */
      scheduleSnap();
    }, { passive: true });

    list.addEventListener('touchcancel', function () {
      touching = false;
      scheduleSnap();
    }, { passive: true });

    /* Re-measure on resize / orientation change. */
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        measure();
        updateFocus();
      }, 120);
    }, { passive: true });

    /* Initial paint — set --focus on every card so the first card
       reads as focused without waiting for a scroll event. */
    updateFocus();
  }

  /* ----------------------------------------------------------
     Bootstrap — works whether DOM is ready or not yet
     ---------------------------------------------------------- */
  function boot() {
    initNavToggle();
    initScrollThumb();
    initButtonGlitch();
    initAboutText();
    initProjectLinks();
    initProjectImageReveal();
    initMobileProjects();
    syncMenuCurrent();
  }

  /* ----------------------------------------------------------
     Menu active-page highlight — reflect current Barba namespace
     in the menu by toggling .is-current on the matching link.
     Called on boot and after every Barba transition.
     ---------------------------------------------------------- */
  function syncMenuCurrent() {
    /* Resolve the active menu slot from two signals (whichever wins):
       1. Barba namespace on the active container (set per-page in HTML).
       2. URL pathname — covers cold loads and pages that don't initialise
          Barba (e.g. about.html as a standalone destination).
       Project / projects-index routes intentionally don't claim a slot. */
    var container = document.querySelector('[data-barba="container"]');
    var ns = container && container.getAttribute('data-barba-namespace');
    var path = (window.location.pathname || '').toLowerCase();

    var menuNs = null;
    if (ns === 'home' || ns === 'about') {
      menuNs = ns;
    } else if (ns === 'project' || ns === 'projects-index') {
      menuNs = null;
    } else if (/^\/about(\b|\/|\.html)/.test(path)) {
      menuNs = 'about';
    } else if (path === '/' || /\/index\.html$/.test(path)) {
      menuNs = 'home';
    }

    var items = document.querySelectorAll('.menu-nav-item[data-nav]');
    items.forEach(function (item) {
      var matches = item.getAttribute('data-nav') === menuNs;
      item.classList.toggle('is-current', matches);
      var link = item.querySelector('.menu-nav-link[data-nav]');
      if (link) link.classList.toggle('is-current', matches);
    });
  }

  /* Expose for Barba re-init after content swap */
  window.colabSyncMenuCurrent = syncMenuCurrent;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    /* DOM already ready (defer script ran after parse) */
    boot();
  }

  /* Expose for Barba re-init after content swap */
  window.colabMainBoot = boot;

}());
