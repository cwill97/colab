
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
      /* Restore the page's track, then surface — stay submerged on project and about pages */
      if (window.colabAudio) {
        if (window.colabAudio.setTrack) window.colabAudio.setTrack(pageTrack());
        if (document.body.classList.contains('project-page') ||
            document.body.classList.contains('about-page')) {
          window.colabAudio.submerge();
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
     Project image — WebGL noise dissolve
     On hover the preview locks in from animated TV static (like a
     signal finding its picture); on leave it decays back to static
     and the idle video re-emerges. Falls back to a plain crossfade
     where WebGL is unavailable.
     ---------------------------------------------------------- */
  function initProjectImageReveal() {
    var wrap  = document.querySelector('[data-project-image-wrap]');
    var items = document.querySelectorAll('[data-preview-image]');
    if (!wrap || !items.length) return;
    if (wrap.hasAttribute('data-dissolve-init')) return;
    wrap.setAttribute('data-dissolve-init', 'true');

    /* The legacy current/incoming imgs are replaced by the canvas.
       The default-video img (z-index 0) stays as the idle backdrop. */
    var legacyA = wrap.querySelector('[data-image-current]');
    var legacyB = wrap.querySelector('[data-image-incoming]');
    if (legacyA) legacyA.style.display = 'none';
    if (legacyB) legacyB.style.display = 'none';

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;' +
      'z-index:5;opacity:0;pointer-events:none;transition:opacity 0.2s ease;';
    wrap.appendChild(canvas);

    var gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) ||
           canvas.getContext('experimental-webgl');
    } catch (e) { gl = null; }

    if (!gl) { initImageFallback(wrap, items); return; }

    var VERT =
      'attribute vec2 aPos; varying vec2 vUv;' +
      'void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }';

    var FRAG = [
      'precision highp float;',
      'varying vec2 vUv;',
      'uniform sampler2D uImage;',
      'uniform vec2  uCanvas;',
      'uniform vec2  uImageSize;',
      'uniform float uProgress;',
      'uniform float uTime;',
      'float hash(vec2 p){',
      '  vec3 p3 = fract(vec3(p.xyx)*0.1031);',
      '  p3 += dot(p3, p3.yzx+33.33);',
      '  return fract((p3.x+p3.y)*p3.z);',
      '}',
      'float noise(vec2 p){',
      '  vec2 i = floor(p); vec2 f = fract(p);',
      '  f = f*f*(3.0-2.0*f);',
      '  return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),',
      '             mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);',
      '}',
      'float fbm(vec2 p){',
      '  float v=0.0,a=0.5;',
      '  for(int i=0;i<4;i++){ v+=a*noise(p); p*=2.0; a*=0.5; }',
      '  return v;',
      '}',
      'void main(){',
      '  float ca = uCanvas.x / max(uCanvas.y, 1.0);',
      '  float ia = uImageSize.x / max(uImageSize.y, 1.0);',
      '  vec2 uv = vec2(vUv.x, 1.0 - vUv.y);',
      '  if (ca > ia){ float s = ia/ca; uv.y = (uv.y-0.5)*s+0.5; }',
      '  else        { float s = ca/ia; uv.x = (uv.x-0.5)*s+0.5; }',
      '  vec4 tex = texture2D(uImage, uv);',
      '  float n = fbm(vUv*5.0 + uTime*0.03);',
      '  float threshold = uProgress*1.35 - 0.15;',
      '  float edgeW = 0.08 + 0.04*(1.0-uProgress);',
      '  float mask = 1.0 - smoothstep(threshold-edgeW, threshold+edgeW, n);',
      '  float edge = smoothstep(threshold-edgeW*0.3, threshold, n)',
      '             * smoothstep(threshold+edgeW*0.6, threshold, n);',
      '  vec3 col = mix(tex.rgb, vec3(0.0), edge);',
      '  mask *= smoothstep(0.0, 0.05, uProgress);',
      '  mask  = mix(mask, 1.0, smoothstep(0.9, 1.0, uProgress));',
      '  gl_FragColor = vec4(col, mask);',
      '}'
    ].join('\n');

    function compile(type, src) {
      var sh = gl.createShader(type);
      gl.shaderSource(sh, src); gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.warn('[dissolve] shader:', gl.getShaderInfoLog(sh));
        return null;
      }
      return sh;
    }

    var vs = compile(gl.VERTEX_SHADER, VERT);
    var fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { initImageFallback(wrap, items); return; }

    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[dissolve] link:', gl.getProgramInfoLog(prog));
      initImageFallback(wrap, items); return;
    }
    gl.useProgram(prog);

    var quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uImage    = gl.getUniformLocation(prog, 'uImage');
    var uCanvas   = gl.getUniformLocation(prog, 'uCanvas');
    var uImgSize  = gl.getUniformLocation(prog, 'uImageSize');
    var uProgress = gl.getUniformLocation(prog, 'uProgress');
    var uTime     = gl.getUniformLocation(prog, 'uTime');
    gl.uniform1i(uImage, 0);
    gl.activeTexture(gl.TEXTURE0);

    /* 1×1 black placeholder so the sampler is always valid */
    var placeholder = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, placeholder);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0,0,0,255]));
    function texParams() {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    texParams();

    var curTex = placeholder, curW = 1, curH = 1;
    var texCache = {};

    function sizeCanvas() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var r = wrap.getBoundingClientRect();
      var w = Math.max(1, Math.round(r.width  * dpr));
      var h = Math.max(1, Math.round(r.height * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w; canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }

    function loadTexture(src, cb) {
      var e = texCache[src];
      if (e && e.ready) { cb(e); return; }
      if (e) { e.cbs.push(cb); return; }
      e = texCache[src] = { ready: false, tex: null, w: 1, h: 1, cbs: [cb] };
      var im = new Image();
      /* No crossOrigin: the /sanity/* images are served same-origin via the
         Vercel proxy (same as the plain <img> default-video). Forcing CORS
         mode makes the proxied load fail → the dissolve would sit on static
         forever. Same-origin textures upload to WebGL without tainting. */
      im.onload = function () {
        try {
          var tex = gl.createTexture();
          gl.bindTexture(gl.TEXTURE_2D, tex);
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
          texParams();
          e.tex = tex; e.w = im.naturalWidth || 1; e.h = im.naturalHeight || 1; e.ready = true;
        } catch (err) {
          console.warn('[dissolve] texImage2D failed:', err && err.message);
          recoverFromTextureFailure();
          return;
        }
        var cbs = e.cbs; e.cbs = [];
        for (var i = 0; i < cbs.length; i++) cbs[i](e);
      };
      im.onerror = function () {
        delete texCache[src];           /* allow a future retry */
        recoverFromTextureFailure();    /* don't sit on perpetual static */
      };
      im.src = src;
    }

    /* If a texture can't load/upload, burn back out — reveals the idle video. */
    function recoverFromTextureFailure() {
      target = 0;
      run();
    }

    /* ---- animation loop ---- */
    var DUR_IN  = 0.55; /* s, burn in  */
    var DUR_OUT = 0.35; /* s, burn out */
    var progress = 0;   /* 0 = transparent, 1 = fully revealed */
    var target   = 0;
    var running  = false;
    var lastT    = 0;
    var t0       = performance.now();

    function frame(now) {
      if (!running) return;
      var dt = Math.min((now - lastT) / 1000, 0.05);
      lastT = now;

      var dir = target > progress ? 1 : -1;
      var dur = dir > 0 ? DUR_IN : DUR_OUT;
      progress += dir * (dt / dur);
      if (progress > 1) progress = 1;
      if (progress < 0) progress = 0;

      sizeCanvas();
      gl.uniform2f(uCanvas, canvas.width, canvas.height);
      gl.uniform2f(uImgSize, curW, curH);
      gl.uniform1f(uProgress, progress);
      gl.uniform1f(uTime, (now - t0) / 1000);
      gl.bindTexture(gl.TEXTURE_2D, curTex);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (progress >= 1 && target >= 1) { running = false; return; } /* hold revealed */
      if (progress <= 0 && target <= 0) {                            /* back to idle  */
        canvas.style.opacity = '0';
        running = false; return;
      }
      requestAnimationFrame(frame);
    }

    function run() {
      if (running) return;
      running = true;
      lastT = performance.now();
      requestAnimationFrame(frame);
    }

    var hovered = null;

    function onEnter(item) {
      var src = item.getAttribute('data-preview-image');
      if (!src) return;
      hovered = item;
      sizeCanvas();
      canvas.style.opacity = '1';
      progress = 0;
      target = 0;
      loadTexture(src, function (e) {
        if (hovered !== item) return;
        curTex = e.tex; curW = e.w; curH = e.h;
        target = 1;  /* begin burn-in once texture is ready */
        run();
      });
    }

    function onLeave(item) {
      if (hovered !== item) return;
      hovered = null;
      target = 0;  /* burn back out */
      run();
    }

    window.addEventListener('resize', sizeCanvas);

    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () { onEnter(item); });
      item.addEventListener('mouseleave', function () { onLeave(item); });
    });
  }

  /* Plain crossfade fallback for browsers without WebGL. */
  function initImageFallback(wrap, items) {
    var img = document.createElement('img');
    img.setAttribute('aria-hidden', 'true');
    img.alt = '';
    img.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;object-fit:cover;' +
      'object-position:center;z-index:5;opacity:0;pointer-events:none;' +
      'transition:opacity 0.4s ease;';
    wrap.appendChild(img);
    var hovered = null;
    items.forEach(function (item) {
      item.addEventListener('mouseenter', function () {
        var src = item.getAttribute('data-preview-image');
        if (!src) return;
        hovered = item; img.src = src; img.style.opacity = '1';
      });
      item.addEventListener('mouseleave', function () {
        if (hovered !== item) return;
        hovered = null; img.style.opacity = '0';
      });
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

  /* Block right-click and long-press save on images and videos */
  document.addEventListener('contextmenu', function (e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'VIDEO') {
      e.preventDefault();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    /* DOM already ready (defer script ran after parse) */
    boot();
  }

  /* Expose for Barba re-init after content swap */
  window.colabMainBoot = boot;

}());
