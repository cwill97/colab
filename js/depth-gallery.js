/**
 * co:lab — Depth Gallery Mode
 * Ported from houmahani/codrops-depth-gallery (MIT)
 *
 * Images stacked along Z-axis. Scroll moves camera forward/backward.
 * Mouse parallax + breath/tilt driven by scroll velocity.
 * GLSL background with animated blob gradient + film grain.
 * Crossfades between adjacent planes based on camera Z.
 *
 * Exposed as window.DepthGallery with:
 *   .init(canvas, wrap, images)  — initialise & mount
 *   .start()                     — begin render loop
 *   .stop()                      — pause render loop
 *   .destroy()                   — full teardown
 *   .loadImages(images)          — swap image set
 */

(function (global) {
  'use strict';

  /* ============================================================
     PLANE CONFIG — positions mirror galleryPlaneData (x offsets)
     ============================================================ */
  var PLANE_X_OFFSETS = [-0.9, 0.8, -0.7, 1.0, -0.5, 0.6, -0.8, 0.9, -0.4, 0.7, -0.6, 0.5];

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
    this.scrollSmoothing      = 0.08;
    this.scrollToWorldFactor  = 0.01;
    this.prevScrollCurrent    = 0;
    this.rawVelocity   = 0;
    this.velocity      = 0;
    this.velocityDamping     = 0.12;
    this.velocityMax         = 1.5;
    this.cameraStartZ  = 0;
    this.minCameraZ    = -Infinity;
    this.maxCameraZ    =  Infinity;

    /* Plane config — from Gallery.js */
    this.planeGap       = 5;
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
    this._autoScrollSpeed = 4.0;    /* px-equivalent per frame */
    this._holdDelay      = 400;     /* ms before auto-scroll kicks in */
    this._touchStartX    = 0;
    this._touchStartY    = 0;
    this._touchMoved     = false;

    /* Idle auto-scroll — always running, direction syncs with user */
    this._idleSpeed       = 0.8;    /* px per frame — positive = forward */

    /* End-of-gallery overscroll detection */
    this.onReachEnd      = null;    /* callback fired once when scrolling past end */
    this._endFired       = false;   /* guard: only fire once per image set */
    this._overscrollAccum = 0;      /* accumulated overscroll past the end */
    this._overscrollThreshold = 80; /* px of extra scroll needed to trigger */

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
     LOAD IMAGES + BUILD PLANES
     ---------------------------------------------------------- */
  DepthGallery.prototype._loadAndBuildPlanes = function (images, firstLoad) {
    var self      = this;
    var loader    = new THREE.TextureLoader();
    var total     = images.length;
    var loaded    = 0;
    var textures  = new Array(total).fill(null);

    if (!total) return;

    /* Clear existing planes */
    this.planes.forEach(function (p) {
      self.scene.remove(p);
      p.geometry.dispose();
      p.material.dispose();
    });
    this.planes = [];

    var planeGeo = new THREE.PlaneGeometry(2.25, 2.25);

    function onAllLoaded() {
      textures.forEach(function (tex, i) {
        var aspect = 1;
        if (tex && tex.image && tex.image.width > 0) {
          aspect = tex.image.width / tex.image.height;
        }

        var mat = new THREE.MeshBasicMaterial({
          map:         tex,
          color:       tex ? '#ffffff' : '#111111',
          side:        THREE.DoubleSide,
          transparent: true,
          depthWrite:  false,
          opacity:     i === 0 ? 1 : 0
        });

        var mesh = new THREE.Mesh(planeGeo, mat);
        mesh.scale.set(aspect, 1, 1);
        mesh.userData.aspect    = aspect;
        mesh.userData.basePos   = { x: (PLANE_X_OFFSETS[i % PLANE_X_OFFSETS.length]) || 0, y: 0 };
        self.scene.add(mesh);
        self.planes.push(mesh);
      });

      self._layoutPlanes();
      self._initScrollBounds(firstLoad);
    }

    images.forEach(function (src, i) {
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
      this._overscrollAccum = 0;
    }
  };

  /* ----------------------------------------------------------
     SCROLL + VELOCITY UPDATE — from Scroll.update()
     ---------------------------------------------------------- */
  DepthGallery.prototype._updateScroll = function () {
    /* Clamp scroll target to bounds */
    var minScroll = (this.cameraStartZ - this.maxCameraZ) / this.scrollToWorldFactor;
    var maxScroll = (this.cameraStartZ - this.minCameraZ) / this.scrollToWorldFactor;

    /* ── End-of-gallery overscroll detection ── */
    if (this.scrollTarget > maxScroll && !this._endFired) {
      /* User is trying to scroll past the last image */
      this._overscrollAccum += (this.scrollTarget - maxScroll);
      if (this._overscrollAccum >= this._overscrollThreshold) {
        this._endFired = true;
        if (typeof this.onReachEnd === 'function') {
          this.onReachEnd();
        }
      }
    } else if (this.scrollTarget <= maxScroll) {
      /* Reset accumulator if user scrolls back */
      this._overscrollAccum = 0;
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
      var cur = isFinite(p.material.opacity) ? p.material.opacity : 0;
      p.material.opacity += (target - cur) * 0.14;
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
      var opacity    = isFinite(p.material.opacity) ? p.material.opacity : 0;
      var depthInfl  = 1 + i * 0.05;
      var parallaxInfl = opacity * depthInfl;

      /* Position */
      p.position.x = base.x + self.pointerCurrent.x * self.parallaxX * parallaxInfl;
      p.position.y = base.y + self.pointerCurrent.y * self.parallaxY * parallaxInfl
                             + self.driftCurrent * self.driftAmount;
      p.position.z = -i * self.planeGap;

      /* Rotation (breath tilt) */
      var breathInfl = self.breathIntensity * opacity;
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

    /* Hold-to-auto-scroll: advance while holding */
    if (this._autoScrolling) {
      this.scrollTarget += this._autoScrollSpeed;
    }
    /* Idle auto-scroll: always running */
    else {
      this.scrollTarget += this._idleSpeed;
    }

    this._updateScroll();
    var visData = this._updatePlaneVisibility();
    this._updatePlaneMotion();

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

  DepthGallery.prototype.destroy = function () {
    this.stop();
    this._unbindEvents();
    clearTimeout(this._holdTimer);
    this._autoScrolling = false;

    this.planes.forEach(function (p) {
      p.geometry.dispose();
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
    /* Scroll events bound to canvas so they only fire when hovering the panel */
    this.canvas.addEventListener('wheel',       this._onWheel,       { passive: false });
    this.canvas.addEventListener('touchstart',  this._onTouchStart,  { passive: true  });
    this.canvas.addEventListener('touchmove',   this._onTouchMove,   { passive: false });
    this.canvas.addEventListener('touchend',    this._onTouchEnd,    { passive: true  });
    this.canvas.addEventListener('touchcancel', this._onTouchEnd,    { passive: true  });
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    window.addEventListener('pointerleave',this._onPointerLeave,{ passive: true });
    window.addEventListener('resize',      this._onResize);
  };

  DepthGallery.prototype._unbindEvents = function () {
    if (this.canvas) {
      this.canvas.removeEventListener('wheel',      this._onWheel);
      this.canvas.removeEventListener('touchstart', this._onTouchStart);
      this.canvas.removeEventListener('touchmove',  this._onTouchMove);
      this.canvas.removeEventListener('touchend',   this._onTouchEnd);
      this.canvas.removeEventListener('touchcancel',this._onTouchEnd);
    }
    window.removeEventListener('pointermove', this._onPointerMove);
    window.removeEventListener('pointerleave',this._onPointerLeave);
    window.removeEventListener('resize',      this._onResize);
  };

  DepthGallery.prototype._onWheel = function (e) {
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
