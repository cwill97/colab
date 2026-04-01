/**
 * co:lab — Menu Liquid Ripple Overlay
 *
 * Transparent WebGL canvas over the menu. On hover/press/drag,
 * concentric liquid ripples distort the content underneath.
 * Uses a simple 2D wave equation with multiple spawn points
 * that decay over time. The shader outputs only alpha-based
 * refraction offsets visible through mix-blend-mode.
 *
 * Activated when menu opens, paused when closed.
 */

(function () {
  'use strict';

  /* ── Config ── */
  var MAX_RIPPLES   = 8;       /* max concurrent ripple origins */
  var RIPPLE_SPEED  = 1.8;     /* expansion speed */
  var RIPPLE_LIFE   = 3.0;     /* seconds before full decay */
  var RING_COUNT    = 12.0;    /* number of concentric rings */
  var DISTORT_STR   = 0.025;   /* displacement strength */
  var DAMPING       = 0.92;    /* per-frame amplitude decay */

  /* ── State ── */
  var canvas, renderer, scene, camera, mesh, uniforms;
  var running    = false;
  var rafId      = null;
  var ripples    = [];  /* { x, y, time, amplitude } in NDC */
  var clock      = null;
  var menuEl     = null;

  /* ── Shaders ── */
  var vertSrc = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  var fragSrc = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform float uTime;',
    'uniform vec2  uResolution;',
    '',
    '/* Up to ' + MAX_RIPPLES + ' ripple origins */',
    'uniform vec3  uRipples[' + MAX_RIPPLES + '];', /* xy = position, z = birth time */
    'uniform float uAmplitudes[' + MAX_RIPPLES + '];',
    'uniform int   uRippleCount;',
    '',
    'void main() {',
    '  vec2 uv = vUv;',
    '  vec2 aspect = vec2(uResolution.x / uResolution.y, 1.0);',
    '  vec2 uvA = uv * aspect;',
    '',
    '  float totalDisp = 0.0;',
    '  vec2  totalDir  = vec2(0.0);',
    '',
    '  for (int i = 0; i < ' + MAX_RIPPLES + '; i++) {',
    '    if (i >= uRippleCount) break;',
    '    vec2  center = uRipples[i].xy * aspect;',
    '    float birth  = uRipples[i].z;',
    '    float amp    = uAmplitudes[i];',
    '    float age    = uTime - birth;',
    '    if (age < 0.0 || amp < 0.001) continue;',
    '',
    '    float dist   = length(uvA - center);',
    '    float radius = age * ' + RIPPLE_SPEED.toFixed(1) + ';',
    '',
    '    /* Ring pattern — concentric sine waves expanding outward */',
    '    float wave = sin((dist - radius) * ' + RING_COUNT.toFixed(1) + ' * 6.2832);',
    '',
    '    /* Fade: stronger near the wavefront, dies behind it */',
    '    float proximity = 1.0 - smoothstep(0.0, 0.35, abs(dist - radius));',
    '',
    '    /* Age decay */',
    '    float life = 1.0 - clamp(age / ' + RIPPLE_LIFE.toFixed(1) + ', 0.0, 1.0);',
    '    life = life * life;', /* ease out */
    '',
    '    float strength = wave * proximity * life * amp;',
    '    vec2  dir = (dist > 0.001) ? normalize(uvA - center) : vec2(0.0);',
    '    totalDir += dir * strength;',
    '    totalDisp += abs(strength);',
    '  }',
    '',
    '  /* Displacement offset — shifts UV to create refraction */',
    '  vec2 offset = totalDir * ' + DISTORT_STR.toFixed(4) + ';',
    '',
    '  /* Visible as a subtle bright/dark caustic pattern */',
    '  float caustic = totalDisp * 0.6;',
    '',
    '  /* Edge highlight — bright rings where displacement is strong */',
    '  float highlight = smoothstep(0.02, 0.15, caustic);',
    '',
    '  /* Output: mostly transparent, with faint bright caustic lines */',
    '  vec3 col = vec3(1.0) * highlight * 0.35;',
    '  float alpha = highlight * 0.25 + caustic * 0.1;',
    '',
    '  gl_FragColor = vec4(col, alpha);',
    '}'
  ].join('\n');

  /* ── Init ── */
  function init() {
    menuEl = document.querySelector('[data-nav-menu]');
    if (!menuEl) return;

    /* Check if already initialised */
    if (canvas) return;

    canvas = document.createElement('canvas');
    canvas.className = 'menu-ripple-canvas';
    canvas.setAttribute('aria-hidden', 'true');

    /* Style — sits over menu content, below nav */
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:91;pointer-events:none;' +
      'width:100%;height:100%;display:none;';

    document.body.appendChild(canvas);

    var W = window.innerWidth;
    var H = window.innerHeight;

    renderer = new THREE.WebGLRenderer({ canvas: canvas, alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    scene  = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* Build uniform arrays */
    var rippleArr = [];
    var ampArr    = [];
    for (var i = 0; i < MAX_RIPPLES; i++) {
      rippleArr.push(new THREE.Vector3(0, 0, -999));
      ampArr.push(0.0);
    }

    uniforms = {
      uTime:        { value: 0 },
      uResolution:  { value: new THREE.Vector2(W, H) },
      uRipples:     { value: rippleArr },
      uAmplitudes:  { value: ampArr },
      uRippleCount: { value: 0 }
    };

    var mat = new THREE.ShaderMaterial({
      vertexShader:   vertSrc,
      fragmentShader: fragSrc,
      uniforms:       uniforms,
      transparent:    true,
      depthWrite:     false
    });

    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(mesh);
    clock = new THREE.Clock();

    /* Resize */
    window.addEventListener('resize', function () {
      var nW = window.innerWidth;
      var nH = window.innerHeight;
      renderer.setSize(nW, nH);
      uniforms.uResolution.value.set(nW, nH);
    });

    /* Input — pointer events on the menu element */
    menuEl.addEventListener('mousemove', onPointer, { passive: true });
    menuEl.addEventListener('touchstart', onTouch, { passive: true });
    menuEl.addEventListener('touchmove', onTouch, { passive: true });

    /* Click/tap spawns a stronger ripple */
    menuEl.addEventListener('click', function (e) {
      spawnRipple(e.clientX, e.clientY, 1.0);
    });
  }

  /* ── Spawn a ripple at screen coordinates ── */
  function spawnRipple(clientX, clientY, amp) {
    if (!uniforms) return;

    /* Convert to 0–1 UV space (bottom-left origin for GL) */
    var x = clientX / window.innerWidth;
    var y = 1.0 - (clientY / window.innerHeight);

    var t = clock ? clock.getElapsedTime() : 0;

    ripples.push({ x: x, y: y, time: t, amplitude: amp || 0.6 });

    /* Cap at MAX_RIPPLES — remove oldest */
    while (ripples.length > MAX_RIPPLES) {
      ripples.shift();
    }

    syncUniforms();
  }

  function syncUniforms() {
    for (var i = 0; i < MAX_RIPPLES; i++) {
      if (i < ripples.length) {
        var r = ripples[i];
        uniforms.uRipples.value[i].set(r.x, r.y, r.time);
        uniforms.uAmplitudes.value[i] = r.amplitude;
      } else {
        uniforms.uRipples.value[i].set(0, 0, -999);
        uniforms.uAmplitudes.value[i] = 0;
      }
    }
    uniforms.uRippleCount.value = ripples.length;
  }

  /* ── Input handlers ── */
  var moveTimer    = null;
  var lastSpawnX   = -1;
  var lastSpawnY   = -1;
  var MIN_MOVE_DIST = 40; /* px between auto-spawned ripples on drag */

  function onPointer(e) {
    var dx = e.clientX - lastSpawnX;
    var dy = e.clientY - lastSpawnY;
    if (Math.sqrt(dx * dx + dy * dy) > MIN_MOVE_DIST) {
      spawnRipple(e.clientX, e.clientY, 0.5);
      lastSpawnX = e.clientX;
      lastSpawnY = e.clientY;
    }
  }

  function onTouch(e) {
    var touch = e.touches[0];
    if (!touch) return;
    var dx = touch.clientX - lastSpawnX;
    var dy = touch.clientY - lastSpawnY;
    if (Math.sqrt(dx * dx + dy * dy) > MIN_MOVE_DIST) {
      spawnRipple(touch.clientX, touch.clientY, 0.7);
      lastSpawnX = touch.clientX;
      lastSpawnY = touch.clientY;
    }
  }

  /* ── Render loop ── */
  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    var t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    /* Decay amplitudes and prune dead ripples */
    for (var i = ripples.length - 1; i >= 0; i--) {
      ripples[i].amplitude *= DAMPING;
      var age = t - ripples[i].time;
      if (age > RIPPLE_LIFE || ripples[i].amplitude < 0.001) {
        ripples.splice(i, 1);
      }
    }
    syncUniforms();

    renderer.render(scene, camera);
  }

  /* ── Public: start / stop ── */
  function start() {
    if (!renderer) {
      if (typeof THREE === 'undefined') return;
      init();
    }
    if (!canvas) return;
    canvas.style.display = 'block';
    running = true;
    if (clock) clock.start();
    /* Reset ripples */
    ripples = [];
    lastSpawnX = -1;
    lastSpawnY = -1;
    syncUniforms();
    tick();
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (canvas) canvas.style.display = 'none';
  }

  /* ── Expose globally ── */
  window.colabMenuRipple = {
    start: start,
    stop:  stop
  };

  /* Auto-init when Three.js is ready */
  function waitForThree() {
    if (typeof THREE !== 'undefined') init();
    else setTimeout(waitForThree, 100);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', waitForThree);
  } else {
    waitForThree();
  }

}());
