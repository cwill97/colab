
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

    var AMBIENT_TRACK = '/sanity/files/7to0u5h2/production/4769413ecca28b29e51841e6ea8d9010af78cf76.mp3';
    function pageTrack() { return AMBIENT_TRACK; }

    var label = toggle.querySelector('.nav-toggle-label');

    function showMenu() {
      /* Re-resolve the active page right before the menu paints, so the
         flashing square always lands on the correct row even if the
         page changed without main.js's boot re-running. */
      if (window.colabSyncMenuCurrent) window.colabSyncMenuCurrent();
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Close navigation menu');
      if (label) label.textContent = 'Close';
      menu.setAttribute('aria-hidden', 'false');
      document.body.setAttribute('data-menu-open', '');
      if (window.colabAudio) {
        if (window.colabAudio.setTrack) window.colabAudio.setTrack(AMBIENT_TRACK);
        window.colabAudio.submerge();
      }
    }

    function hideMenu() {
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open navigation menu');
      if (label) label.textContent = 'Menu';
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
      toggle.setAttribute('aria-label', 'Open navigation menu');
      if (label) label.textContent = 'Menu';
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
     Project image — vertical column strip burst
     Image is split into N narrow vertical strips. On hover they
     fire left→right with a small random Y offset, snapping into
     place. On leave they scatter back the same direction.
     ---------------------------------------------------------- */
  function initProjectImageReveal() {
    var wrap  = document.querySelector('[data-project-image-wrap]');
    var imgA  = document.querySelector('[data-image-current]');
    var imgB  = document.querySelector('[data-image-incoming]');
    var items = document.querySelectorAll('[data-preview-image]');

    if (!wrap || !imgA || !imgB || !items.length) return;
    if (wrap.hasAttribute('data-strips-init')) return;
    wrap.setAttribute('data-strips-init', 'true');

    var N        = 48;    /* strip count                            */
    var STAG_IN  = 9;     /* ms between strips firing in            */
    var DUR_IN   = 240;   /* ms per strip settle in                 */
    var STAG_OUT = 5;     /* ms between strips firing out           */
    var DUR_OUT  = 160;   /* ms per strip retract                   */
    var Y_RANGE  = 18;    /* ±px random Y jitter                    */

    /* Hide the original imgs — kept around for src preloading */
    imgA.style.display = 'none';
    imgB.style.display = 'none';

    function buildStrips() {
      var ctn = document.createElement('div');
      ctn.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
      var pct = 100 / N;
      for (var i = 0; i < N; i++) {
        var s = document.createElement('div');
        s.style.cssText =
          'position:absolute;top:0;bottom:auto;right:auto;height:100%;overflow:hidden;' +
          'left:' + (i * pct) + '%;width:' + pct + '%;' +
          'opacity:0;will-change:transform,opacity;';
        var img = document.createElement('img');
        img.alt = '';
        img.setAttribute('aria-hidden', 'true');
        img.style.cssText =
          'position:absolute;top:0;bottom:auto;right:auto;' +
          'height:100%;width:' + (N * 100) + '%;' +
          'left:' + (-i * 100) + '%;' +
          'object-fit:cover;object-position:center;display:block;';
        s.appendChild(img);
        ctn.appendChild(s);
      }
      return ctn;
    }

    var contA = buildStrips();
    var contB = buildStrips();
    contA.style.zIndex = '1';
    contB.style.zIndex = '2';
    wrap.appendChild(contA);
    wrap.appendChild(contB);

    function setSrc(container, src) {
      var kids = container.children;
      for (var i = 0; i < kids.length; i++) {
        var img = kids[i].firstChild;
        if (img.getAttribute('src') !== src) img.src = src;
      }
    }

    function instantHide(container) {
      var kids = container.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].style.transition = 'none';
        kids[i].style.opacity = '0';
        kids[i].style.transform = 'translateY(0)';
      }
    }

    function instantShow(container) {
      var kids = container.children;
      for (var i = 0; i < kids.length; i++) {
        kids[i].style.transition = 'none';
        kids[i].style.opacity = '1';
        kids[i].style.transform = 'translateY(0)';
      }
    }

    var hovered = null;
    var gen     = 0;

    function scanIn(container, myGen, onDone) {
      var kids = container.children;
      var n    = kids.length;
      /* Set scatter state with no transition */
      for (var i = 0; i < n; i++) {
        var dy = ((Math.random() * 2 - 1) * Y_RANGE).toFixed(2);
        kids[i].style.transition = 'none';
        kids[i].style.transform  = 'translateY(' + dy + 'px)';
        kids[i].style.opacity    = '0';
      }
      /* Force reflow */
      void container.offsetWidth;
      requestAnimationFrame(function () {
        if (gen !== myGen) return;
        for (var i = 0; i < n; i++) {
          var d = i * STAG_IN;
          kids[i].style.transition =
            'transform ' + DUR_IN + 'ms cubic-bezier(0.2,0.7,0.2,1) ' + d + 'ms,' +
            'opacity '   + DUR_IN + 'ms ease ' + d + 'ms';
          kids[i].style.transform = 'translateY(0)';
          kids[i].style.opacity   = '1';
        }
        if (onDone) {
          var totalMs = (n - 1) * STAG_IN + DUR_IN + 20;
          setTimeout(function () {
            if (gen === myGen) onDone();
          }, totalMs);
        }
      });
    }

    function scanOut(container, myGen) {
      var kids = container.children;
      var n    = kids.length;
      for (var i = 0; i < n; i++) {
        var dy = ((Math.random() * 2 - 1) * Y_RANGE).toFixed(2);
        var d  = i * STAG_OUT;
        kids[i].style.transition =
          'transform ' + DUR_OUT + 'ms ease-in ' + d + 'ms,' +
          'opacity '   + DUR_OUT + 'ms ease-in ' + d + 'ms';
        kids[i].style.transform = 'translateY(' + dy + 'px)';
        kids[i].style.opacity   = '0';
      }
      void container.offsetWidth;
    }

    function onEnter(item) {
      var src = item.getAttribute('data-preview-image');
      if (!src) return;
      hovered = item;
      gen++;
      var myGen = gen;

      /* Leave contA in place — it acts as the "last image" under
         the incoming burst, so we don't briefly flash the video. */
      setSrc(contB, src);
      scanIn(contB, myGen, function () {
        if (gen !== myGen) return;
        /* Promote B → A silently */
        setSrc(contA, src);
        instantShow(contA);
        instantHide(contB);
      });
    }

    function onLeave(item) {
      if (item !== hovered) return;
      hovered = null;
      gen++;
      var myGen = gen;
      /* Cancel any in-flight B scan */
      instantHide(contB);
      /* Retract A — if it was never promoted (opacity 0) the
         transitions are no-ops; otherwise it bursts back out. */
      scanOut(contA, myGen);
    }

    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () { onEnter(item); });
      item.addEventListener('mouseleave', function () { onLeave(item); });
    });
  }

  /* ----------------------------------------------------------
     Mobile project list — plain native scroll
     ----------------------------------------------------------
     Cards are a simple vertical, natively-scrolling list. No
     scroll-focus highlighting and no snap-to-top — JS here only
     injects each card's thumbnail and wraps its text content so
     the CSS flex-row layout has the two columns it expects.
     ---------------------------------------------------------- */
  function initMobileProjects() {
    if (window.innerWidth >= 768) return;

    var items = document.querySelectorAll('.project-item');
    var list  = document.querySelector('[data-scroll-list]');
    if (!items.length || !list) return;

    /* Guard against re-running on every Barba return. */
    if (list._colabMobileProjects) return;
    list._colabMobileProjects = true;

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
