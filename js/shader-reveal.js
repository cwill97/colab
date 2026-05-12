/**
 * co:lab — Shader Page Transitions
 *
 * Shared across all pages. Handles two animations:
 *
 *   REVEAL IN  — circle expands from center, revealing page content
 *                beneath a black WebGL overlay. Runs on page load.
 *
 *   WIPE OUT   — circle contracts to center, covering the page in
 *                black. When fully black, navigates to the target URL.
 *                The destination page then runs its own REVEAL IN.
 *
 * Flow: click link → wipe out (1s) → navigate → new page loads →
 *       shader starts fully black → reveal in (1.8s)
 *
 * Uses Three.js + GSAP (both already loaded on every page).
 *
 * Session flag `colab_shaderNav` tells the destination page that it
 * arrived via a shader transition, so it should start fully covered.
 */
(function () {
  'use strict';

  var SESSION_KEY = 'colab_shaderNav';

  /* ── Wait for Three + GSAP ──────────────────────────────── */
  function waitForDeps(cb) {
    if (typeof THREE !== 'undefined' && typeof gsap !== 'undefined') cb();
    else setTimeout(function () { waitForDeps(cb); }, 50);
  }

  /* ── Shaders ─────────────────────────────────────────────── */
  var vertexShader = [
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = uv;',
    '  gl_Position = vec4(position, 1.0);',
    '}'
  ].join('\n');

  var fragmentShader = [
    'precision highp float;',
    '',
    'varying vec2 vUv;',
    '',
    'uniform float uProgress;',
    'uniform vec2  uResolution;',
    'uniform float uTime;',
    '',
    '// ─── Simplex 2D noise (Ashima Arts) ─────────────────────',
    'vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec2 mod289(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }',
    'vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }',
    '',
    'float snoise(vec2 v) {',
    '  const vec4 C = vec4(0.211324865405187, 0.366025403784439,',
    '                     -0.577350269189626, 0.024390243902439);',
    '  vec2 i  = floor(v + dot(v, C.yy));',
    '  vec2 x0 = v - i + dot(i, C.xx);',
    '  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);',
    '  vec4 x12 = x0.xyxy + C.xxzz;',
    '  x12.xy -= i1;',
    '  i = mod289(i);',
    '  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))',
    '         + i.x + vec3(0.0, i1.x, 1.0));',
    '  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),',
    '               dot(x12.zw,x12.zw)), 0.0);',
    '  m = m*m; m = m*m;',
    '  vec3 x  = 2.0 * fract(p * C.www) - 1.0;',
    '  vec3 h  = abs(x) - 0.5;',
    '  vec3 ox = floor(x + 0.5);',
    '  vec3 a0 = x - ox;',
    '  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);',
    '  vec3 g;',
    '  g.x = a0.x * x0.x + h.x * x0.y;',
    '  g.yz = a0.yz * x12.xz + h.yz * x12.yw;',
    '  return 130.0 * dot(m, g);',
    '}',
    '',
    '// ─── FBM ────────────────────────────────────────────────',
    'float fbm(vec2 p) {',
    '  float value = 0.0;',
    '  float amp   = 0.5;',
    '  float freq  = 1.0;',
    '  for (int i = 0; i < 5; i++) {',
    '    value += amp * snoise(p * freq);',
    '    freq  *= 2.0;',
    '    amp   *= 0.5;',
    '  }',
    '  return value;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = vUv - 0.5;',
    '  float aspect = uResolution.x / uResolution.y;',
    '  uv.x *= aspect;',
    '',
    '  float dist = length(uv);',
    '',
    '  vec2 noiseUv = uv * 3.0 + uTime * 0.08;',
    '  float noise = fbm(noiseUv) * 0.35;',
    '',
    '  float maxRadius = 1.2 * max(aspect, 1.0);',
    '  float radius = uProgress * maxRadius;',
    '',
    '  float distorted = dist + noise * (1.0 - uProgress * 0.5);',
    '',
    '  float edgeWidth = 0.12 + 0.08 * (1.0 - uProgress);',
    '  float reveal = smoothstep(radius - edgeWidth, radius + edgeWidth, distorted);',
    '',
    '  // GUARANTEED COVERAGE NEAR uProgress=0 — without this, FBM noise',
    '  // can push `distorted` below `-edgeWidth` at the centre, giving',
    '  // reveal=0 (transparent) and letting the underlying page peek',
    '  // through the supposedly-solid black during the wipeOut hold.',
    '  // The floor ramps from 1.0 (full cover) at uProgress=0 down to',
    '  // 0.0 by uProgress=0.06, handing off to the radius reveal.',
    '  float coverFloor = 1.0 - smoothstep(0.0, 0.06, uProgress);',
    '  reveal = max(reveal, coverFloor);',
    '',
    '  // reveal=0 inside circle (transparent), 1 outside (black)',
    '  // Force fully transparent when progress ≈ 1',
    '  reveal *= 1.0 - smoothstep(0.92, 1.0, uProgress);',
    '',
    '  gl_FragColor = vec4(0.0, 0.0, 0.0, reveal);',
    '}'
  ].join('\n');

  /* ── WebGL layer management ─────────────────────────────── */
  var container, renderer, scene, camera, uniforms, geo, mat, clock;
  var running = false;

  function createLayer() {
    if (renderer) return; /* already exists */

    container = document.createElement('div');
    container.id = 'shader-reveal';
    container.style.cssText =
      'position:fixed;inset:0;z-index:998;pointer-events:none;';
    document.body.appendChild(container);

    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;';

    scene  = new THREE.Scene();
    camera = new THREE.Camera();

    uniforms = {
      uProgress:   { value: 0.0 },
      uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
      uTime:       { value: 0.0 }
    };

    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(
      new Float32Array([ -1,-1,0,  3,-1,0,  -1,3,0 ]), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(
      new Float32Array([ 0,0,  2,0,  0,2 ]), 2));

    mat = new THREE.ShaderMaterial({
      vertexShader:   vertexShader,
      fragmentShader: fragmentShader,
      uniforms:       uniforms,
      transparent:    true,
      depthTest:      false,
      depthWrite:     false
    });

    scene.add(new THREE.Mesh(geo, mat));
    clock = new THREE.Clock();
    running = true;
    animate();

    window.addEventListener('resize', onResize, { passive: true });
  }

  function onResize() {
    if (!renderer) return;
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.uResolution.value.set(window.innerWidth, window.innerHeight);
  }

  function animate() {
    if (!running) return;
    requestAnimationFrame(animate);
    uniforms.uTime.value = clock.getElapsedTime();
    renderer.render(scene, camera);
  }

  function destroyLayer() {
    running = false;
    window.removeEventListener('resize', onResize);
    if (renderer) renderer.dispose();
    if (geo) geo.dispose();
    if (mat) mat.dispose();
    if (container) container.remove();
    renderer = scene = camera = uniforms = geo = mat = clock = container = null;
  }

  /* ── REVEAL IN — progress 0 → 1 (black opens to transparent) */
  function revealIn(startVal) {
    createLayer();
    uniforms.uProgress.value = (startVal !== undefined) ? startVal : 0.0;

    gsap.to(uniforms.uProgress, {
      value: 1.0,
      duration: 1.8,
      ease: 'power2.inOut',
      onComplete: function () {
        destroyLayer();
        /* ── Tesseract glitch reveal — fires after shader opens ── */
        var tessEl = document.querySelector('[data-tesseract]');
        if (tessEl && !tessEl.classList.contains('tesseract-glitch-reveal')) {
          tessEl.classList.add('tesseract-glitch-reveal');
        }
      }
    });
  }

  /* ── WIPE OUT — progress 1 → 0 (transparent closes to black) */
  function wipeOut(callback) {
    createLayer();
    uniforms.uProgress.value = 1.0;

    gsap.to(uniforms.uProgress, {
      value: 0.0,
      duration: 1.0,
      ease: 'power2.inOut',
      onComplete: function () {
        /* Layer stays fully black — navigation happens now.
           The destination page creates its own layer + reveal. */
        if (callback) callback();
      }
    });
  }

  /* ── Link interception ──────────────────────────────────── */
  /* Disabled — Barba.js handles page transitions.
     ShaderTransition.wipeOut / revealIn are called from barba-init.js */
  var transitioning = false;

  /* ── Page-load boot ─────────────────────────────────────── */
  function boot() {
    var arrivedViaShader = false;
    try {
      arrivedViaShader = !!sessionStorage.getItem(SESSION_KEY);
      sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}

    var isProjectPage = document.body.classList.contains('project-page');
    var loaderEl      = document.getElementById('loader');

    if (arrivedViaShader) {
      /* ── Arrived from another page via shader wipe ── */

      /* Make content visible immediately behind the black overlay */
      if (isProjectPage) {
        document.body.classList.add('is-ready');
      }
      document.body.classList.remove('loader-active');

      /* If there's a loader element, remove it (we don't need it) */
      if (loaderEl) {
        loaderEl.remove();
        try { sessionStorage.setItem('colab_visited', '1'); } catch (e) {}
      }

      /* Create layer fully black, then reveal */
      createLayer();
      uniforms.uProgress.value = 0.0;

      setTimeout(function () {
        revealIn(0.0);
      }, 150);

    } else if (loaderEl) {
      /* ── First visit with loader ── */
      document.addEventListener('colab:revealed', function onRevealed() {
        document.removeEventListener('colab:revealed', onRevealed);
        createLayer();
        uniforms.uProgress.value = 0.0;
        setTimeout(function () { revealIn(0.0); }, 100);
      });

    } else if (isProjectPage) {
      /* ── Project page, direct load (bookmark / refresh) ── */
      createLayer();
      uniforms.uProgress.value = 0.0;
      setTimeout(function () {
        document.body.classList.add('is-ready');
        revealIn(0.0);
      }, 80);

    } else {
      /* ── Index page, session revisit (skipLoader path) ── */
      document.addEventListener('colab:revealed', function onRevealed() {
        document.removeEventListener('colab:revealed', onRevealed);
        createLayer();
        uniforms.uProgress.value = 0.0;
        setTimeout(function () { revealIn(0.0); }, 50);
      });

      /* Safety net — if colab:revealed never fires */
      if (!loaderEl) {
        setTimeout(function () {
          if (!renderer) {
            createLayer();
            uniforms.uProgress.value = 0.0;
            revealIn(0.0);
          }
        }, 700);
      }
    }
  }

  waitForDeps(boot);

  /* ── Public API ─────────────────────────────────────────── */
  window.ShaderTransition = {
    wipeOut: function (cb) {
      if (transitioning) return;
      transitioning = true;
      wipeOut(cb);
    },
    revealIn: function (startVal) {
      revealIn(startVal);
      /* Reset lock after reveal completes (1.8s duration + buffer) */
      setTimeout(function () { transitioning = false; }, 2000);
    },
    resetLock: function () { transitioning = false; }
  };

}());
