

(function () {
  'use strict';

  function waitForLibs(cb) {
    if (typeof THREE !== 'undefined' && typeof gsap !== 'undefined') cb();
    else setTimeout(function () { waitForLibs(cb); }, 50);
  }

  /* Default site-wide ambient bed; the about page swaps in its own track
     via colabAudio.setTrack() (see barba-init.js + cold-load resolver
     below). */
  var DEFAULT_AUDIO_SRC = '/https://cdn.sanity.io/files/7to0u5h2/production/4769413ecca28b29e51841e6ea8d9010af78cf76.mp3';
  var ABOUT_AUDIO_SRC   = '/https://cdn.sanity.io/files/7to0u5h2/production/170e7c6ab04584728757f5ccb7c69e579e4acc4d.mp3';
  var AUDIO_SRC = (document.body && document.body.classList.contains('about-page'))
    ? ABOUT_AUDIO_SRC
    : DEFAULT_AUDIO_SRC;
  var FFT_SIZE  = 512;
  var NUM_BANDS = 32;

  /* Master gain for the ambient track.
     Halved from the previous 0.5 → 0.25 to soften the default
     volume and keep peaks well below clipping. Single source of
     truth so initial state and every mute→unmute toggle land on
     the same value (prevents the old 0.1→0.5 jump). */
  var VOLUME = 0.21;

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
    gainNode.gain.value = VOLUME;       /* master volume — see VOLUME const */

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
  }

  /* Module-scope colabAudio so setTrack() works whether or not the
     user has activated audio yet. submerge/surface no-op until
     setupAudio() runs and lpFilter exists. */
  window.colabAudio = {
    setTrack: function (src) {
      if (!src || src === AUDIO_SRC) return;
      AUDIO_SRC = src;
      if (audioEl) {
        var resume = started && !muted && !audioEl.paused;
        try { audioEl.src = src; audioEl.load(); } catch (e) {}
        if (resume) audioEl.play().catch(function () {});
      }
    },
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

  function startPlayback() {
    audioCtx.resume().then(function () {
      audioEl.play().catch(function (err) { console.warn('audio play failed', err); });
    });
  }

  /* ── Audio toggle element (bottom-right on project page) ── */
  var audioToggle = null;
  var audioLabel  = null;
  var stateRevealTimer = null;

  function syncToggle() {
    if (!audioToggle) {
      audioToggle = document.querySelector('[data-audio-toggle]');
      audioLabel  = document.querySelector('[data-audio-label]');
    }
    if (!audioToggle) return;
    var playing = started && !muted;
    audioToggle.classList.toggle('is-playing', playing);
    if (audioLabel) audioLabel.textContent = playing ? 'Sound On' : 'Sound Off';
    audioToggle.setAttribute('aria-label', playing ? 'Toggle audio — on' : 'Toggle audio — off');
  }

  /* Briefly fade the "Sound On/Off" label in after a state change so the
     user can read the new state, then fade it back out. The label is
     hidden at rest — only hover or this transient reveal shows it. */
  function flashStateLabel() {
    if (!audioToggle) audioToggle = document.querySelector('[data-audio-toggle]');
    if (!audioToggle) return;
    audioToggle.classList.add('is-state-reveal');
    if (stateRevealTimer) clearTimeout(stateRevealTimer);
    stateRevealTimer = setTimeout(function () {
      audioToggle.classList.remove('is-state-reveal');
      stateRevealTimer = null;
    }, 1200);
  }

  function setMuted(container, val) {
    muted = val;
    if (container) {
      container.setAttribute('data-muted',  muted ? 'true' : 'false');
      container.setAttribute('aria-label',  muted ? 'Audio visualizer — click to unmute' : 'Audio visualizer — click to mute');
      container.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }
    if (gainNode) gsap.to(gainNode.gain, { duration: 0.5, value: muted ? 0 : VOLUME, ease: 'power2.out', overwrite: true });
    syncToggle();
  }

  function handleActivate(container) {
    if (!started) { setupAudio(); started = true; setMuted(container, false); startPlayback(); return; }
    setMuted(container, !muted);
    if (!muted && audioCtx.state === 'suspended') audioCtx.resume();
  }

  /* ── Bind audio triggers ──
     Visualizer container toggles audio on homepage.
     Audio toggle button (bottom-right) toggles on project page.
     On direct project page loads with no toggle click yet, first
     user interaction auto-starts audio. */
  var audioTriggersBound = false;

  function bindAudioTriggers(container) {
    if (audioTriggersBound) return;
    audioTriggersBound = true;

    /* Always bind the visualizer container */
    container.addEventListener('click', function () { handleActivate(container); });
    container.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(container); }
    });

    /* Bind the audio toggle button */
    var toggle = document.querySelector('[data-audio-toggle]');
    if (toggle) {
      toggle.addEventListener('click', function () { handleActivate(container); flashStateLabel(); });
      toggle.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleActivate(container); flashStateLabel(); }
      });
    }

    /* Initial sync */
    syncToggle();
  }

  /* ══════════════════════════════════════════════════════
     TAB VISIBILITY — pause audio when user leaves the tab
     ══════════════════════════════════════════════════════ */
  document.addEventListener('visibilitychange', function () {
    if (!started || !audioEl) return;
    if (document.hidden) {
      audioEl.pause();
    } else {
      if (!muted) {
        audioEl.play().catch(function () {});
      }
    }
  });

  /* ══════════════════════════════════════════════════════
     WEBGL VISUALIZER — only runs when container is visible
     ══════════════════════════════════════════════════════ */
  function initVisual() {
    var container = document.querySelector('[data-visualizer]');
    var canvas    = document.querySelector('[data-viz-canvas]');
    if (!container || !canvas) return;

    /* Always bind audio triggers regardless of visibility */
    bindAudioTriggers(container);

    /* If hidden (mobile CSS), skip WebGL entirely — audio still works */
    if (container.style.display === 'none') return;

    var W = container.offsetWidth  || 255;
    var H = container.offsetHeight || 115;

    /* antialias: false — we want crisp square points, not AA'd soft circles */
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, alpha: true });

    /* Pixel-ratio for the canvas backing store, capped at 4 to bound
       memory use on very high-DPR displays. */
    function getPixelRatio() {
      return Math.min(window.devicePixelRatio || 1, 4);
    }
    var pr = getPixelRatio();
    renderer.setPixelRatio(pr);
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(22, W / H, 0.1, 100);
    /* Slight downward tilt (~18°) to match the reference's elevated look-down */
    camera.position.set(0, 0.95, 3.0);
    camera.lookAt(0, 0.08, 0);

    /* ══════════════════════════════════════════════════════
       PARTICLE DOME
       48 concentric rings in the xz-plane. Points-per-ring
       scales with circumference so dot density stays roughly
       uniform — sparse center, dense brim, matching the ref.
       Each particle stores its ring index so we can look up
       the ring's audio-driven height every frame.
       ══════════════════════════════════════════════════════ */
    var NUM_RINGS            = 30;
    var MIN_R                = 0.06;
    var MAX_R                = 0.9;
    var POINTS_PER_UNIT_CIRC = 21;   /* density — higher = closer to ref's fine-dust look */
    var MIN_RING_POINTS      = 18;   /* floor so the inner hump has body, not 8 lonely dots */

    var posList = [];
    var ringIdx = [];   /* ring-index per particle — parallel to posList/3 */
    for (var r = 0; r < NUM_RINGS; r++) {
      var tRing  = r / (NUM_RINGS - 1);
      var radius = MIN_R + tRing * (MAX_R - MIN_R);
      var circ   = 2 * Math.PI * radius;
      var n      = Math.max(MIN_RING_POINTS, Math.round(circ * POINTS_PER_UNIT_CIRC));
      /* Golden-angle-ish offset per ring so adjacent rings don't form
         obvious radial spokes when viewed head-on. */
      var angleOffset = r * 0.393;
      for (var i = 0; i < n; i++) {
        var a = angleOffset + (i / n) * Math.PI * 2;
        posList.push(Math.cos(a) * radius, 0, Math.sin(a) * radius);
        ringIdx.push(r);
      }
    }

    var positions = new Float32Array(posList);
    var geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    var mat = new THREE.PointsMaterial({
      color:            0xffffff,
      size:             0.06 * pr,  /* ~1.4 CSS px dots — crisp, not chunky */
      sizeAttenuation:  false
    });

    var points = new THREE.Points(geom, mat);
    scene.add(points);

    /* ══════════════════════════════════════════════════════
       RING-HEIGHT STATE
       Targets are recomputed every frame from FFT; heights
       lerp toward targets with asymmetric attack/release so
       the motion feels like a real spectrum analyser.
       ══════════════════════════════════════════════════════ */
    var ringHeights = new Float32Array(NUM_RINGS);
    var ringTargets = new Float32Array(NUM_RINGS);

    var HEIGHT_SCALE = 0.30;  /* world-units per normalised amplitude */

    var clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      var t = clock.getElapsedTime();
      var audioActive = analyser && started && !muted && dataArray;

      if (audioActive) {
        analyser.getByteFrequencyData(dataArray);
        /* Ring → FFT bin via power curve. Inner rings grab the low bass
           bins aggressively; outer rings spread into the mids. Cap at
           bin 56 (~4.8kHz at 44.1kHz sample rate) — above that, bins
           are mostly noise floor and don't add visual interest. */
        for (var r2 = 0; r2 < NUM_RINGS; r2++) {
          var ratio = r2 / (NUM_RINGS - 1);
          var bin   = Math.floor(Math.pow(ratio, 1.6) * 21);
          if (bin >= dataArray.length) bin = dataArray.length - 1;
          var v = dataArray[bin] / 255;
          /* Inner-boost — exaggerates the bass-driven center hump,
             which is the defining feature of the reference look. */
          var innerBoost = 1 + (1 - ratio) * 0.9;
          ringTargets[r2] = v * innerBoost;
        }
      } else {
        /* Idle breathing — gentle radial mound + slow sine wobble so
           the visualizer still reads as alive when muted. */
        for (var r3 = 0; r3 < NUM_RINGS; r3++) {
          var ratio2  = r3 / (NUM_RINGS - 1);
          var baseline = (1 - ratio2) * 0.28;
          var wobble   = Math.sin(ratio2 * 3.2 + t * 0.7) * 0.06 * (1 - ratio2);
          ringTargets[r3] = baseline + wobble;
        }
      }

      /* Asymmetric smoothing — fast rise (peak response), slow fall
         (afterglow). Feels closer to an analog VU than symmetric lerp. */
      for (var r4 = 0; r4 < NUM_RINGS; r4++) {
        var diff = ringTargets[r4] - ringHeights[r4];
        ringHeights[r4] += diff * (diff > 0 ? 0.28 : 0.12);
      }

      /* Push heights into the position buffer. Only Y changes per frame;
         X/Z were set once at build time and stay fixed. */
      var pos = geom.attributes.position.array;
      for (var i2 = 0; i2 < ringIdx.length; i2++) {
        pos[i2 * 3 + 1] = ringHeights[ringIdx[i2]] * HEIGHT_SCALE;
      }
      geom.attributes.position.needsUpdate = true;

      /* Slow auto-spin around Y — ~52s per full rotation */
      points.rotation.y = t * 0.12;

      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', function () {
      var nW = container.offsetWidth;
      var nH = container.offsetHeight;
      /* Re-read zoom on every resize — scale.js updates it continuously.
         Without this, rotating between viewport sizes leaves the buffer
         under- or over-allocated and dots go chunky again. */
      var newPr = getPixelRatio();
      if (renderer.getPixelRatio() !== newPr) {
        renderer.setPixelRatio(newPr);
        mat.size = 0.6 * newPr;
      }
      renderer.setSize(nW, nH);
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    waitForLibs(initVisual);
  });

}());
