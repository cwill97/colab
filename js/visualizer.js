/**
 * co:lab — Cymatics Visualizer v3
 * Water-surface cymatics pattern via WebGL shader.
 * Uses cellular noise modulated by concentric standing waves
 * to recreate the look of real cymatics: thin bright ring
 * outlines with complex fluid caustic shapes between them.
 * Audio-reactive, click to play/mute.
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

  function init() {
    var container = document.querySelector('[data-visualizer]');
    var canvas    = document.querySelector('[data-viz-canvas]');
    if (!container || !canvas) return;
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

    var fragShader = [
      'precision highp float;',
      'varying vec2 vUv;',
      'uniform float uTime;',
      'uniform float uEnergy;',
      'uniform float uBass;',
      'uniform float uMid;',
      'uniform float uHigh;',
      'uniform sampler2D uFreqData;',
      'uniform vec2 uRes;',
      '',
      '/* ── Random & noise ── */',
      'vec2 hash2(vec2 p) {',
      '  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));',
      '  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;',
      '}',
      '',
      'float hash(vec2 p) {',
      '  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);',
      '}',
      '',
      'float noise(vec2 p) {',
      '  vec2 i = floor(p);',
      '  vec2 f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(',
      '    mix(hash(i), hash(i + vec2(1,0)), f.x),',
      '    mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),',
      '    f.y);',
      '}',
      '',
      '/* ── Voronoi — creates the cellular water shapes ── */',
      'float voronoi(vec2 p) {',
      '  vec2 n = floor(p);',
      '  vec2 f = fract(p);',
      '  float md = 8.0;',
      '  for (int j = -1; j <= 1; j++) {',
      '    for (int i = -1; i <= 1; i++) {',
      '      vec2 g = vec2(float(i), float(j));',
      '      vec2 o = hash2(n + g) * 0.5 + 0.5;',
      '      vec2 r = g + o - f;',
      '      float d = dot(r, r);',
      '      md = min(md, d);',
      '    }',
      '  }',
      '  return sqrt(md);',
      '}',
      '',
      '/* ── Voronoi edges (second-closest minus closest) ── */',
      'float voronoiEdge(vec2 p) {',
      '  vec2 n = floor(p);',
      '  vec2 f = fract(p);',
      '  float d1 = 8.0;',
      '  float d2 = 8.0;',
      '  for (int j = -2; j <= 2; j++) {',
      '    for (int i = -2; i <= 2; i++) {',
      '      vec2 g = vec2(float(i), float(j));',
      '      vec2 o = hash2(n + g) * 0.5 + 0.5;',
      '      vec2 r = g + o - f;',
      '      float d = dot(r, r);',
      '      if (d < d1) { d2 = d1; d1 = d; }',
      '      else if (d < d2) { d2 = d; }',
      '    }',
      '  }',
      '  return d2 - d1;',
      '}',
      '',
      'float fbm(vec2 p) {',
      '  float v = 0.0; float a = 0.5;',
      '  for (int i = 0; i < 4; i++) {',
      '    v += a * noise(p);',
      '    p *= 2.1; a *= 0.5;',
      '  }',
      '  return v;',
      '}',
      '',
      'void main() {',
      '  vec2 asp = vec2(uRes.x / uRes.y, 1.0);',
      '  vec2 uv  = (vUv - 0.5) * 2.0 * asp;',
      '  float r  = length(uv);',
      '  float a  = atan(uv.y, uv.x);',
      '',
      '  /* No disc boundary — fill entire container */',
      '  float dR = length(asp);',
      '  float rn = r / dR;',
      '  float t  = uTime;',
      '',
      '  /* Freq lookup */',
      '  float fv = texture2D(uFreqData, vec2(rn, 0.5)).r;',
      '',
      '  /* ═══════════════════════════════════════════════',
      '     LAYER 1 : Concentric ring structure (thin outlines)',
      '     Standing wave rings — sharp edges, not smooth sine bands',
      '     ═══════════════════════════════════════════════ */',
      '',
      '  /* Subtle angular warp for organic ring shapes */',
      '  float aw = 0.0;',
      '  aw += sin(a * 7.0  + r * 10.0 + t * 0.08) * 0.008;',
      '  aw += sin(a * 11.0 - r * 14.0 + t * 0.06) * 0.006;',
      '  aw += sin(a * 17.0 + r * 18.0 - t * 0.10) * 0.004;',
      '  aw += uBass * sin(a * 5.0 + r * 8.0 + t * 0.2) * 0.012;',
      '',
      '  float rW = r + aw;',
      '',
      '  /* Multiple ring frequencies — use abs(sin) for thin bright lines */',
      '  float ringF1 = 28.0 + uEnergy * 5.0;',
      '  float ringF2 = 42.0 + uBass * 4.0;',
      '  float ringF3 = 60.0 + uMid * 6.0;',
      '',
      '  /* abs(sin) gives thin bright lines at zero crossings */',
      '  float ring1 = 1.0 - smoothstep(0.0, 0.12, abs(sin(rW * ringF1 - t * 0.4)));',
      '  float ring2 = 1.0 - smoothstep(0.0, 0.10, abs(sin(rW * ringF2 + t * 0.25)));',
      '  float ring3 = 1.0 - smoothstep(0.0, 0.08, abs(sin(rW * ringF3 - t * 0.6)));',
      '',
      '  float rings = ring1 * 0.5 + ring2 * 0.35 + ring3 * 0.25;',
      '',
      '  /* ═══════════════════════════════════════════════',
      '     LAYER 2 : Cellular water-surface caustics',
      '     Voronoi cells that sit between/on the rings',
      '     ═══════════════════════════════════════════════ */',
      '',
      '  /* Warp voronoi coords with radial + noise for fluid look */',
      '  vec2 vUv1 = uv * 5.0 + vec2(t * 0.04, -t * 0.03);',
      '  float nw1 = noise(uv * 3.0 + t * 0.05);',
      '  float nw2 = noise(uv * 4.0 - t * 0.04);',
      '  vUv1 += vec2(nw1, nw2) * 0.4;',
      '',
      '  /* Cell edges — these are the bright caustic lines */',
      '  float ve1 = voronoiEdge(vUv1);',
      '  float caustic1 = 1.0 - smoothstep(0.0, 0.08, ve1);',
      '',
      '  /* Second scale of cells — finer detail */',
      '  vec2 vUv2 = uv * 9.0 + vec2(-t * 0.03, t * 0.05);',
      '  vUv2 += vec2(nw2, nw1) * 0.3;',
      '  float ve2 = voronoiEdge(vUv2);',
      '  float caustic2 = 1.0 - smoothstep(0.0, 0.06, ve2);',
      '',
      '  /* Third scale — finest */',
      '  vec2 vUv3 = uv * 14.0 + vec2(t * 0.02, t * 0.02);',
      '  vUv3 += vec2(nw1 * 0.5, nw2 * 0.5) * 0.2;',
      '  float ve3 = voronoiEdge(vUv3);',
      '  float caustic3 = 1.0 - smoothstep(0.0, 0.05, ve3);',
      '',
      '  float caustics = caustic1 * 0.45 + caustic2 * 0.35 + caustic3 * 0.2;',
      '',
      '  /* Modulate caustics with radial standing wave — */',
      '  /* caustics are brighter on the ring positions, dimmer between */',
      '  float ringMask = (sin(rW * ringF1 * 0.5) * 0.5 + 0.5);',
      '  ringMask = 0.4 + ringMask * 0.6;',
      '  caustics *= ringMask;',
      '',
      '  /* Audio boosts caustic visibility */',
      '  caustics *= (0.5 + uEnergy * 0.8);',
      '',
      '  /* ═══════════════════════════════════════════════',
      '     LAYER 3 : Fluid surface noise (soft diffuse glow)',
      '     ═══════════════════════════════════════════════ */',
      '',
      '  float fluid = fbm(uv * 4.0 + t * 0.06);',
      '  float fluid2 = fbm(uv * 6.0 - t * 0.05);',
      '  float fluidPattern = fluid * fluid2;',
      '  fluidPattern = pow(fluidPattern, 0.8) * 0.8;',
      '  fluidPattern *= (0.3 + uEnergy * 0.4);',
      '',
      '  /* ═══════════════════════════════════════════════',
      '     LAYER 4 : Centre glow',
      '     ═══════════════════════════════════════════════ */',
      '',
      '  float core = exp(-r * r * 4.0) * (0.5 + uBass * 0.5);',
      '  /* Tighter inner glow */',
      '  float innerCore = exp(-r * r * 16.0) * (0.3 + uEnergy * 0.3);',
      '',
      '  /* ═══════════════════════════════════════════════',
      '     COMPOSE',
      '     ═══════════════════════════════════════════════ */',
      '',
      '  float bright = 0.0;',
      '  bright += rings * 0.35;',
      '  bright += caustics * 0.40;',
      '  bright += fluidPattern * 0.15;',
      '  bright += core;',
      '  bright += innerCore;',
      '',
      '  /* Freq-reactive radial boost */',
      '  bright += fv * 0.10;',
      '',
      '  /* ── Radial falloff — denser centre, sparser edges ── */',
      '  /* like the reference: bright complex centre, fading outward */',
      '  float radialFade = 1.0 - pow(rn, 2.0) * 0.4;',
      '  bright *= radialFade;',
      '',
      '  /* ── Colour — cool blue-white ── */',
      '  vec3 col = vec3(0.65, 0.78, 1.0) * bright;',
      '  /* Push bright peaks toward white */',
      '  col += vec3(1.0) * pow(max(bright, 0.0), 3.5) * 0.45;',
      '',
      '  /* Subtle warm tint in bright caustic intersections */',
      '  col.r += pow(max(caustics, 0.0), 2.0) * 0.06;',
      '',
      '  /* Edge softening */',
      '  float edgeFade = 1.0 - smoothstep(0.85, 1.0, rn);',
      '  col *= edgeFade;',
      '  float alpha = clamp(bright * 1.3, 0.0, 1.0) * edgeFade;',
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

    /* ── Audio ── */
    var audioCtx  = null;
    var analyser  = null;
    var dataArray = null;
    var gainNode  = null;
    var audioEl   = null;
    var muted     = false;
    var started   = false;

    function setupAudio() {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.82;
      dataArray = new Uint8Array(analyser.frequencyBinCount);
      gainNode = audioCtx.createGain();
      gainNode.gain.value = 1;
      audioEl = new Audio();
      audioEl.src = AUDIO_SRC;
      audioEl.loop = true;
      audioEl.crossOrigin = 'anonymous';
      var source = audioCtx.createMediaElementSource(audioEl);
      source.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(audioCtx.destination);
    }

    function startPlayback() {
      audioCtx.resume().then(function () {
        audioEl.play().catch(function (err) { console.warn('audio play failed', err); });
      });
    }

    function setMuted(val) {
      muted = val;
      container.setAttribute('data-muted',  muted ? 'true' : 'false');
      container.setAttribute('aria-label',  muted ? 'Audio visualizer — click to unmute' : 'Audio visualizer — click to mute');
      container.setAttribute('aria-pressed', muted ? 'true' : 'false');
      if (gainNode) gsap.to(gainNode.gain, { duration: 0.5, value: muted ? 0 : 1, ease: 'power2.out' });
    }

    function handleActivate() {
      if (!started) { setupAudio(); started = true; setMuted(false); startPlayback(); return; }
      setMuted(!muted);
      if (!muted && audioCtx.state === 'suspended') audioCtx.resume();
    }

    container.addEventListener('click', handleActivate);
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(); }
    });

    /* ── Render loop ── */
    var clock = new THREE.Clock();
    var sEnergy = 0, sBass = 0, sMid = 0, sHigh = 0;

    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
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
        sEnergy += (total / (NUM_BANDS * 255) - sEnergy) * 0.15;
        sBass   += (bass  / (8 * 255)  - sBass)  * 0.18;
        sMid    += (mid   / (12 * 255) - sMid)   * 0.15;
        sHigh   += (high  / (12 * 255) - sHigh)  * 0.12;
      } else {
        var idle = 0.06 + Math.sin(t * 0.4) * 0.03;
        sEnergy += (idle - sEnergy) * 0.04;
        sBass   += (idle * 0.8 - sBass) * 0.04;
        sMid    += (idle * 0.5 - sMid) * 0.04;
        sHigh   += (idle * 0.3 - sHigh) * 0.04;
        for (var b2 = 0; b2 < NUM_BANDS; b2++) {
          freqData[b2] = Math.floor(freqData[b2] * 0.96);
        }
      }

      freqTex.needsUpdate    = true;
      uniforms.uTime.value   = t;
      uniforms.uEnergy.value = sEnergy;
      uniforms.uBass.value   = sBass;
      uniforms.uMid.value    = sMid;
      uniforms.uHigh.value   = sHigh;

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
    waitForLibs(init);
  });

}());
