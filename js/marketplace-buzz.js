/**
 * co:lab — Marketplace "broken signal" buzz
 *
 * Inactive nav items (e.g. Marketplace (SOON)) get a press-time
 * one-shot CSS shake + a synthesized error buzz played through Web
 * Audio. Hover styling is pure CSS; this file handles the press
 * animation trigger and the audio.
 *
 * Audio gating mirrors hover-sfx.js:
 *   - Desktop hover-pointer for the ambient hum on hover (CSS-only)
 *   - Press always fires (works on touch + click)
 *   - Sound only plays when the user has clicked Sound On
 *     ([data-audio-toggle].is-playing). Silent otherwise.
 *
 * Engine:
 *   Web Audio synthesizer — no asset shipped. A square-wave
 *   oscillator (~150→90Hz sweep) modulated by a 28Hz LFO, layered
 *   with a brief filtered noise burst for the "click" attack.
 */

(function () {
  'use strict';

  var BUZZ_CLASS     = 'is-buzzing';
  var BUZZ_DURATION  = 600;   // must match css animation length (0.6s trio)
  var MIN_AUDIO_INTERVAL = 120;  // ms between audio plays — kills double-tap stacking
  var MIN_HOVER_INTERVAL = 350;  // ms between hover-fires — slow re-entry spam

  /* ── Web Audio singleton ───────────────────────────────────────── */
  var ctx = null;
  var lastPlayAt  = 0;
  var lastHoverAt = 0;

  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { return null; }
    return ctx;
  }

  function audioEnabled() {
    var toggle = document.querySelector('[data-audio-toggle]');
    return !!(toggle && toggle.classList.contains('is-playing'));
  }

  /* ── The buzz itself ───────────────────────────────────────────── */
  function playBuzz() {
    if (!audioEnabled()) return;
    var now = performance.now();
    if (now - lastPlayAt < MIN_AUDIO_INTERVAL) return;
    lastPlayAt = now;

    var c = getCtx();
    if (!c) return;

    var resumeAndPlay = function () {
      var t0 = c.currentTime;
      var dur = 0.32;

      /* Square buzz — pitch sags from 150→90Hz to feel "wrong" */
      var osc = c.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(150, t0);
      osc.frequency.exponentialRampToValueAtTime(90, t0 + dur);

      var oscGain = c.createGain();
      oscGain.gain.setValueAtTime(0.0001, t0);
      oscGain.gain.exponentialRampToValueAtTime(0.11, t0 + 0.005);
      oscGain.gain.setValueAtTime(0.11, t0 + dur - 0.05);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      /* AM modulator — 28Hz tremolo gives the classic error rasp */
      var lfo = c.createOscillator();
      lfo.frequency.value = 28;
      var lfoGain = c.createGain();
      lfoGain.gain.value = 0.09;
      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);

      /* Lowpass to round the high harmonics */
      var lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1800;
      lp.Q.value = 0.6;

      osc.connect(oscGain).connect(lp).connect(c.destination);

      /* Noise click — 25ms filtered white noise for the attack snap */
      var noiseDur = 0.04;
      var noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * noiseDur), c.sampleRate);
      var data = noiseBuf.getChannelData(0);
      for (var i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
      }
      var noise = c.createBufferSource();
      noise.buffer = noiseBuf;
      var noiseGain = c.createGain();
      noiseGain.gain.value = 0.09;
      var noiseHP = c.createBiquadFilter();
      noiseHP.type = 'highpass';
      noiseHP.frequency.value = 600;
      noise.connect(noiseHP).connect(noiseGain).connect(c.destination);

      osc.start(t0);
      lfo.start(t0);
      noise.start(t0);
      osc.stop(t0 + dur + 0.02);
      lfo.stop(t0 + dur + 0.02);
      noise.stop(t0 + noiseDur + 0.02);
    };

    if (c.state === 'suspended' && typeof c.resume === 'function') {
      c.resume().then(resumeAndPlay, function () { /* ignore */ });
    } else {
      resumeAndPlay();
    }
  }

  /* ── CSS glitch trigger ───────────────────────────────────────── */
  function flashBuzz(link) {
    if (!link) return;
    /* Restart the animation by removing + reflow + adding */
    link.classList.remove(BUZZ_CLASS);
    /* eslint-disable-next-line no-unused-expressions */
    link.offsetWidth;
    link.classList.add(BUZZ_CLASS);
    window.setTimeout(function () {
      link.classList.remove(BUZZ_CLASS);
    }, BUZZ_DURATION);
  }

  /* ── Per-item binding ─────────────────────────────────────────── */
  function bindItem(li) {
    if (li.hasAttribute('data-buzz-init')) return;
    li.setAttribute('data-buzz-init', '');

    var link = li.querySelector('.menu-nav-link.is-inactive');

    /* Hover — visual glitch only, throttled so re-entry spam doesn't
       restart the animation every frame. Silent on hover by design. */
    li.addEventListener('mouseenter', function () {
      var now = performance.now();
      if (now - lastHoverAt < MIN_HOVER_INTERVAL) return;
      lastHoverAt = now;
      flashBuzz(link);
    });

    /* Press — same visual glitch + audio. mousedown covers desktop;
       touchstart covers mobile tap. click is omitted to avoid a
       double trigger after touchstart. */
    var firePress = function () {
      flashBuzz(link);
      playBuzz();
    };
    li.addEventListener('mousedown', firePress);
    li.addEventListener('touchstart', firePress, { passive: true });
  }

  function init() {
    var items = document.querySelectorAll('.menu-nav-item.is-inactive');
    Array.prototype.forEach.call(items, bindItem);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  /* Re-init after Barba transitions — the menu chrome is persistent
     so existing bindings survive, but be safe in case the DOM is
     replaced for any reason. */
  function hookBarba(attempts) {
    if (typeof window.barba !== 'undefined' && window.barba.hooks) {
      window.barba.hooks.afterEnter(function () { init(); });
      return;
    }
    if (attempts > 100) return;
    setTimeout(function () { hookBarba((attempts || 0) + 1); }, 100);
  }
  hookBarba(0);

}());
