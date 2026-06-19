/* ============================================================
   DepthHover — mouse-parallax displacement on hover.
   Uses image luminance as a depth map: bright pixels (faces,
   highlights) shift toward the viewer on mouse move, dark
   pixels (shadows, backgrounds) stay fixed — creating a 3D
   parallax illusion with zero extra assets.
   Desktop only. Depends on THREE.js being loaded first.
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

  var _frag = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec2  uMouse;',
    'uniform float uStrength;',
    'uniform vec2  uUvScale;',
    'uniform vec2  uUvOffset;',
    '',
    'void main() {',
    '  vec2 uv = vUv * uUvScale + uUvOffset;',
    '',
    '  // Derive depth from luminance — bright = near, dark = far',
    '  float depth = dot(texture2D(uTexture, uv).rgb, vec3(0.299, 0.587, 0.114));',
    '',
    '  // Parallax: bright pixels pop toward the viewer (shift in mouse direction)',
    '  vec2 dispUv = uv + vec2(uMouse.x, -uMouse.y) * depth * uStrength * 0.035;',
    '  dispUv = clamp(dispUv, 0.001, 0.999);',
    '  vec4 col = texture2D(uTexture, dispUv);',
    '',
    '  // Subtle directional sheen on the side facing the mouse',
    '  vec2 mDir = normalize(uMouse + vec2(0.0001, 0.0001));',
    '  float sheen = pow(dot(mDir, vUv - 0.5) * 0.5 + 0.5, 5.0) * uStrength * 0.07;',
    '  col.rgb += sheen;',
    '',
    '  gl_FragColor = col;',
    '}'
  ].join('\n');

  /* UV scale + offset that replicates object-fit: cover */
  function coverUvParams(canvasW, canvasH, imgW, imgH) {
    var cA = canvasW / canvasH;
    var iA = imgW   / imgH;
    if (cA > iA) {
      var sy = iA / cA;
      return {
        scale:  new THREE.Vector2(1.0, sy),
        offset: new THREE.Vector2(0.0, (1.0 - sy) * 0.5)
      };
    } else {
      var sx = cA / iA;
      return {
        scale:  new THREE.Vector2(sx, 1.0),
        offset: new THREE.Vector2((1.0 - sx) * 0.5, 0.0)
      };
    }
  }

  /* ──────────────────────────────────────────────────────────────
     Constructor
     fig — container element (figure / div) holding the <img>
  ────────────────────────────────────────────────────────────── */
  function DepthHover(fig) {
    this.fig              = fig;
    this.canvas           = null;
    this.renderer         = null;
    this.scene            = null;
    this.camera           = null;
    this.mesh             = null;
    this.uniforms         = null;
    this.rafId            = null;
    this.running          = false;
    this._textureReady    = false;
    this._targetMouse     = { x: 0, y: 0 };
    this._currentMouse    = { x: 0, y: 0 };
    this._targetStrength  = 0;
    this._currentStrength = 0;
    this._tick            = this._tick.bind(this);
    this._onMouseMove     = this._onMouseMove.bind(this);
    this._onMouseEnter    = this._onMouseEnter.bind(this);
    this._onMouseLeave    = this._onMouseLeave.bind(this);
  }

  DepthHover.prototype.init = function () {
    if (typeof THREE === 'undefined') return;

    var self = this;
    var img  = this.fig.querySelector('img');
    if (!img) return;

    if (window.getComputedStyle(this.fig).position === 'static') {
      this.fig.style.position = 'relative';
    }

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;opacity:0;';
    this.fig.appendChild(canvas);
    this.canvas = canvas;

    var W = this.fig.offsetWidth  || 400;
    var H = this.fig.offsetHeight || 400;

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: false, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H);
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    canvas.style.width  = '100%';
    canvas.style.height = '100%';

    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTexture:  { value: null },
      uMouse:    { value: new THREE.Vector2(0, 0) },
      uStrength: { value: 0.0 },
      uUvScale:  { value: new THREE.Vector2(1, 1) },
      uUvOffset: { value: new THREE.Vector2(0, 0) }
    };

    var mat = new THREE.ShaderMaterial({
      vertexShader:   _vert,
      fragmentShader: _frag,
      uniforms:       this.uniforms,
      transparent:    false,
      depthWrite:     false
    });

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    this.scene.add(this.mesh);

    /* Load texture — no crossOrigin per /sanity/* proxy rules */
    var src = img.currentSrc || img.src || '';
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
        self._textureReady = true;
      });
    }

    this.fig.addEventListener('mouseenter', this._onMouseEnter);
    this.fig.addEventListener('mouseleave', this._onMouseLeave);
    this.fig.addEventListener('mousemove',  this._onMouseMove);
  };

  DepthHover.prototype._onMouseEnter = function () {
    if (!this._textureReady) return;
    this._targetStrength = 1;
    if (!this.running) {
      this.running = true;
      if (this.canvas) this.canvas.style.opacity = '1';
      this._tick();
    }
  };

  DepthHover.prototype._onMouseLeave = function () {
    this._targetStrength = 0;
    this._targetMouse.x  = 0;
    this._targetMouse.y  = 0;
  };

  DepthHover.prototype._onMouseMove = function (e) {
    var rect = this.fig.getBoundingClientRect();
    this._targetMouse.x = ((e.clientX - rect.left) / rect.width  - 0.5) * 2;
    this._targetMouse.y = ((e.clientY - rect.top)  / rect.height - 0.5) * 2;
  };

  DepthHover.prototype._tick = function () {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    this._currentMouse.x  += (this._targetMouse.x  - this._currentMouse.x)  * 0.1;
    this._currentMouse.y  += (this._targetMouse.y  - this._currentMouse.y)  * 0.1;
    this._currentStrength += (this._targetStrength - this._currentStrength) * 0.08;

    if (this.uniforms) {
      this.uniforms.uMouse.value.set(this._currentMouse.x, this._currentMouse.y);
      this.uniforms.uStrength.value = this._currentStrength;
    }

    if (this.renderer) this.renderer.render(this.scene, this.camera);

    /* Stop once fully eased back to neutral after mouse leave */
    if (this._targetStrength === 0 && this._currentStrength < 0.002) {
      this.running = false;
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      if (this.canvas) this.canvas.style.opacity = '0';
    }
  };

  DepthHover.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.fig.removeEventListener('mouseenter', this._onMouseEnter);
    this.fig.removeEventListener('mouseleave', this._onMouseLeave);
    this.fig.removeEventListener('mousemove',  this._onMouseMove);
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
    this.scene    = null;
    this.camera   = null;
    this.uniforms = null;
  };

  global.DepthHover = DepthHover;
}(window));
