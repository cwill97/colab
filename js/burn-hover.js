/* ============================================================
   BurnHover — cursor-following burn-hole effect.
   Uses the same FBM noise shader as BurnReveal but driven by
   distance from the cursor instead of a global progress value.
   On hover an irregular glowing hole burns at the cursor position
   and follows the mouse with a soft lerp trail.
   Desktop only. Requires THREE.js + GSAP.
   ============================================================ */
(function (global) {
  'use strict';

  var _vert = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  /* Fragment: punches a noisy circular hole at uMouse with an amber glow ring. */
  var _frag = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec2  uMouse;',
    'uniform float uRadius;',
    'uniform float uTime;',
    'uniform float uAspect;',   /* figW / figH — corrects to screen-circular hole */
    'uniform vec2  uUvScale;',
    'uniform vec2  uUvOffset;',
    '',
    'float hash(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float noise(vec2 p) {',
    '  vec2 i = floor(p); vec2 f = fract(p);',
    '  f = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(hash(i), hash(i + vec2(1,0)), f.x),',
    '             mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x), f.y);',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0, a = 0.5;',
    '  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }',
    '  return v;',
    '}',
    '',
    'void main() {',
    '  vec2 uv  = vUv * uUvScale + uUvOffset;',
    '  vec4 tex = texture2D(uTexture, uv);',
    '',
    '  /* Aspect-corrected distance from cursor → circular hole on screen */',
    '  vec2 d = vUv - uMouse;',
    '  d.x *= uAspect;',
    '  float dist = length(d);',
    '',
    '  /* FBM noise perturbs the hole edge for a fire/burn feel */',
    '  float n = fbm(vUv * 7.0 + uTime * 0.05) * 2.0 - 1.0;',
    '  float r = uRadius * (1.0 + n * 0.28);',
    '',
    '  /* Alpha cutout — 0 inside hole, 1 outside; fades in as radius opens */',
    '  float holeMask = smoothstep(r - 0.008, r + 0.008, dist);',
    '  float mask     = mix(1.0, holeMask, smoothstep(0.0, 0.02, uRadius));',
    '',
    '  /* Amber glow ring just outside the burn edge */',
    '  float glow    = smoothstep(r + 0.042, r, dist)',
    '                * smoothstep(0.0, 0.025, uRadius);',
    '  vec3  glowCol = mix(vec3(1.0, 0.55, 0.02), vec3(0.85, 0.05, 0.0), glow);',
    '  vec3  col     = mix(tex.rgb, glowCol, glow * 0.88);',
    '',
    '  gl_FragColor = vec4(col, tex.a * mask);',
    '}'
  ].join('\n');

  /* Replicates object-fit: cover UV params — identical to burn-reveal.js */
  function coverUvParams(W, H, iW, iH) {
    var cA = W / H, iA = iW / iH;
    if (cA > iA) {
      var sy = iA / cA;
      return { scale: new THREE.Vector2(1, sy), offset: new THREE.Vector2(0, (1 - sy) * 0.5) };
    }
    var sx = cA / iA;
    return { scale: new THREE.Vector2(sx, 1), offset: new THREE.Vector2((1 - sx) * 0.5, 0) };
  }

  /* ── Constructor ──────────────────────────────────────────── */
  function BurnHover(fig) {
    this.fig           = fig;
    this._img          = null;
    this.canvas        = null;
    this.renderer      = null;
    this.scene         = null;
    this.camera        = null;
    this.mesh          = null;
    this.uniforms      = null;
    this.rafId         = null;
    this.running       = false;
    this._textureReady = false;
    this._lerpMouse    = { x: 0.5, y: 0.5 };
    this._targetMouse  = { x: 0.5, y: 0.5 };
    this._figRect      = null;
    this._leaveId      = 0; /* used to cancel stale onComplete callbacks */

    this._tick         = this._tick.bind(this);
    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onResize     = this._onResize.bind(this);
  }

  /* ── Init ─────────────────────────────────────────────────── */
  BurnHover.prototype.init = function () {
    if (typeof THREE === 'undefined') return;
    var self = this;
    var fig  = this.fig;

    var img = fig.querySelector('img');
    this._img = img;

    if (window.getComputedStyle(fig).position === 'static') {
      fig.style.position = 'relative';
    }

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;';
    fig.appendChild(canvas);
    this.canvas = canvas;

    var W = fig.offsetWidth  || 400;
    var H = fig.offsetHeight || 400;

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H);
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.style.width  = '100%';
    canvas.style.height = '100%';

    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTexture:  { value: null },
      uMouse:    { value: new THREE.Vector2(0.5, 0.5) },
      uRadius:   { value: 0.0 },
      uTime:     { value: 0.0 },
      uAspect:   { value: W / H },
      uUvScale:  { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) }
    };

    var mat = new THREE.ShaderMaterial({
      vertexShader:   _vert,
      fragmentShader: _frag,
      uniforms:       this.uniforms,
      transparent:    true,
      depthWrite:     false
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this.mesh);

    /* Load texture — no crossOrigin per /sanity/* proxy rules */
    var src = img ? (img.currentSrc || img.src || '') : '';
    if (src && src.indexOf('data:') !== 0) {
      var loader = new THREE.TextureLoader();
      loader.crossOrigin = undefined;
      loader.load(src, function (tex) {
        if (!self.uniforms) return;
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        self.uniforms.uTexture.value = tex;
        if (tex.image && tex.image.width > 0) {
          var p = coverUvParams(W, H, tex.image.width, tex.image.height);
          self.uniforms.uUvScale.value  = p.scale;
          self.uniforms.uUvOffset.value = p.offset;
        }
        /* Pre-render once (uRadius=0) so canvas has a valid frame ready before hover */
        self.uniforms.uTime.value = performance.now() * 0.001;
        self.renderer.render(self.scene, self.camera);
        self._textureReady = true;
      }, undefined, function () {
        self._textureReady = true; /* load error: allow hover attempt anyway */
      });
    }

    this._updateRect();
    fig.addEventListener('mouseenter', this._onMouseEnter);
    fig.addEventListener('mouseleave', this._onMouseLeave);
    fig.addEventListener('mousemove',  this._onMouseMove);
    window.addEventListener('resize',  this._onResize);
  };

  /* ── Helpers ──────────────────────────────────────────────── */
  BurnHover.prototype._updateRect = function () {
    this._figRect = this.fig.getBoundingClientRect();
  };

  /* ── Event handlers ───────────────────────────────────────── */
  BurnHover.prototype._onMouseEnter = function () {
    if (!this._textureReady) return;
    this._leaveId++; /* invalidate any in-flight leave tween callback */
    this._updateRect();

    /* Show canvas overlay, hide native img — both in same paint tick */
    this.canvas.style.opacity = '1';
    if (this._img) this._img.style.visibility = 'hidden';

    if (this.uniforms && typeof gsap !== 'undefined') {
      gsap.killTweensOf(this.uniforms.uRadius);
      gsap.to(this.uniforms.uRadius, { value: 0.12, duration: 0.45, ease: 'power2.out' });
    }

    if (!this.running) {
      this.running = true;
      this._tick();
    }
  };

  BurnHover.prototype._onMouseLeave = function () {
    var self = this;
    var id   = ++this._leaveId; /* snapshot — onComplete checks it's still valid */

    if (this.uniforms && typeof gsap !== 'undefined') {
      gsap.killTweensOf(this.uniforms.uRadius);
      gsap.to(this.uniforms.uRadius, {
        value:    0,
        duration: 0.55,
        ease:     'power2.in',
        onComplete: function () {
          if (self._leaveId !== id) return; /* user re-entered; ignore */
          self.running = false;
          if (self.rafId) { cancelAnimationFrame(self.rafId); self.rafId = null; }
          if (self.canvas) self.canvas.style.opacity = '0';
          if (self._img)   self._img.style.visibility = '';
        }
      });
    } else {
      /* GSAP unavailable: instant collapse */
      if (this.uniforms) this.uniforms.uRadius.value = 0;
      this.running = false;
      this.canvas.style.opacity = '0';
      if (this._img) this._img.style.visibility = '';
    }
  };

  BurnHover.prototype._onMouseMove = function (e) {
    var r = this._figRect;
    if (!r) return;
    this._targetMouse.x = (e.clientX - r.left) / r.width;
    /* Flip Y: WebGL UV y=0 is bottom, screen y=0 is top */
    this._targetMouse.y = 1.0 - (e.clientY - r.top) / r.height;
  };

  BurnHover.prototype._onResize = function () {
    this._updateRect();
  };

  /* ── Render loop ──────────────────────────────────────────── */
  BurnHover.prototype._tick = function () {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);
    if (!this.uniforms || !this.renderer) return;

    /* Soft lerp: hole trails slightly behind cursor for a natural feel */
    var lm = this._lerpMouse, tm = this._targetMouse;
    lm.x += (tm.x - lm.x) * 0.12;
    lm.y += (tm.y - lm.y) * 0.12;
    this.uniforms.uMouse.value.set(lm.x, lm.y);
    this.uniforms.uTime.value = performance.now() * 0.001;

    this.renderer.render(this.scene, this.camera);
  };

  /* ── Cleanup ──────────────────────────────────────────────── */
  BurnHover.prototype.destroy = function () {
    this.running = false;
    this._leaveId++;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.fig.removeEventListener('mouseenter', this._onMouseEnter);
    this.fig.removeEventListener('mouseleave', this._onMouseLeave);
    this.fig.removeEventListener('mousemove',  this._onMouseMove);
    window.removeEventListener('resize',       this._onResize);
    if (this._img) this._img.style.visibility = '';
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
    }
    if (this.mesh) {
      this.mesh.geometry.dispose();
      if (this.uniforms && this.uniforms.uTexture && this.uniforms.uTexture.value) {
        this.uniforms.uTexture.value.dispose();
      }
      this.mesh.material.dispose();
      this.mesh = null;
    }
    if (this.renderer) { this.renderer.dispose(); this.renderer = null; }
    this.scene = this.camera = this.uniforms = null;
  };

  global.BurnHover = BurnHover;
}(window));
