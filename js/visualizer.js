/**
 * co:lab — Chladni Plate Visualizer
 * Simulates sand/particle patterns on a vibrating plate.
 * Audio-reactive: frequency bands drive Chladni mode numbers (n, m),
 * producing geometric nodal-line patterns that reshape in real-time.
 * Particles settle along nodal lines (amplitude ≈ 0), matching the
 * globe's ice-blue palette (0.7, 0.85, 1.0).
 * Click to play/mute.
 *
 * Audio pipeline is independent of WebGL rendering — audio persists
 * across Barba transitions and works even when the visualizer canvas
 * is hidden (e.g. project page direct load).
 */

(function () {
  'use strict';

  function waitForLibs(cb) {
    if (typeof THREE !== 'undefined' && typeof gsap !== 'undefined') cb();
    else setTimeout(function () { waitForLibs(cb); }, 50);
  }

  var AUDIO_SRC = 'assets/ambient.mp3';
  var FFT_SIZE  = 512;
  var NUM_BANDS = 32;

  /* ══════════════════════════════════════════════════════
     AUDIO SYSTEM — lives at IIFE scope, survives transitions
     ══════════════════════════════════════════════════════ */
  var audioCtx  = null;
  var analyser  = null;
  var dataArray = null;
  var gainNode  = null;
  var lpFilter  = null;
  var audioEl   = null;
  var muted     = false;
  var started   = false;

  function setupAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.75;
    dataArray = new Uint8Array(analyser.frequencyBinCount);
    gainNode = audioCtx.createGain();
    gainNode.gain.value = 1;

    lpFilter = audioCtx.createBiquadFilter();
    lpFilter.type = 'lowpass';
    lpFilter.frequency.value = 22000;
    lpFilter.Q.value = 0.7;

    audioEl = new Audio();
    audioEl.src = AUDIO_SRC;
    audioEl.loop = true;
    audioEl.crossOrigin = 'anonymous';
    var source = audioCtx.createMediaElementSource(audioEl);
    source.connect(gainNode);
    gainNode.connect(lpFilter);
    lpFilter.connect(analyser);
    analyser.connect(audioCtx.destination);

    window.colabAudio = {
      submerge: function (dur) {
        if (!lpFilter) return;
        var d = dur || 0.8;
        gsap.to(lpFilter.frequency, { duration: d, value: 400, ease: 'power2.in' });
        gsap.to(lpFilter.Q, { duration: d, value: 3.5, ease: 'power2.in' });
      },
      surface: function (dur) {
        if (!lpFilter) return;
        var d = dur || 0.6;
        gsap.to(lpFilter.frequency, { duration: d, value: 22000, ease: 'power2.out' });
        gsap.to(lpFilter.Q, { duration: d, value: 0.7, ease: 'power2.out' });
      }
    };
  }

  function startPlayback() {
    audioCtx.resume().then(function () {
      audioEl.play().catch(function (err) { console.warn('audio play failed', err); });
    });
  }

  function setMuted(container, val) {
    muted = val;
    if (container) {
      container.setAttribute('data-muted',  muted ? 'true' : 'false');
      container.setAttribute('aria-label',  muted ? 'Audio visualizer — click to unmute' : 'Audio visualizer — click to mute');
      container.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    if (gainNode) gsap.to(gainNode.gain, { duration: 0.5, value: muted ? 0 : 1, ease: 'power2.out' });
  }

  function handleActivate(container) {
    if (!started) { setupAudio(); started = true; setMuted(container, false); startPlayback(); return; }
    setMuted(container, !muted);
    if (!muted && audioCtx.state === 'suspended') audioCtx.resume();
  }

  /* ── Bind audio triggers ──
     If the visualizer container is visible, clicking it toggles audio.
     On project pages where the visualizer is hidden, the first user
     interaction (click/scroll/key) auto-starts audio so it seamlessly
     plays even on direct page loads. */
  var audioTriggersBound = false;

  function bindAudioTriggers(container) {
    if (audioTriggersBound) return;
    audioTriggersBound = true;

    var isHidden = container.style.display === 'none' ||
                   container.getAttribute('aria-hidden') === 'true';

    /* Always bind the container for when it becomes visible again (Barba) */
    container.addEventListener('click', function () { handleActivate(container); });
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(container); }
    });

    /* If visualizer is hidden (project page direct load), auto-start on
       first user interaction anywhere on the page */
    if (isHidden) {
      var removed = false;
      function autoStart() {
        if (removed) return;
        removed = true;
        if (!started) handleActivate(container);
        document.removeEventListener('click', autoStart);
        document.removeEventListener('keydown', autoStart);
        document.removeEventListener('scroll', autoStart);
      }
      document.addEventListener('click', autoStart);
      document.addEventListener('keydown', autoStart);
      document.addEventListener('scroll', autoStart, { passive: true });
    }
  }

  /* ══════════════════════════════════════════════════════
     WEBGL VISUALIZER — only runs when container is visible
     ══════════════════════════════════════════════════════ */
  function initVisual() {
    var container = document.querySelector('[data-visualizer]');
    var canvas    = document.querySelector('[data-viz-canvas]');
    if (!container || !canvas) return;

    /* Always bind audio triggers regardless of visibility */
    bindAudioTriggers(container);

    /* If hidden, skip WebGL entirely — audio still works */
    if (container.style.display === 'none') return;

    var W = container.offsetWidth  || 255;
    var H = container.offsetHeight || 115;

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    var scene  = new THREE.Scene();
    var camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    /* Frequency data texture */
    var freqData = new Uint8Array(NUM_BANDS);
    var freqTex  = new THREE.DataTexture(freqData, NUM_BANDS, 1, THREE.LuminanceFormat);
    freqTex.minFilter = THREE.LinearFilter;
    freqTex.magFilter = THREE.LinearFilter;
    freqTex.needsUpdate = true;

    var vertShader = [
      'varying vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = vec4(position, 1.0);',
      '}'
    ].join('\n');

    /* ═══════════════════════════════════════════════════════════
       Chladni Plate Fragment Shader

       Chladni equation for a square plate:
         f(x,y) = cos(n·π·x) · cos(m·π·y) ± cos(m·π·x) · cos(n·π·y)

       Nodal lines occur where f(x,y) ≈ 0.
       Particles (sand/powder) accumulate on these lines.

       Multiple modes are superimposed, each driven by an audio band.
       The result: geometric patterns that morph in real-time with
       the music — low frequencies produce simple shapes, high
       frequencies produce intricate lattices.
       ═══════════════════════════════════════════════════════════ */

    var fragShader = [
      'precision highp float;',
      'varying vec2 vUv;',
      '',
      'uniform float uTime;',
      'uniform float uEnergy;',
      'uniform float uBass;',
      'uniform float uMid;',
      'uniform float uHigh;',
      'uniform sampler2D uFreqData;',
      'uniform vec2  uRes;',
      '',
      '/* Smoothly varying mode numbers driven by audio */',
      'uniform float uN1;',
      'uniform float uM1;',
      'uniform float uN2;',
      'uniform float uM2;',
      'uniform float uN3;',
      'uniform float uM3;',
      '',
      '#define PI 3.141592653589793',
      '',
      '/* ── Hash / noise for particle grain ── */',
      'float hash(vec2 p) {',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
      '}',
      '',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(',
      '    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),',
      '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),',
      '    f.y);',
      '}',
      '',
      '/* ── Chladni function ── */',
      'float chladni(vec2 p, float n, float m, float sign) {',
      '  return cos(n * PI * p.x) * cos(m * PI * p.y)',
      '       + sign * cos(m * PI * p.x) * cos(n * PI * p.y);',
      '}',
      '',
      '/* ── Particle density along nodal lines ── */',
      'float nodalDensity(float amplitude, float width) {',
      '  float a = abs(amplitude);',
      '  return exp(-a * a / (width * width));',
      '}',
      '',
      'void main() {',
      '  vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
      '',
      '  /* Map UV to plate coordinates [-1, 1] */',
      '  vec2 plate = (vUv - 0.5) * 2.0;',
      '',
      '  /* Subtle vibration displacement — plate is shaking */',
      '  float t = uTime;',
      '  float vib = uEnergy * 0.008;',
      '  plate += vec2(',
      '    sin(t * 23.0) * vib,',
      '    cos(t * 19.0) * vib',
      '  );',
      '',
      '  /* ═════════════════════════════════════════',
      '     MODE 1: Bass — bold simple geometry',
      '     ═════════════════════════════════════════ */',
      '',
      '  float c1a = chladni(plate, uN1, uM1, 1.0);',
      '  float c1b = chladni(plate, uN1, uM1, -1.0);',
      '  float d1  = nodalDensity(c1a, 0.18 + uBass * 0.06);',
      '  float d1b = nodalDensity(c1b, 0.22 + uBass * 0.05);',
      '  float bass_pattern = max(d1, d1b * 0.5);',
      '',
      '  /* ═════════════════════════════════════════',
      '     MODE 2: Mids — medium complexity',
      '     ═════════════════════════════════════════ */',
      '',
      '  float c2a = chladni(plate, uN2, uM2, 1.0);',
      '  float c2b = chladni(plate, uN2, uM2, -1.0);',
      '  float d2  = nodalDensity(c2a, 0.15 + uMid * 0.05);',
      '  float d2b = nodalDensity(c2b, 0.18 + uMid * 0.04);',
      '  float mid_pattern = max(d2, d2b * 0.6);',
      '',
      '  /* ═════════════════════════════════════════',
      '     MODE 3: Highs — intricate lattices',
      '     ═════════════════════════════════════════ */',
      '',
      '  float c3a = chladni(plate, uN3, uM3, 1.0);',
      '  float c3b = chladni(plate, uN3, uM3, -1.0);',
      '  float d3  = nodalDensity(c3a, 0.12 + uHigh * 0.04);',
      '  float d3b = nodalDensity(c3b, 0.14 + uHigh * 0.03);',
      '  float high_pattern = max(d3, d3b * 0.7);',
      '',
      '  /* ═════════════════════════════════════════',
      '     MODE 4: Cross-mode interference',
      '     ═════════════════════════════════════════ */',
      '',
      '  float c4 = chladni(plate, uN1, uM2, 1.0);',
      '  float d4 = nodalDensity(c4, 0.20);',
      '  float cross_pattern = d4 * 0.4;',
      '',
      '  /* ═════════════════════════════════════════',
      '     COMPOSE: Weight by audio energy per band',
      '     ═════════════════════════════════════════ */',
      '',
      '  float bassW = 0.35 + uBass * 0.5;',
      '  float midW  = 0.25 + uMid  * 0.6;',
      '  float highW = 0.15 + uHigh * 0.7;',
      '',
      '  float pattern = 0.0;',
      '  pattern += bass_pattern * bassW;',
      '  pattern += mid_pattern  * midW;',
      '  pattern += high_pattern * highW;',
      '  pattern += cross_pattern * uEnergy;',
      '  pattern = clamp(pattern, 0.0, 1.8);',
      '',
      '  /* ═════════════════════════════════════════',
      '     PARTICLE GRAIN TEXTURE',
      '     ═════════════════════════════════════════ */',
      '',
      '  vec2 grainUV = vUv * uRes;',
      '  float grain = hash(floor(grainUV * 1.5 + t * 0.3));',
      '',
      '  float particleMask = smoothstep(0.15, 0.55, pattern);',
      '',
      '  float scatter = noise(vUv * 80.0 + t * 0.2) * 0.25;',
      '  particleMask = max(particleMask, scatter * pattern);',
      '',
      '  float density = particleMask;',
      '  float grainBright = 0.6 + grain * 0.4;',
      '  density *= grainBright;',
      '  density *= (0.5 + uEnergy * 1.0);',
      '',
      '  /* ═════════════════════════════════════════',
      '     NODAL LINE GLOW',
      '     ═════════════════════════════════════════ */',
      '',
      '  float glow = smoothstep(0.05, 0.45, pattern);',
      '  glow *= 0.3 * (0.4 + uEnergy * 0.6);',
      '',
      '  /* ═════════════════════════════════════════',
      '     COLOUR — Globe ice-blue on black plate',
      '     ═════════════════════════════════════════ */',
      '',
      '  vec3 particleCol = vec3(0.7, 0.85, 1.0);',
      '  vec3 glowCol     = vec3(0.45, 0.65, 0.90);',
      '',
      '  vec3 col = vec3(0.0);',
      '  col += particleCol * density;',
      '  col += glowCol * glow;',
      '  col += vec3(1.0) * pow(max(density, 0.0), 3.0) * 0.25;',
      '',
      '  /* Subtle edge vignette */',
      '  float vignette = 1.0 - smoothstep(0.7, 1.05, length(plate));',
      '  col *= vignette;',
      '',
      '  float alpha = clamp((density + glow) * 1.4, 0.0, 1.0) * vignette;',
      '',
      '  gl_FragColor = vec4(col, alpha);',
      '}'
    ].join('\n');

    var uniforms = {
      uTime:     { value: 0 },
      uEnergy:   { value: 0 },
      uBass:     { value: 0 },
      uMid:      { value: 0 },
      uHigh:     { value: 0 },
      uFreqData: { value: freqTex },
      uRes:      { value: new THREE.Vector2(W, H) },
      /* Chladni mode numbers — driven by audio in the render loop */
      uN1: { value: 2.0 },
      uM1: { value: 3.0 },
      uN2: { value: 4.0 },
      uM2: { value: 5.0 },
      uN3: { value: 6.0 },
      uM3: { value: 7.0 },
    };

    var mat = new THREE.ShaderMaterial({
      vertexShader:   vertShader,
      fragmentShader: fragShader,
      uniforms:       uniforms,
      transparent:    true,
      depthWrite:     false,
    });

    var quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    scene.add(quad);

    /* ══════════════════════════════════════════════════════
       MODE DRIVER
       Maps audio bands → Chladni mode numbers (n, m).
       Transient/beat detection triggers discrete mode jumps
       for volatile, real-time reshaping.
       ══════════════════════════════════════════════════════ */

    var targetN1 = 2, targetM1 = 3;
    var targetN2 = 4, targetM2 = 5;
    var targetN3 = 6, targetM3 = 7;

    var curN1 = 2, curM1 = 3;
    var curN2 = 4, curM2 = 5;
    var curN3 = 6, curM3 = 7;

    var bassModes = [
      [1, 2], [2, 3], [1, 3], [2, 1], [3, 2], [3, 1],
      [1, 4], [2, 4], [3, 3], [4, 1]
    ];
    var midModes = [
      [3, 5], [4, 5], [3, 7], [5, 4], [4, 7], [5, 3],
      [5, 6], [4, 6], [6, 4], [3, 6]
    ];
    var highModes = [
      [5, 8], [6, 7], [7, 9], [8, 5], [7, 6], [9, 7],
      [6, 9], [8, 7], [5, 9], [7, 8]
    ];

    var prevBass = 0, prevMid = 0, prevHigh = 0;
    var modeTimer = 0;
    var MODE_COOLDOWN = 0.12;

    function pickMode(modes, energy) {
      var idx = Math.floor(energy * (modes.length - 1));
      idx = Math.max(0, Math.min(modes.length - 1, idx));
      return modes[idx];
    }

    /* ── Render loop ── */
    var clock = new THREE.Clock();
    var sEnergy = 0, sBass = 0, sMid = 0, sHigh = 0;
    var fBass = 0, fMid = 0, fHigh = 0;

    function animate() {
      requestAnimationFrame(animate);
      var dt = clock.getDelta();
      var t  = clock.getElapsedTime();
      var audioActive = analyser && started && !muted && dataArray;

      if (audioActive) {
        analyser.getByteFrequencyData(dataArray);

        var binsPer = Math.floor(dataArray.length / NUM_BANDS);
        var total = 0, bass = 0, mid = 0, high = 0;
        for (var b = 0; b < NUM_BANDS; b++) {
          var sum = 0;
          for (var j = 0; j < binsPer; j++) sum += dataArray[b * binsPer + j];
          var avg = sum / binsPer;
          freqData[b] = Math.floor(avg);
          total += avg;
          if (b < 8)       bass += avg;
          else if (b < 20) mid  += avg;
          else              high += avg;
        }

        sEnergy += (total / (NUM_BANDS * 255) - sEnergy) * 0.18;
        sBass   += (bass  / (8 * 255)  - sBass)  * 0.22;
        sMid    += (mid   / (12 * 255) - sMid)   * 0.20;
        sHigh   += (high  / (12 * 255) - sHigh)  * 0.18;

        var rawBass = bass / (8 * 255);
        var rawMid  = mid  / (12 * 255);
        var rawHigh = high / (12 * 255);
        fBass += (rawBass - fBass) * 0.45;
        fMid  += (rawMid  - fMid)  * 0.40;
        fHigh += (rawHigh - fHigh) * 0.35;

        /* Beat detection → mode jumps */
        modeTimer -= dt;
        var bassHit = (fBass - prevBass) > 0.06;
        var midHit  = (fMid  - prevMid)  > 0.05;
        var highHit = (fHigh - prevHigh) > 0.04;

        if (modeTimer <= 0 && (bassHit || midHit || highHit)) {
          modeTimer = MODE_COOLDOWN;

          if (bassHit) {
            var bm = pickMode(bassModes, fBass);
            targetN1 = bm[0]; targetM1 = bm[1];
          }
          if (midHit) {
            var mm = pickMode(midModes, fMid);
            targetN2 = mm[0]; targetM2 = mm[1];
          }
          if (highHit) {
            var hm = pickMode(highModes, fHigh);
            targetN3 = hm[0]; targetM3 = hm[1];
          }
        }

        prevBass = fBass;
        prevMid  = fMid;
        prevHigh = fHigh;

      } else {
        var idle = 0.08 + Math.sin(t * 0.4) * 0.04;
        sEnergy += (idle - sEnergy) * 0.04;
        sBass   += (idle * 0.7 - sBass) * 0.04;
        sMid    += (idle * 0.5 - sMid) * 0.04;
        sHigh   += (idle * 0.3 - sHigh) * 0.04;
        for (var b2 = 0; b2 < NUM_BANDS; b2++) {
          freqData[b2] = Math.floor(freqData[b2] * 0.96);
        }

        var idleIdx = Math.floor(t * 0.15) % bassModes.length;
        targetN1 = bassModes[idleIdx][0];
        targetM1 = bassModes[idleIdx][1];
        var midIdx = Math.floor(t * 0.12) % midModes.length;
        targetN2 = midModes[midIdx][0];
        targetM2 = midModes[midIdx][1];
      }

      /* Fast mode interpolation for volatile reshaping */
      var modeLerp = 1.0 - Math.pow(0.02, dt);
      curN1 += (targetN1 - curN1) * modeLerp;
      curM1 += (targetM1 - curM1) * modeLerp;
      curN2 += (targetN2 - curN2) * modeLerp;
      curM2 += (targetM2 - curM2) * modeLerp;
      curN3 += (targetN3 - curN3) * modeLerp;
      curM3 += (targetM3 - curM3) * modeLerp;

      freqTex.needsUpdate    = true;
      uniforms.uTime.value   = t;
      uniforms.uEnergy.value = sEnergy;
      uniforms.uBass.value   = sBass;
      uniforms.uMid.value    = sMid;
      uniforms.uHigh.value   = sHigh;
      uniforms.uN1.value     = curN1;
      uniforms.uM1.value     = curM1;
      uniforms.uN2.value     = curN2;
      uniforms.uM2.value     = curM2;
      uniforms.uN3.value     = curN3;
      uniforms.uM3.value     = curM3;

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function () {
      var nW = container.offsetWidth;
      var nH = container.offsetHeight;
      uniforms.uRes.value.set(nW, nH);
      renderer.setSize(nW, nH);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    waitForLibs(initVisual);
  });

}());
