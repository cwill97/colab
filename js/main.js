/**
 * co:lab — Navigation & UI Behaviour
 */

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

    function showMenu() {
      /* Re-resolve the active page right before the menu paints, so the
         flashing square always lands on the correct row even if the
         page changed without main.js's boot re-running. */
      if (window.colabSyncMenuCurrent) window.colabSyncMenuCurrent();
      toggle.setAttribute('aria-expanded', 'true');
      menu.setAttribute('aria-hidden', 'false');
      document.body.setAttribute('data-menu-open', '');
      /* Submerge audio — underwater muffle */
      if (window.colabAudio) window.colabAudio.submerge();
      /* Start liquid ripple overlay */
      if (window.colabMenuRipple) window.colabMenuRipple.start();
    }

    function hideMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      menu.setAttribute('aria-hidden', 'true');
      document.body.removeAttribute('data-menu-open');
      /* Surface audio — but stay submerged on project page */
      if (window.colabAudio) {
        if (document.body.classList.contains('project-page')) {
          window.colabAudio.submerge(0.6);
        } else {
          window.colabAudio.surface();
        }
      }
      /* Stop liquid ripple overlay */
      if (window.colabMenuRipple) window.colabMenuRipple.stop();
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
      if (window.colabMenuRipple) window.colabMenuRipple.stop();
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

    var resizePending = false;
    window.addEventListener('resize', function () {
      if (resizePending) return;
      resizePending = true;
      requestAnimationFrame(function () { applyText(); resizePending = false; });
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
     Mobile project list — thumbnails + scroll activation
     On mobile (<768px), injects preview thumbnails into each
     project item and activates whichever item is nearest the
     top of the scroll area (mirrors desktop hover behaviour).
     ---------------------------------------------------------- */
  function initMobileProjects() {
    if (window.innerWidth >= 768) return;

    var items = document.querySelectorAll('.project-item');
    var list  = document.querySelector('[data-scroll-list]');
    if (!items.length || !list) return;

    /* ── Inject thumbnails + wrap text content ── */
    items.forEach(function (item) {
      var src = item.getAttribute('data-preview-image');
      if (!src || item.querySelector('.project-thumb-mobile')) return;

      /* Create thumbnail */
      var img = document.createElement('img');
      img.className = 'project-thumb-mobile';
      img.src = src;
      img.alt = '';
      img.setAttribute('aria-hidden', 'true');

      /* Wrap existing children in a content div */
      var wrapper = document.createElement('div');
      wrapper.className = 'project-content-mobile';
      while (item.firstChild) {
        wrapper.appendChild(item.firstChild);
      }

      item.appendChild(img);
      item.appendChild(wrapper);
    });

    /* ── Scroll-based activation ── */
    var activeItem = null;

    function updateActive() {
      var listRect = list.getBoundingClientRect();
      var best     = null;

      /* With scroll-snap-align: start, the snapped item's top edge
         sits at (or within a few px of) the list container's top.
         Find the first visible item whose top is at or just below
         the list top — that's always the snapped one. */
      for (var i = 0; i < items.length; i++) {
        var rect = items[i].getBoundingClientRect();
        /* Skip items fully above the viewport */
        if (rect.bottom <= listRect.top) continue;
        /* Skip items fully below the viewport */
        if (rect.top > listRect.bottom) continue;
        /* First item that starts at or below the list top edge
           (allow a small tolerance for sub-pixel rounding) */
        if (rect.top >= listRect.top - 10) {
          best = items[i];
          break;
        }
        /* If the item straddles the top edge (partially scrolled up),
           it's still the snapped one if mostly visible */
        if (rect.bottom - listRect.top > rect.height * 0.4) {
          best = items[i];
          break;
        }
      }

      if (best && best !== activeItem) {
        if (activeItem) activeItem.classList.remove('is-scrolled-active');
        best.classList.add('is-scrolled-active');
        activeItem = best;

        /* Extract the project index from the link inside this item */
        var linkEl = best.querySelector('[data-project-link]');
        var projIdx = linkEl ? parseInt(linkEl.getAttribute('data-project-link'), 10) : -1;

        /* Fire event so globe + sound respond */
        document.dispatchEvent(new CustomEvent('colab:mobileProjectActivate', {
          detail: { index: projIdx }
        }));
      }
    }

    /* Initial activation */
    requestAnimationFrame(updateActive);

    /* Update on scroll — fires during momentum */
    var snapTimer = null;
    list.addEventListener('scroll', function () {
      updateExpanded();
      requestAnimationFrame(updateActive);

      /* Debounced fallback: re-check 120ms after scroll stops
         in case scroll-snap repositioned after the last scroll event */
      clearTimeout(snapTimer);
      snapTimer = setTimeout(updateActive, 200);
    }, { passive: true });

    /* scrollend fires after scroll-snap settles (modern browsers) */
    list.addEventListener('scrollend', function () {
      updateActive();
    }, { passive: true });
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
