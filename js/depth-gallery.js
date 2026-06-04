(function (global) {
  'use strict';

  /* ============================================================
     PLANE CONFIG — positions mirror galleryPlaneData (x offsets)
     ============================================================ */
  var PLANE_X_OFFSETS = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

  /* ============================================================
     DEPTH GALLERY CLASS
     ============================================================ */
  function DepthGallery() {
    this.running   = false;
    this.rafId     = null;
    this.canvas    = null;
    this.wrap      = null;
    this.images    = [];

    /* Three.js objects */
    this.renderer  = null;
    this.scene     = null;
    this.camera    = null;
    this.planes    = [];

    /* Scroll state — from Scroll.js */
    this.scrollTarget  = 0;
    this.scrollCurrent = 0;
    this.scrollSmoothing      = 0.055;
    this.scrollToWorldFactor  = 0.01;
    this.prevScrollCurrent    = 0;
    this.rawVelocity   = 0;
    this.velocity      = 0;
    this.velocityDamping     = 0.12;
    this.velocityMax         = 1.2;
    this.cameraStartZ  = -1;
    this.minCameraZ    = -Infinity;
    this.maxCameraZ    =  Infinity;

    /* Plane config — from Gallery.js */
    this.planeGap       = 6;
    this.planeFadeSmoothing = 0.14;

    /* Parallax — from Gallery.js */
    this.pointerTarget  = { x: 0, y: 0 };
    this.pointerCurrent = { x: 0, y: 0 };
    this.parallaxX      = 0.16;
    this.parallaxY      = 0.08;
    this.parallaxSmoothing = 0.08;

    /* Breath — from Gallery.js */
    this.breathIntensity       = 0;
    this.targetBreathIntensity = 0;
    this.breathTiltAmount      = 0.045;
    this.breathScaleAmount     = 0.03;
    this.breathSmoothing       = 0.14;
    this.breathGain            = 1.1;

    /* Gesture drift */
    this.driftCurrent = 0;
    this.driftTarget  = 0;
    this.driftSmoothing = 0.05;
    this.driftAmount    = 0.05;

    /* Touch */
    this.touchY = 0;

    /* Hold-to-auto-scroll */
    this._holdTimer      = null;
    this._autoScrolling  = false;
    this._autoScrollSpeed = 6.0;    /* px-equivalent per frame */
    this._holdDelay      = 120;     /* ms before auto-scroll kicks in */
    this._touchStartX    = 0;
    this._touchStartY    = 0;
    this._touchMoved     = false;

    /* Idle auto-scroll — always running, direction syncs with user.
       Desktop moves 30% slower than mobile so the gallery reads more
       deliberately at larger viewports. 0.8 × 0.7 = 0.56. */
    var _isMobile = window.matchMedia && window.matchMedia('(max-width: 767px)').matches;
    this._idleSpeed       = _isMobile ? 0.9 : 0.56; /* px per frame — positive = forward */
    this._idlePaused      = false;  /* external pause (e.g. overview modal open) */

    /* End-of-gallery overscroll detection — two-stage flow.
       onEndLabelReveal fires at _overscrollThreshold (cue appears),
       onReachEnd defers until _overscrollCommitThreshold AFTER a
       minimum hold (_minRevealHold) has elapsed since the reveal.
       Per-tick contribution is capped so a single huge scroll event
       can't blow through both thresholds in one frame. */
    this.onReachEnd       = null;
    this.onReachStart     = null;
    this.onEndLabelReveal = null;   /* first-stage cue */
    this.onEndLabelHide   = null;   /* fires when user retreats before commit */
    this._endFired        = false;
    this._startFired      = false;
    this._labelRevealed   = false;
    this._labelRevealedAt = 0;
    this._overscrollAccum = 0;
    this._underscrollAccum = 0;
    this._overscrollThreshold       = 80;   /* px — first stage / single-stage trigger */
    this._overscrollCommitThreshold = null; /* px — when set, transition defers to this higher value */
    this._overscrollPerTickCap      = 30;   /* px — max accumulator growth per tick (kills fast-scroll blowthrough) */
    this._minRevealHold             = 700;  /* ms — cue must remain visible at least this long before commit can fire */
    this._maxScrollPos              = null; /* cached in _updateScroll for use in idle auto-scroll guard */

    /* Bound handlers */
    this._onWheel       = this._onWheel.bind(this);
    this._onTouchStart  = this._onTouchStart.bind(this);
    this._onTouchMove   = this._onTouchMove.bind(this);
    this._onTouchEnd    = this._onTouchEnd.bind(this);
    this._onPointerMove = this._onPointerMove.bind(this);
    this._onPointerLeave= this._onPointerLeave.bind(this);
    this._onResize      = this._onResize.bind(this);
    this._tick          = this._tick.bind(this);
  }

  /* ----------------------------------------------------------
     INIT
     ---------------------------------------------------------- */
  DepthGallery.prototype.init = function (canvas, wrap, images) {
    this.canvas = canvas;
    this.wrap   = wrap;
    this.images = images || [];

    var W = wrap ? wrap.offsetWidth  : window.innerWidth;
    var H = wrap ? wrap.offsetHeight : window.innerHeight;

    /* Renderer — transparent so site background shows through */
    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H);
    this.renderer.autoClear = false;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(0x000000, 0);  /* fully transparent */

    /* Override Three.js inline pixel dimensions — let CSS handle sizing
       so the canvas scales correctly with CSS zoom */
    canvas.style.width  = '100%';
    canvas.style.height = '100%';

    /* Main scene + perspective camera — FOV 45, near 0.1, far 100 (Engine.js) */
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, W / H, 0.1, 100);
    this.camera.position.set(0, 0, 6);

    /* No background scene — site BG shows through transparent canvas */

    this._loadAndBuildPlanes(images, true);
    this._bindEvents();
  };

  /* ----------------------------------------------------------
     REVEAL SHADER — noise dissolve per plane
     ---------------------------------------------------------- */
  var _revealVert = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var _revealFrag = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform float uProgress;',
    'uniform float uTime;',
    '',
    'float hash(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    '',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
    '             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    '',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) {',
    '    v += a * noise(p);',
    '    p *= 2.0;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    'void main() {',
    '  vec4 tex = texture2D(uTexture, vUv);',
    '  float n = fbm(vUv * 5.0 + uTime * 0.03);',
    '  float threshold = uProgress * 1.35 - 0.15;',
    '  float edgeW = 0.08 + 0.04 * (1.0 - uProgress);',
    '  float mask = 1.0 - smoothstep(threshold - edgeW, threshold + edgeW, n);',
    '  float edge = smoothstep(threshold - edgeW * 0.3, threshold, n)',
    '             * smoothstep(threshold + edgeW * 0.6, threshold, n);',
    '  vec3 col = mix(tex.rgb, vec3(0.0), edge);',
    '  mask *= smoothstep(0.0, 0.05, uProgress);',
    '  mask = mix(mask, 1.0, smoothstep(0.9, 1.0, uProgress));',
    '  gl_FragColor = vec4(col, tex.a * mask);',
    '}'
  ].join('\n');

  /* ----------------------------------------------------------
     LOAD IMAGES + BUILD PLANES
     ---------------------------------------------------------- */
  var VIDEO_EXTS = /\.(mp4|webm|mov|m4v)(\?|$)/i;

  function isVideoSrc(src) { return VIDEO_EXTS.test(src); }

  function loadVideoTexture(src, onReady, onError) {
    var video = document.createElement('video');
    video.src = src;
    video.crossOrigin = '';
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.addEventListener('loadeddata', function () {
      video.play();
      var tex = new THREE.VideoTexture(video);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.format = THREE.RGBAFormat;
      onReady(tex, video.videoWidth, video.videoHeight);
    }, { once: true });
    video.addEventListener('error', function () { onError(); }, { once: true });
    video.load();
    return video;
  }

  DepthGallery.prototype._loadAndBuildPlanes = function (images, firstLoad) {
    var self      = this;
    var loader    = new THREE.TextureLoader();
    loader.crossOrigin = '';
    var total     = images.length;
    var loaded    = 0;
    var textures  = new Array(total).fill(null);
    var dimensions = new Array(total);

    if (!total) return;

    /* Clear existing planes + video elements */
    this.planes.forEach(function (p) {
      self.scene.remove(p);
      p.geometry.dispose();
      if (p.material.uniforms && p.material.uniforms.uTexture && p.material.uniforms.uTexture.value) {
        p.material.uniforms.uTexture.value.dispose();
      }
      if (p.userData._video) {
        p.userData._video.pause();
        p.userData._video.src = '';
        p.userData._video = null;
      }
      p.material.dispose();
    });
    this.planes = [];

    var planeGeo = new THREE.PlaneGeometry(2.25, 2.25);

    function onAllLoaded() {
      textures.forEach(function (tex, i) {
        var aspect = 1;
        if (dimensions[i]) {
          aspect = dimensions[i].w / dimensions[i].h;
        } else if (tex && tex.image && tex.image.width > 0) {
          aspect = tex.image.width / tex.image.height;
        }

        var mat = new THREE.ShaderMaterial({
          vertexShader:   _revealVert,
          fragmentShader: _revealFrag,
          uniforms: {
            uTexture:  { value: tex },
            uProgress: { value: i === 0 ? 1.0 : 0.0 },
            uTime:     { value: 0.0 }
          },
          transparent: true,
          depthWrite:  false,
          side:        THREE.DoubleSide
        });

        var mesh = new THREE.Mesh(planeGeo, mat);
        mesh.scale.set(aspect, 1, 1);
        mesh.userData.aspect    = aspect;
        mesh.userData.basePos   = { x: (PLANE_X_OFFSETS[i % PLANE_X_OFFSETS.length]) || 0, y: 0 };
        if (dimensions[i] && dimensions[i].video) {
          mesh.userData._video = dimensions[i].video;
        }
        self.scene.add(mesh);
        self.planes.push(mesh);
      });

      self._layoutPlanes();
      self._initScrollBounds(firstLoad);
    }

    images.forEach(function (src, i) {
      if (isVideoSrc(src)) {
        loadVideoTexture(src,
          function (tex, w, h) {
            textures[i] = tex;
            dimensions[i] = { w: w, h: h, video: tex.image };
            if (++loaded === total) onAllLoaded();
          },
          function () {
            textures[i] = null;
            if (++loaded === total) onAllLoaded();
          }
        );
      } else {
        loader.load(src,
          function (tex) {
            tex.colorSpace = THREE.SRGBColorSpace;
            textures[i] = tex;
            if (++loaded === total) onAllLoaded();
          },
          undefined,
          function () {
            textures[i] = null;
            if (++loaded === total) onAllLoaded();
          }
        );
      }
    });
  };

  /* Layout planes along Z — exact from Gallery.layoutPlanes */
  DepthGallery.prototype._layoutPlanes = function () {
    var self = this;
    this.planes.forEach(function (p, i) {
      var base = p.userData.basePos;
      p.position.set(base.x, base.y, -i * self.planeGap);
    });
  };

  /* Init scroll bounds from Scroll.js */
  DepthGallery.prototype._initScrollBounds = function (resetCamera) {
    if (!this.planes.length) return;

    var zPositions  = this.planes.map(function (p) { return p.position.z; });
    var nearestZ    = Math.max.apply(null, zPositions);
    var deepestZ    = Math.min.apply(null, zPositions);

    this.maxCameraZ = nearestZ + 5;
    this.minCameraZ = deepestZ + 5;
    if (this.minCameraZ > this.maxCameraZ) this.minCameraZ = this.maxCameraZ;

    this.cameraStartZ = this.maxCameraZ;

    if (resetCamera) {
      this.scrollTarget  = 0;
      this.scrollCurrent = 0;
      this.prevScrollCurrent = 0;
      this.camera.position.z = this.cameraStartZ;
      this._endFired       = false;
      this._startFired     = false;
      this._labelRevealed  = false;
      this._labelRevealedAt = 0;
      this._overscrollAccum = 0;
      this._underscrollAccum = 0;
    }
  };

  /* ----------------------------------------------------------
     SCROLL + VELOCITY UPDATE — from Scroll.update()
     ---------------------------------------------------------- */
  DepthGallery.prototype._updateScroll = function () {
    /* Clamp scroll target to bounds */
    var minScroll = (this.cameraStartZ - this.maxCameraZ) / this.scrollToWorldFactor;
    var maxScroll = (this.cameraStartZ - this.minCameraZ) / this.scrollToWorldFactor;

    /* Cache scroll bounds so _tick's idle auto-scroll can stop short
       of the end (otherwise idle would silently auto-advance projects). */
    this._maxScrollPos = maxScroll;
    this._minScrollPos = minScroll;

    /* ── End-of-gallery overscroll detection ──
       Three-phase flow that prevents fast scrolls from skipping the
       "scroll to next" cue:
         1) Pre-reveal: per-tick-capped contributions accumulate toward
            _overscrollThreshold. When reached, the cue reveals and the
            accumulator resets.
         2) Hold: for _minRevealHold ms after reveal, any incoming
            overscroll is swallowed (accum clamped to 0) so the cue
            stays visible regardless of scroll velocity.
         3) Commit: after the hold elapses, fresh per-tick-capped
            contributions accumulate toward _overscrollCommitThreshold
            and onReachEnd fires only when crossed. */
    if (this.scrollTarget > maxScroll && !this._endFired) {
      var contribution = Math.min(
        this.scrollTarget - maxScroll,
        this._overscrollPerTickCap
      );

      if (!this._labelRevealed) {
        this._overscrollAccum += contribution;
        if (this._overscrollAccum >= this._overscrollThreshold) {
          this._labelRevealed   = true;
          this._labelRevealedAt = performance.now();
          this._overscrollAccum = 0;
          if (typeof this.onEndLabelReveal === 'function') {
            this.onEndLabelReveal();
          }
        }
      } else {
        var sinceReveal = performance.now() - this._labelRevealedAt;
        if (sinceReveal < this._minRevealHold) {
          this._overscrollAccum = 0;
        } else {
          this._overscrollAccum += contribution;
          var commit = (this._overscrollCommitThreshold != null)
            ? this._overscrollCommitThreshold
            : this._overscrollThreshold;
          if (this._overscrollAccum >= commit) {
            this._endFired = true;
            if (typeof this.onReachEnd === 'function') {
              this.onReachEnd();
            }
          }
        }
      }
    } else if (this.scrollTarget < maxScroll) {
      /* Strict less-than so the accumulator survives ticks where the
         scrollTarget has been clamped to exactly maxScroll between
         user input events — otherwise accum would clear in those
         "rest" frames and never build up across a fast scroll burst. */
      this._overscrollAccum = 0;
      if (this._labelRevealed) {
        this._labelRevealed = false;
        if (typeof this.onEndLabelHide === 'function') {
          this.onEndLabelHide();
        }
      }
    }

    /* ── Start-of-gallery underscroll detection ── */
    if (this.scrollTarget < minScroll && !this._startFired) {
      /* User is trying to scroll before the first image */
      this._underscrollAccum += (minScroll - this.scrollTarget);
      if (this._underscrollAccum >= this._overscrollThreshold) {
        this._startFired = true;
        if (typeof this.onReachStart === 'function') {
          this.onReachStart();
        }
      }
    } else if (this.scrollTarget >= minScroll) {
      this._underscrollAccum = 0;
    }

    this.scrollTarget  = Math.max(minScroll, Math.min(maxScroll, this.scrollTarget));

    /* Lerp scroll */
    this.scrollCurrent += (this.scrollTarget - this.scrollCurrent) * this.scrollSmoothing;
    this.scrollCurrent  = Math.max(minScroll, Math.min(maxScroll, this.scrollCurrent));

    /* Velocity */
    this.rawVelocity = this.scrollCurrent - this.prevScrollCurrent;
    this.velocity += (this.rawVelocity - this.velocity) * this.velocityDamping;
    this.velocity  = Math.max(-this.velocityMax, Math.min(this.velocityMax, this.velocity));
    if (Math.abs(this.velocity) < 0.0001) this.velocity = 0;
    this.prevScrollCurrent = this.scrollCurrent;

    /* Move camera */
    var nextZ = this.cameraStartZ - this.scrollCurrent * this.scrollToWorldFactor;
    this.camera.position.z = Math.max(this.minCameraZ, Math.min(this.maxCameraZ, nextZ));
  };

  /* ----------------------------------------------------------
     PLANE VISIBILITY — from Gallery.updatePlaneVisibility
     ---------------------------------------------------------- */
  DepthGallery.prototype._updatePlaneVisibility = function () {
    var camZ        = this.camera.position.z;
    var gap         = Math.max(this.planeGap, 0.0001);
    var firstZ      = this.planes.length ? this.planes[0].position.z : 0;
    var lastIdx     = this.planes.length - 1;
    var offset      = 1;
    var sampledZ    = camZ - gap * offset;
    var normDepth   = Math.max(0, Math.min(lastIdx, (firstZ - sampledZ) / gap));
    var curIdx      = Math.floor(normDepth);
    var nxtIdx      = Math.min(curIdx + 1, lastIdx);
    var blend       = normDepth - curIdx;

    this.planes.forEach(function (p, i) {
      var target = 0;
      if (i === curIdx) target = 1 - blend;
      if (i === nxtIdx) target = Math.max(target, blend);
      var u = p.material.uniforms.uProgress;
      var cur = isFinite(u.value) ? u.value : 0;
      u.value += (target - cur) * 0.14;
    });

    return { curIdx: curIdx, nxtIdx: nxtIdx, blend: blend };
  };

  /* ----------------------------------------------------------
     PLANE MOTION — from Gallery.updatePlaneMotion
     ---------------------------------------------------------- */
  DepthGallery.prototype._updatePlaneMotion = function () {
    /* Smooth pointer */
    this.pointerCurrent.x += (this.pointerTarget.x - this.pointerCurrent.x) * this.parallaxSmoothing;
    this.pointerCurrent.y += (this.pointerTarget.y - this.pointerCurrent.y) * this.parallaxSmoothing;

    /* Breath intensity from velocity */
    var velNorm = Math.max(0, Math.min(1, Math.abs(this.velocity) / Math.max(this.velocityMax, 0.0001)));
    this.targetBreathIntensity = Math.max(0, Math.min(1, velNorm * this.breathGain));
    this.breathIntensity += (this.targetBreathIntensity - this.breathIntensity) * this.breathSmoothing;

    /* Gesture drift from velocity direction */
    var scrollDrift = Math.max(-1, Math.min(1, this.velocity / Math.max(this.velocityMax, 0.0001)));
    this.driftTarget  = scrollDrift;
    this.driftCurrent += (this.driftTarget - this.driftCurrent) * this.driftSmoothing;

    var self = this;
    this.planes.forEach(function (p, i) {
      var base       = p.userData.basePos;
      var aspect     = p.userData.aspect || 1;
      var progress   = p.material.uniforms.uProgress.value;
      progress       = isFinite(progress) ? progress : 0;
      var depthInfl  = 1 + i * 0.05;
      var parallaxInfl = progress * depthInfl;

      /* Position */
      p.position.x = base.x + self.pointerCurrent.x * self.parallaxX * parallaxInfl;
      p.position.y = base.y + self.pointerCurrent.y * self.parallaxY * parallaxInfl
                             + self.driftCurrent * self.driftAmount;
      p.position.z = -i * self.planeGap;

      /* Rotation (breath tilt) */
      var breathInfl = self.breathIntensity * progress;
      p.rotation.x  = -self.pointerCurrent.y * self.breathTiltAmount * breathInfl;
      p.rotation.y  =  self.pointerCurrent.x * self.breathTiltAmount * breathInfl;
      p.rotation.z  = 0;

      /* Scale (breath pulse) */
      var scalePulse = 1 + self.breathScaleAmount * breathInfl;
      p.scale.set(aspect * scalePulse, scalePulse, 1);
    });
  };

  /* ----------------------------------------------------------
     RENDER LOOP
     ---------------------------------------------------------- */
  DepthGallery.prototype._tick = function () {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    var time = performance.now();
    var elapsed = time * 0.001;  /* seconds */

    /* Hold-to-auto-scroll: advance while holding */
    if (this._autoScrolling) {
      this.scrollTarget += this._autoScrollSpeed;
    }
    /* Idle auto-scroll: always running, but stops at the last image so
       it can never silently advance to the next project. The user must
       explicitly scroll past the end to overscroll into the cue. */
    else if (!this._idlePaused &&
             (this._maxScrollPos == null ||
              this.scrollTarget < this._maxScrollPos)) {
      this.scrollTarget += this._idleSpeed;
    }

    this._updateScroll();
    var visData = this._updatePlaneVisibility();
    this._updatePlaneMotion();

    /* Push time to each plane's shader */
    this.planes.forEach(function (p) {
      if (p.material.uniforms && p.material.uniforms.uTime) {
        p.material.uniforms.uTime.value = elapsed;
      }
    });

    /* Render — transparent clear, then scene */
    this.renderer.clear(true, true, true);
    this.renderer.render(this.scene, this.camera);
  };

  /* ----------------------------------------------------------
     START / STOP / DESTROY
     ---------------------------------------------------------- */
  DepthGallery.prototype.start = function () {
    if (this.running) return;
    this.running = true;
    this._tick();
  };

  DepthGallery.prototype.stop = function () {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
  };

  /* Pause the idle auto-scroll without halting the render loop, so the
     gallery stays alive (drift, hover, etc.) but stops advancing on its
     own. Used when the mobile overview modal is open. */
  DepthGallery.prototype.pauseIdle = function () {
    this._idlePaused = true;
  };

  DepthGallery.prototype.resumeIdle = function () {
    this._idlePaused = false;
  };

  DepthGallery.prototype.destroy = function () {
    this.stop();
    this._unbindEvents();
    clearTimeout(this._holdTimer);
    this._autoScrolling = false;

    this.planes.forEach(function (p) {
      p.geometry.dispose();
      if (p.material.uniforms && p.material.uniforms.uTexture && p.material.uniforms.uTexture.value) {
        p.material.uniforms.uTexture.value.dispose();
      }
      if (p.userData._video) {
        p.userData._video.pause();
        p.userData._video.src = '';
        p.userData._video = null;
      }
      p.material.dispose();
    });
    this.planes = [];

    if (this.renderer){ this.renderer.dispose(); }

    this.scene     = null;
    this.camera    = null;
    this.renderer  = null;
  };

  /* ----------------------------------------------------------
     LOAD NEW IMAGE SET (project switch)
     ---------------------------------------------------------- */
  DepthGallery.prototype.loadImages = function (images) {
    this.images = images;
    this._loadAndBuildPlanes(images, true);
  };

  /** Jump camera to the last image (for backward project transitions) */
  DepthGallery.prototype.scrollToEnd = function () {
    var maxScroll = (this.cameraStartZ - this.minCameraZ) / this.scrollToWorldFactor;
    this.scrollTarget  = maxScroll;
    this.scrollCurrent = maxScroll;
    this.prevScrollCurrent = maxScroll;
    this.camera.position.z = this.minCameraZ;
  };

  /* ----------------------------------------------------------
     RESIZE
     ---------------------------------------------------------- */
  DepthGallery.prototype._onResize = function () {
    if (!this.wrap || !this.renderer) return;
    var W = this.wrap.offsetWidth;
    var H = this.wrap.offsetHeight;
    this.renderer.setSize(W, H);
    /* Restore CSS sizing after Three.js overrides with pixel values */
    this.canvas.style.width  = '100%';
    this.canvas.style.height = '100%';
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    this._layoutPlanes();
  };

  /* ----------------------------------------------------------
     INPUT EVENTS
     ---------------------------------------------------------- */
  DepthGallery.prototype._bindEvents = function () {
    /* On mobile, bind scroll/touch to document so the gallery
       responds to input anywhere on screen — not just the canvas */
    var isMobile = window.matchMedia('(max-width: 767px)').matches;
    var scrollTarget = isMobile ? document : this.canvas;

    scrollTarget.addEventListener('wheel',       this._onWheel,       { passive: false });
    scrollTarget.addEventListener('touchstart',  this._onTouchStart,  { passive: true  });
    scrollTarget.addEventListener('touchmove',   this._onTouchMove,   { passive: false });
    scrollTarget.addEventListener('touchend',    this._onTouchEnd,    { passive: true  });
    scrollTarget.addEventListener('touchcancel', this._onTouchEnd,    { passive: true  });
    this._scrollTarget = scrollTarget;  /* store ref for unbind */
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerleave',this._onPointerLeave,{ passive: true });
    window.addEventListener('resize',      this._onResize);
  };

  DepthGallery.prototype._unbindEvents = function () {
    var t = this._scrollTarget || this.canvas;
    if (t) {
      t.removeEventListener('wheel',      this._onWheel);
      t.removeEventListener('touchstart', this._onTouchStart);
      t.removeEventListener('touchmove',  this._onTouchMove);
      t.removeEventListener('touchend',   this._onTouchEnd);
      t.removeEventListener('touchcancel',this._onTouchEnd);
    }
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerleave',this._onPointerLeave);
    window.removeEventListener('resize',      this._onResize);
  };

  DepthGallery.prototype._onWheel = function (e) {
    /* While the overview modal is open, let it scroll natively. */
    if (document.body.classList.contains('has-overview-modal-open')) return;
    e.preventDefault();
    var delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 16;
    if (e.deltaMode === 2) delta *= window.innerHeight;
    this.scrollTarget += delta;

    /* Sync idle direction with user scroll */
    if (delta > 0) this._idleSpeed = Math.abs(this._idleSpeed);
    else if (delta < 0) this._idleSpeed = -Math.abs(this._idleSpeed);
  };

  DepthGallery.prototype._onTouchStart = function (e) {
    if (document.body.classList.contains('has-overview-modal-open')) return;
    var touch = e.touches[0];
    if (!touch) return;

    this.touchY       = touch.clientY;
    this._touchStartX = touch.clientX;
    this._touchStartY = touch.clientY;
    this._touchMoved  = false;

    /* Stop any existing hold-auto-scroll */
    this._autoScrolling = false;
    clearTimeout(this._holdTimer);

    /* Start hold timer — if finger doesn't move significantly,
       begin auto-scrolling through images */
    var self = this;
    this._holdTimer = setTimeout(function () {
      if (!self._touchMoved) {
        self._autoScrolling = true;
      }
    }, this._holdDelay);
  };

  DepthGallery.prototype._onTouchMove = function (e) {
    /* While the overview modal is open, let it scroll natively. */
    if (document.body.classList.contains('has-overview-modal-open')) return;
    e.preventDefault();
    var touch = e.touches[0];
    if (!touch) return;

    /* Check if finger has moved enough to count as a swipe (>10px) */
    var dx = Math.abs(touch.clientX - this._touchStartX);
    var dy = Math.abs(touch.clientY - this._touchStartY);
    if (dx > 10 || dy > 10) {
      this._touchMoved = true;
      /* Cancel hold timer — this is a swipe, not a hold */
      clearTimeout(this._holdTimer);
      /* Stop auto-scroll if it already started */
      this._autoScrolling = false;
    }

    /* Normal swipe-to-scroll (always active during move) */
    var currentY = touch.clientY;
    var delta    = this.touchY - currentY;
    this.scrollTarget += delta * 1.8;
    this.touchY = currentY;

    /* Sync idle direction with swipe */
    if (delta > 0) this._idleSpeed = Math.abs(this._idleSpeed);
    else if (delta < 0) this._idleSpeed = -Math.abs(this._idleSpeed);
  };

  DepthGallery.prototype._onTouchEnd = function () {
    /* Stop auto-scroll */
    this._autoScrolling = false;
    clearTimeout(this._holdTimer);
    this._touchMoved = false;
  };

  DepthGallery.prototype._onPointerMove = function (e) {
    this.pointerTarget.x =  (e.clientX / window.innerWidth)  * 2 - 1;
    this.pointerTarget.y = -(e.clientY / window.innerHeight)  * 2 + 1;
  };

  DepthGallery.prototype._onPointerLeave = function () {
    this.pointerTarget.x = 0;
    this.pointerTarget.y = 0;
  };

  /* ----------------------------------------------------------
     EXPORT
     ---------------------------------------------------------- */
  global.DepthGallery = DepthGallery;

}(window));
