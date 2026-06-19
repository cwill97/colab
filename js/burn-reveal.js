/* ============================================================
   BurnReveal — noise-dissolve image reveal for the about page.
   Applies the same FBM burn shader as the project depth gallery
   to any container element that holds an <img>.
   Depends on THREE.js being loaded before this file.
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
    'uniform float uProgress;',
    'uniform float uTime;',
    'uniform vec2 uUvScale;',
    'uniform vec2 uUvOffset;',
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
    '  vec2 uv = vUv * uUvScale + uUvOffset;',
    '  vec4 tex = texture2D(uTexture, uv);',
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
  function BurnReveal(fig) {
    this.fig           = fig;
    this._img          = null;
    this.canvas        = null;
    this.renderer      = null;
    this.scene         = null;
    this.camera        = null;
    this.mesh          = null;
    this.uniforms      = null;
    this.rafId          = null;
    this.running        = false;
    this._textureReady  = false;
    this._pendingReveal = null;  /* { duration, onComplete } set when reveal() called before texture */
    this._pendingScrub  = null;  /* { trigger, start, end } set when scrub() called before texture */
    this._scrubTrigger  = null;
    this._tick          = this._tick.bind(this);
  }

  BurnReveal.prototype.init = function () {
    if (typeof THREE === 'undefined') return;

    var self  = this;
    var img   = this.fig.querySelector('img, video');
    this._img = img;

    /* Ensure figure is a positioning ancestor for the canvas overlay */
    if (window.getComputedStyle(this.fig).position === 'static') {
      this.fig.style.position = 'relative';
    }
    /* Hide the real image — canvas renders the texture during burn */
    if (img) img.style.visibility = 'hidden';

    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;';
    this.fig.appendChild(canvas);
    this.canvas = canvas;

    var W = this.fig.offsetWidth  || 400;
    var H = this.fig.offsetHeight || 400;

    this.renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(W, H);
    /* SRGBColorSpace exists in r150+; silently ignored on r128 — effect still correct */
    if (THREE.SRGBColorSpace) this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    /* Let CSS own canvas dimensions so it fills the container */
    canvas.style.width  = '100%';
    canvas.style.height = '100%';

    /* Orthographic camera renders a full-viewport 2×2 quad */
    this.scene  = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    this.uniforms = {
      uTexture:  { value: null },
      uProgress: { value: 0.0 },
      uTime:     { value: 0.0 },
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
        self._textureReady = true;
        if (self._pendingReveal) {
          var pending = self._pendingReveal;
          self._pendingReveal = null;
          self._doReveal(pending.duration, pending.onComplete);
        } else if (self._pendingScrub) {
          var ps = self._pendingScrub;
          self._pendingScrub = null;
          self._doScrub(ps.trigger, ps.start, ps.end);
        }
      }, undefined, function () {
        self._textureReady = true;
        if (self._pendingReveal) {
          var pending = self._pendingReveal;
          self._pendingReveal = null;
          self._doReveal(pending.duration, pending.onComplete);
        } else if (self._pendingScrub) {
          var ps = self._pendingScrub;
          self._pendingScrub = null;
          self._doScrub(ps.trigger, ps.start, ps.end);
        }
      });
    } else {
      this._textureReady = true;
    }

    this.running = true;
    this._tick();
  };

  BurnReveal.prototype._tick = function () {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);
    if (this.uniforms) this.uniforms.uTime.value = performance.now() * 0.001;
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  };

  /* Animate uProgress 0 → 1 then clean up.
     Defers until texture is ready so the burn effect is always visible. */
  BurnReveal.prototype.reveal = function (duration, onComplete) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      if (this.uniforms) this.uniforms.uProgress.value = 1.0;
      this._finish();
      if (onComplete) onComplete();
      return;
    }
    if (!this._textureReady) {
      this._pendingReveal = { duration: duration, onComplete: onComplete };
      return;
    }
    this._doReveal(duration, onComplete);
  };

  BurnReveal.prototype._doReveal = function (duration, onComplete) {
    var self = this;
    if (typeof gsap === 'undefined' || !this.uniforms) {
      this._finish();
      if (onComplete) onComplete();
      return;
    }
    gsap.to(this.uniforms.uProgress, {
      value:    1.0,
      duration: duration || 1.2,
      ease:     'power2.inOut',
      onComplete: function () {
        self._finish();
        if (onComplete) onComplete();
      }
    });
  };

  /* Tie uProgress directly to scroll position — canvas lives on forever.
     Call instead of reveal() when scroll-scrub behaviour is wanted. */
  BurnReveal.prototype.scrub = function (trigger, start, end) {
    if (!this._textureReady) {
      this._pendingScrub = { trigger: trigger, start: start, end: end };
      return;
    }
    this._doScrub(trigger, start, end);
  };

  BurnReveal.prototype._doScrub = function (trigger, start, end) {
    if (typeof gsap === 'undefined' || !this.uniforms) return;
    var tween = gsap.to(this.uniforms.uProgress, {
      value: 1.0,
      ease: 'none',
      scrollTrigger: {
        trigger: trigger,
        start:   start || 'top 85%',
        end:     end   || 'top 20%',
        scrub:   1
      }
    });
    if (tween && tween.scrollTrigger) this._scrubTrigger = tween.scrollTrigger;
  };

  /* Remove canvas overlay, restore real image */
  BurnReveal.prototype._finish = function () {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this._img) { this._img.style.visibility = ''; }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
    }
    this._disposeGL();
  };

  BurnReveal.prototype._disposeGL = function () {
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

  /* Called by scroll-about.destroy() on Barba page transitions */
  BurnReveal.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this._scrubTrigger) { this._scrubTrigger.kill(); this._scrubTrigger = null; }
    if (this._img) { this._img.style.visibility = ''; }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
      this.canvas = null;
    }
    this._disposeGL();
  };

  global.BurnReveal = BurnReveal;
}(window));
