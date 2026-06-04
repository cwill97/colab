

(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────
  var SFX_SRC       = '/sanity/files/7to0u5h2/production/331f365e328f2a0bd8c0eed13fec01b344a09d38.mp3';
  var SFX_VOLUME    = 0.55;   // background UI tick — sits under the ambient bed
  var MIN_INTERVAL  = 35;     // ms between plays — kills fast-drag stacking

  // ── Capability gate ────────────────────────────────────────────────
  var hoverMQ = window.matchMedia('(hover: hover) and (pointer: fine)');
  function canHover() { return hoverMQ.matches; }

  // ── Web Audio ──────────────────────────────────────────────────────
  var ctx          = null;
  var buffer       = null;   // decoded AudioBuffer
  var bufferPromise = null;  // in-flight fetch/decode (dedup)
  var lastPlayAt   = 0;

  function getCtx() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }

  function loadBuffer() {
    if (buffer) return Promise.resolve(buffer);
    if (bufferPromise) return bufferPromise;
    var c = getCtx();
    if (!c) return Promise.reject(new Error('no AudioContext'));

    bufferPromise = fetch(SFX_SRC)
      .then(function (res) {
        if (!res.ok) throw new Error('fetch failed: ' + res.status);
        return res.arrayBuffer();
      })
      .then(function (ab) {
        // Safari < 14 returns undefined from decodeAudioData unless you
        // use the callback form — wrap both paths.
        return new Promise(function (resolve, reject) {
          var maybePromise = c.decodeAudioData(ab, resolve, reject);
          if (maybePromise && typeof maybePromise.then === 'function') {
            maybePromise.then(resolve, reject);
          }
        });
      })
      .then(function (decoded) {
        buffer = decoded;
        return buffer;
      })
      .catch(function (err) {
        // Reset so a later hover can retry
        bufferPromise = null;
        throw err;
      });

    return bufferPromise;
  }

  // ── Gate: is site audio currently on? ──────────────────────────────
  // visualizer.js adds `.is-playing` to [data-audio-toggle] iff
  // (audio started) && (!muted). If the user hasn't clicked Sound On
  // yet, or has muted, we stay silent.
  function audioEnabled() {
    var toggle = document.querySelector('[data-audio-toggle]');
    return !!(toggle && toggle.classList.contains('is-playing'));
  }

  function menuOpen() {
    return document.body.hasAttribute('data-menu-open');
  }

  // ── Play one tick ──────────────────────────────────────────────────
  // playOpts.allowDuringMenu — when true (set by menu-list items),
  //   skip the menu-open gate so the overlay's own nav rows can chirp.
  function play(playOpts) {
    if (!canHover())    return;
    if (!audioEnabled()) return;
    if (menuOpen() && !(playOpts && playOpts.allowDuringMenu)) return;

    var now = performance.now();
    if (now - lastPlayAt < MIN_INTERVAL) return;
    lastPlayAt = now;

    var c = getCtx();
    if (!c) return;

    loadBuffer().then(function (buf) {
      // AudioContext may be suspended even after a gesture on some
      // browsers (iOS Safari in particular). Resume opportunistically.
      var start = function () {
        var src = c.createBufferSource();
        src.buffer = buf;
        var gain = c.createGain();
        gain.gain.value = SFX_VOLUME;
        src.connect(gain);
        gain.connect(c.destination);
        src.start(0);
      };
      if (c.state === 'suspended' && typeof c.resume === 'function') {
        c.resume().then(start, function () { /* ignore */ });
      } else {
        start();
      }
    }).catch(function () { /* decode/fetch failed — stay silent */ });
  }

  // ── Per-item binding ───────────────────────────────────────────────
  function bindItem(li, opts) {
    if (li.hasAttribute('data-hover-sfx-init')) return;
    li.setAttribute('data-hover-sfx-init', '');
    var fromMenu = !!(opts && opts.fromMenu);
    li.addEventListener('mouseenter', function () {
      play(fromMenu ? { allowDuringMenu: true } : null);
    });
  }

  function init() {
    var bodyItems = document.querySelectorAll(
      '.services-block li, .contact-block li, .project-list li'
    );
    Array.prototype.forEach.call(bodyItems, function (li) { bindItem(li); });

    // Menu nav <li>s stretch to the full menu column width, so binding
    // mouseenter on the <li> fires the tick on empty space to the right
    // of the words. Narrow the bind target to the inner anchor/label
    // (.menu-nav-link or .menu-sub-link), which sizes to the text glyphs.
    // Mirrors the hover-target narrowing in line-hover.js.
    var menuItems = document.querySelectorAll(
      '.menu-nav-list li:not(.is-inactive)'
    );
    Array.prototype.forEach.call(menuItems, function (li) {
      var target = li.querySelector(':scope > .menu-nav-link') ||
                   li.querySelector(':scope > .menu-sub-link') ||
                   li;
      bindItem(target, { fromMenu: true });
    });
  }

  // Initial boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init after Barba transitions into the home or project namespace
  // — the container is freshly inserted, so the previous <li>s are gone
  // and the new ones carry no data-hover-sfx-init flag yet.
  function hookBarba(attempts) {
    if (typeof window.barba !== 'undefined' && window.barba.hooks) {
      window.barba.hooks.afterEnter(function (data) {
        var ns = data && data.next && data.next.namespace;
        if (ns === 'home' || ns === 'project') {
          init();
        }
      });
      return;
    }
    if (attempts > 100) return;  // give up after ~10s
    setTimeout(function () { hookBarba((attempts || 0) + 1); }, 100);
  }
  hookBarba(0);

}());
