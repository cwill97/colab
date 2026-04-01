/**
 * co:lab — Menu Liquid Text Displacement (Option B)
 *
 * Full text displacement: menu text is split into individual words,
 * each word receives per-element CSS transforms based on proximity
 * to cursor/touch. A wave equation propagates outward from the
 * interaction point, physically warping the letterforms like
 * they're submerged in liquid.
 *
 * Layered with a WebGL caustic overlay for the bright refraction
 * lines between the displaced text.
 *
 * Start on menu open, stop on menu close.
 */

(function () {
  'use strict';

  /* ── Config ── */
  var WAVE_SPEED    = 600;     /* px/s — how fast the ripple expands */
  var WAVE_DECAY    = 0.92;    /* per-frame amplitude falloff */
  var WAVE_LIFE     = 2.5;     /* seconds before ripple dies */
  var MAX_DISPLACE  = 18;      /* max px translation */
  var MAX_ROTATE    = 8;       /* max degrees rotation */
  var MAX_SCALE     = 0.06;    /* max scale deviation from 1.0 */
  var RING_FREQ     = 0.012;   /* wave density (lower = wider rings) */
  var LERP_SPEED    = 0.08;    /* how fast elements chase their target */
  var MIN_SPAWN_DIST = 50;     /* px between auto-spawned ripples on drag */
  var MAX_RIPPLES   = 6;

  /* ── WebGL overlay config ── */
  var GL_RING_COUNT  = 10.0;
  var GL_RIPPLE_LIFE = 2.5;
  var GL_SPEED       = 1.5;

  /* ── State ── */
  var menuEl       = null;
  var wordSpans    = [];       /* { el, cx, cy, tx, ty, rx, ry, sx, sy } */
  var ripples      = [];       /* { x, y, time, amplitude } in px */
  var running      = false;
  var rafId        = null;
  var startTime    = 0;
  var lastSpawnX   = -1;
  var lastSpawnY   = -1;
  var textSplit    = false;

  /* WebGL */
  var canvas, renderer, scene, camera, glMesh, glUniforms, glClock;
  var glInited = false;

  /* ── Text splitting ── */
  function splitTextNodes(container) {
    var targets = container.querySelectorAll(
      '.menu-about p, .menu-footer-label, .menu-footer-col li'
    );
    wordSpans = [];

    targets.forEach(function (el) {
      /* Skip if already split */
      if (el.dataset.rippleSplit) return;

      var text = el.textContent;
      var words = text.split(/(\s+)/); /* preserve whitespace */
      el.innerHTML = '';
      el.dataset.rippleSplit = '1';

      words.forEach(function (word) {
        if (/^\s+$/.test(word)) {
          el.appendChild(document.createTextNode(word));
          return;
        }
        var span = document.createElement('span');
        span.textContent = word;
        span.style.cssText =
          'display:inline-block;will-change:transform;transition:none;';
        el.appendChild(span);
        wordSpans.push({
          el: span,
          cx: 0, cy: 0,    /* element center (updated on activate) */
          /* Current animated values */
          curTx: 0, curTy: 0, curR: 0, curS: 1
        });
      });
    });

    textSplit = true;
  }

  function updateElementPositions() {
    wordSpans.forEach(function (w) {
      var rect = w.el.getBoundingClientRect();
      w.cx = rect.left + rect.width / 2;
      w.cy = rect.top + rect.height / 2;
    });
  }

  function resetTransforms() {
    wordSpans.forEach(function (w) {
      w.el.style.transform = '';
      w.curTx = 0; w.curTy = 0; w.curR = 0; w.curS = 1;
    });
  }

  /* ── Ripple spawning ── */
  function spawnRipple(px, py, amp) {
    var t = (performance.now() - startTime) / 1000;
    ripples.push({ x: px, y: py, time: t, amplitude: amp || 0.8 });
    while (ripples.length > MAX_RIPPLES) ripples.shift();
  }

  /* ── Per-frame displacement calculation ── */
  function computeDisplacement(cx, cy, now) {
    var totalTx = 0, totalTy = 0, totalR = 0, totalS = 0;

    for (var i = 0; i < ripples.length; i++) {
      var r   = ripples[i];
      var age = now - r.time;
      if (age < 0 || r.amplitude < 0.001) continue;

      var dx  = cx - r.x;
      var dy  = cy - r.y;
      var dist = Math.sqrt(dx * dx + dy * dy);

      /* Wave radius at current time */
      var waveRadius = age * WAVE_SPEED;

      /* How far this element is from the wavefront */
      var delta = dist - waveRadius;

      /* Sine wave — creates concentric rings of displacement */
      var wave = Math.sin(delta * RING_FREQ * Math.PI * 2);

      /* Proximity to wavefront — strongest right at the ring edge */
      var proximity = Math.max(0, 1 - Math.abs(delta) / 200);
      proximity = proximity * proximity; /* sharpen falloff */

      /* Age decay */
      var life = Math.max(0, 1 - age / WAVE_LIFE);
      life = life * life;

      var strength = wave * proximity * life * r.amplitude;

      /* Direction: push outward from ripple center */
      var dirX = dist > 1 ? dx / dist : 0;
      var dirY = dist > 1 ? dy / dist : 0;

      totalTx += dirX * strength * MAX_DISPLACE;
      totalTy += dirY * strength * MAX_DISPLACE;
      totalR  += strength * MAX_ROTATE * (dirX > 0 ? 1 : -1);
      totalS  += Math.abs(strength) * MAX_SCALE;
    }

    return {
      tx: Math.max(-MAX_DISPLACE, Math.min(MAX_DISPLACE, totalTx)),
      ty: Math.max(-MAX_DISPLACE, Math.min(MAX_DISPLACE, totalTy)),
      r:  Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, totalR)),
      s:  1 + Math.max(-MAX_SCALE, Math.min(MAX_SCALE, totalS))
    };
  }

  /* ── WebGL caustic overlay ── */
  var glVertSrc = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  var glFragSrc = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec2  uResolution;',
    'uniform vec3  uRipples[' + MAX_RIPPLES + '];',
    'uniform float uAmplitudes[' + MAX_RIPPLES + '];',
    'uniform int   uRippleCount;',
    '',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);',
    '  vec2 uvA = uv * aspect;',
    '  float totalDisp = 0.0;',
    '',
    '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++) {',
    '    if (i >= uRippleCount) break;',
    '    vec2  center = uRipples[i].xy * aspect;',
    '    float birth  = uRipples[i].z;',
    '    float amp    = uAmplitudes[i];',
    '    float age    = uTime - birth;',
    '    if (age < 0.0 || amp < 0.001) continue;',
    '',
    '    float dist = length(uvA - center);',
    '    float radius = age * ' + GL_SPEED.toFixed(1) + ';',
    '    float wave = sin((dist - radius) * ' + GL_RING_COUNT.toFixed(1) + ' * 6.2832);',
    '    float proximity = 1.0 - smoothstep(0.0, 0.3, abs(dist - radius));',
    '    float life = 1.0 - clamp(age / ' + GL_RIPPLE_LIFE.toFixed(1) + ', 0.0, 1.0);',
    '    life = life * life;',
    '    totalDisp += wave * proximity * life * amp;',
    '  }',
    '',
    '  float caustic = abs(totalDisp) * 0.8;',
    '  float highlight = smoothstep(0.03, 0.2, caustic);',
    '  vec3 col = vec3(0.7, 0.85, 1.0) * highlight * 0.3;',
    '  float alpha = highlight * 0.2 + caustic * 0.08;',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  function initGL() {
    if (glInited || typeof THREE === 'undefined') return;

    canvas = document.createElement('canvas');
    canvas.className = 'menu-ripple-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:91;pointer-events:none;' +
      'width:100%;height:100%;display:none;';
    document.body.appendChild(canvas);

    var W = window.innerWidth, H = window.innerHeight;
    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    scene  = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    var rArr = [], aArr = [];
    for (var i = 0; i < MAX_RIPPLES; i++) {
      rArr.push(new THREE.Vector3(0, 0, -999));
      aArr.push(0.0);
    }

    glUniforms = {
      uTime:        { value: 0 },
      uResolution:  { value: new THREE.Vector2(W, H) },
      uRipples:     { value: rArr },
      uAmplitudes:  { value: aArr },
      uRippleCount: { value: 0 }
    };

    var mat = new THREE.ShaderMaterial({
      vertexShader: glVertSrc, fragmentShader: glFragSrc,
      uniforms: glUniforms, transparent: true, depthWrite: false
    });
    glMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(glMesh);
    glClock = new THREE.Clock();
    glInited = true;

    window.addEventListener('resize', function () {
      var nW = window.innerWidth, nH = window.innerHeight;
      renderer.setSize(nW, nH);
      glUniforms.uResolution.value.set(nW, nH);
    });
  }

  function syncGLUniforms() {
    if (!glUniforms) return;
    var now = (performance.now() - startTime) / 1000;
    for (var i = 0; i < MAX_RIPPLES; i++) {
      if (i < ripples.length) {
        var r = ripples[i];
        /* Convert px to 0–1 UV */
        glUniforms.uRipples.value[i].set(
          r.x / window.innerWidth,
          1 - r.y / window.innerHeight,
          r.time
        );
        glUniforms.uAmplitudes.value[i] = r.amplitude;
      } else {
        glUniforms.uRipples.value[i].set(0, 0, -999);
        glUniforms.uAmplitudes.value[i] = 0;
      }
    }
    glUniforms.uRippleCount.value = ripples.length;
  }

  /* ── Main loop ── */
  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    var now = (performance.now() - startTime) / 1000;

    /* Decay & prune ripples */
    for (var i = ripples.length - 1; i >= 0; i--) {
      ripples[i].amplitude *= WAVE_DECAY;
      if (now - ripples[i].time > WAVE_LIFE || ripples[i].amplitude < 0.001) {
        ripples.splice(i, 1);
      }
    }

    /* Displace each word */
    for (var j = 0; j < wordSpans.length; j++) {
      var w = wordSpans[j];
      var d = computeDisplacement(w.cx, w.cy, now);

      /* Lerp toward target for smooth organic motion */
      w.curTx += (d.tx - w.curTx) * LERP_SPEED;
      w.curTy += (d.ty - w.curTy) * LERP_SPEED;
      w.curR  += (d.r  - w.curR)  * LERP_SPEED;
      w.curS  += (d.s  - w.curS)  * LERP_SPEED;

      w.el.style.transform =
        'translate(' + w.curTx.toFixed(2) + 'px,' + w.curTy.toFixed(2) + 'px) ' +
        'rotate(' + w.curR.toFixed(2) + 'deg) ' +
        'scale(' + w.curS.toFixed(4) + ')';
    }

    /* WebGL overlay */
    if (glInited && renderer) {
      glUniforms.uTime.value = now;
      syncGLUniforms();
      renderer.render(scene, camera);
    }
  }

  /* ── Input ── */
  function onPointer(e) {
    var dx = e.clientX - lastSpawnX;
    var dy = e.clientY - lastSpawnY;
    if (Math.sqrt(dx * dx + dy * dy) > MIN_SPAWN_DIST) {
      spawnRipple(e.clientX, e.clientY, 0.6);
      lastSpawnX = e.clientX; lastSpawnY = e.clientY;
    }
  }

  function onTouch(e) {
    var t = e.touches[0];
    if (!t) return;
    var dx = t.clientX - lastSpawnX;
    var dy = t.clientY - lastSpawnY;
    if (Math.sqrt(dx * dx + dy * dy) > MIN_SPAWN_DIST) {
      spawnRipple(t.clientX, t.clientY, 0.8);
      lastSpawnX = t.clientX; lastSpawnY = t.clientY;
    }
  }

  function onClick(e) {
    spawnRipple(e.clientX, e.clientY, 1.0);
  }

  function bindInput() {
    if (!menuEl) return;
    menuEl.addEventListener('mousemove', onPointer, { passive: true });
    menuEl.addEventListener('touchstart', onTouch, { passive: true });
    menuEl.addEventListener('touchmove', onTouch, { passive: true });
    menuEl.addEventListener('click', onClick);
  }

  /* ── Public API ── */
  function start() {
    menuEl = document.querySelector('[data-nav-menu]');
    if (!menuEl) return;

    /* Split text on first open */
    if (!textSplit) {
      splitTextNodes(menuEl);
      bindInput();
    }

    initGL();

    startTime = performance.now();
    ripples = [];
    lastSpawnX = -1; lastSpawnY = -1;

    /* Measure positions after menu is visible */
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        updateElementPositions();
      });
    });

    if (canvas) canvas.style.display = 'block';
    if (glClock) glClock.start();
    running = true;
    tick();
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (canvas) canvas.style.display = 'none';
    resetTransforms();
  }

  window.colabMenuRipple = { start: start, stop: stop };

}());
