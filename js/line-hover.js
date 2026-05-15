

(function () {
  'use strict';

  // ── Config ─────────────────────────────────────────────────────────
  var SHUFFLE_DURATION = 120;   // ms — total time per character to settle
  var SHUFFLE_STAGGER  = 9;    // ms — delay added per character (left → right)
  var SHUFFLE_TICK_MS  = 21;    // ms — interval between glyph swaps per char
  var SHUFFLE_GLYPHS   =
    '!@#$%^&*<>?+=/\\|~_-:;.,[]{}()ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  // ── Capability gates ───────────────────────────────────────────────
  var hoverMQ  = window.matchMedia('(hover: hover) and (pointer: fine)');
  var motionMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  function canHover()           { return hoverMQ.matches; }
  function prefersReducedMotion(){ return motionMQ.matches; }

  function randomGlyph() {
    return SHUFFLE_GLYPHS.charAt(Math.floor(Math.random() * SHUFFLE_GLYPHS.length));
  }

  // ── Width-locking ──────────────────────────────────────────────────
  // Helvetica is proportional, and the shuffle glyph pool spans narrow
  // chars (i, l) to wide ones (&, @, W). Without per-char width locks,
  // the row's natural width changes mid-shuffle and pushes the column.
  // Fix: measure each char's *natural* width once and pin the span to
  // that exact width. Wider shuffle glyphs are clipped to the slot;
  // layout never shifts.
  //
  // The project applies CSS `zoom` to <html> via js/scale.js — we read
  // and divide it out so the locked width is in unzoomed CSS px and
  // stays correct as the user resizes (zoom scales locked widths
  // automatically in subsequent renders).
  function currentZoom() {
    var raw = document.documentElement.style.zoom;
    var z = parseFloat(raw);
    return (isFinite(z) && z > 0) ? z : 1;
  }

  function lockCharWidths(chars) {
    if (!chars || !chars.length) return false;
    var zoom = currentZoom();
    var anyMeasured = false;
    for (var i = 0; i < chars.length; i++) {
      var span = chars[i];
      // Only lock if not already locked AND char is laid out (skip
      // display:none parents — measurement returns 0 there).
      if (span.style.width) continue;
      var rect = span.getBoundingClientRect();
      if (rect.width <= 0) continue;
      var natural = rect.width / zoom;
      // Round to 2dp to keep inline styles tidy without losing accuracy
      span.style.width = (Math.round(natural * 100) / 100) + 'px';
      anyMeasured = true;
    }
    return anyMeasured;
  }

  // Wait for fonts so measurements use the real Helvetica Now Display
  // glyph metrics, not the system fallback (Helvetica Neue/Arial),
  // which produces noticeably different character widths.
  function awaitFonts() {
    if (document.fonts && document.fonts.ready &&
        typeof document.fonts.ready.then === 'function') {
      return document.fonts.ready;
    }
    return Promise.resolve();
  }

  // ── DOM splitting ──────────────────────────────────────────────────
  // Walk text nodes inside `root` and replace each char with a <span>.
  // Spaces become non-shuffling spans so the inner box keeps its width.
  function splitTextNodes(root) {
    var chars = [];
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    var node;
    while ((node = walker.nextNode())) textNodes.push(node);

    textNodes.forEach(function (tn) {
      var text = tn.nodeValue;
      if (!text) return;
      var frag = document.createDocumentFragment();
      for (var i = 0; i < text.length; i++) {
        var ch = text.charAt(i);
        var span = document.createElement('span');
        span.className = 'line-hover__char';
        span.textContent = ch;
        if (ch !== ' ' && ch !== '\u00A0') {
          span.setAttribute('data-original', ch);
          chars.push(span);
        }
        frag.appendChild(span);
      }
      tn.parentNode.replaceChild(frag, tn);
    });

    return chars;
  }

  // ── Per-item enhancement ───────────────────────────────────────────
  function enhanceItem(li) {
    if (li.hasAttribute('data-line-hover-init')) return;
    li.setAttribute('data-line-hover-init', '');

    // Decide host:
    //   1. If the element itself is an <a>, use it as host (active class
    //      lands on the anchor itself — used by standalone link buttons).
    //   2. Else if the <li> has a direct-child .menu-nav-link (anchor or
    //      span — the latter is used by parents of a sub-menu), use that
    //      as host. Checked before generic <a> lookup so a descendant
    //      sub-link doesn't shadow the parent label.
    //   3. Else if the <li> contains an <a>, use that as host. Sibling
    //      decoration (active-square, coords label) is left untouched.
    //   4. Otherwise wrap all contents in a <span class="line-hover">.
    var anchor = (li.tagName === 'A')
      ? li
      : (li.querySelector(':scope > .menu-nav-link') || li.querySelector('a'));
    var host;
    var originalText;

    if (anchor) {
      host = anchor;
      originalText = anchor.textContent.replace(/\s+/g, ' ').trim();
      if (!originalText) return;
      host.classList.add('line-hover');
      host.setAttribute('aria-label', originalText);
    } else {
      originalText = li.textContent.replace(/\s+/g, ' ').trim();
      if (!originalText) return;
      host = document.createElement('span');
      host.className = 'line-hover';
      while (li.firstChild) host.appendChild(li.firstChild);
      li.appendChild(host);
    }

    // Build the inner skeleton: backdrop + (optional sr label) + char inner
    var bg = document.createElement('span');
    bg.className = 'line-hover__bg';
    bg.setAttribute('aria-hidden', 'true');

    var inner = document.createElement('span');
    inner.className = 'line-hover__inner';
    inner.setAttribute('aria-hidden', 'true');
    while (host.firstChild) inner.appendChild(host.firstChild);

    host.appendChild(bg);

    // Anchor host already carries aria-label; non-anchor host needs an
    // explicit visually-hidden text label for assistive tech.
    if (!anchor) {
      var sr = document.createElement('span');
      sr.className = 'line-hover__sr';
      sr.textContent = originalText;
      host.appendChild(sr);
    }

    host.appendChild(inner);

    // Split text into char spans and stash the list for the runner
    li._lhChars = splitTextNodes(inner);

    // Lock each char to its natural width so shuffle glyphs can't push
    // the row wider. If measurement fails (element not yet laid out,
    // font not yet loaded), the char stays at its natural width and
    // we'll retry on the next init pass.
    lockCharWidths(li._lhChars);

    // Hover target: menu nav items narrow to the anchor itself so the
    // hover region matches the text glyphs (the <li> stretches to the
    // full menu column width and would otherwise fire on empty space).
    // Services/contact rows keep the wider <li> target so the whole
    // row remains interactive.
    var hoverTarget = (anchor && li.classList.contains('menu-nav-item'))
      ? anchor
      : li;
    hoverTarget.addEventListener('mouseenter', function () { activate(li, true);  });
    hoverTarget.addEventListener('mouseleave', function () { activate(li, false); });

    // Keyboard focus parity for anchor rows
    if (anchor) {
      anchor.addEventListener('focus', function () { activate(li, true);  });
      anchor.addEventListener('blur',  function () { activate(li, false); });
    }
  }

  // ── Animation runner ───────────────────────────────────────────────
  // Toggles the active class (drives the CSS clip-path wipe) and fires
  // a fresh shuffle pass. Each pass bumps a per-li version so any tick
  // timer from a previous pass is silently dropped on its next fire.
  function activate(li, entering) {
    if (!canHover()) return;
    li.classList.toggle('is-line-hover-active', entering);

    if (prefersReducedMotion()) return;

    // Menu nav items + standalone link buttons: backdrop wipe only,
    // no character shuffle.
    if (li.classList.contains('menu-nav-item') ||
        li.classList.contains('project-live-link') ||
        li.classList.contains('project-next-link')) return;

    var chars = li._lhChars;
    if (!chars || !chars.length) return;

    li._lhVersion = (li._lhVersion || 0) + 1;
    var myVersion = li._lhVersion;

    chars.forEach(function (charSpan, i) {
      var original = charSpan.getAttribute('data-original');
      var startDelay = i * SHUFFLE_STAGGER;
      var endTime    = performance.now() + startDelay + SHUFFLE_DURATION;

      function tick() {
        if (myVersion !== li._lhVersion) return;
        if (performance.now() >= endTime) {
          charSpan.textContent = original;
          return;
        }
        charSpan.textContent = randomGlyph();
        setTimeout(tick, SHUFFLE_TICK_MS);
      }

      setTimeout(tick, startDelay);
    });
  }

  // ── Init ───────────────────────────────────────────────────────────
  function init() {
    awaitFonts().then(function () {
      var items = document.querySelectorAll(
        '.services-block li, ' +
        '.contact-block li, ' +
        '.menu-nav-list li:not(.is-inactive), ' +
        '.project-live-link, ' +
        '.project-next-link'
      );
      Array.prototype.forEach.call(items, enhanceItem);

      // Second pass: any item whose chars weren't lockable on first
      // measurement (e.g., fonts swapped after enhancement, or the
      // block was hidden at init time) gets a chance to lock now.
      Array.prototype.forEach.call(items, function (li) {
        if (li._lhChars) lockCharWidths(li._lhChars);
      });
    });
  }

  // Public API
  window.colabLineHover = { init: init };

  // Initial boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-init after Barba transitions. The barba container is freshly
  // inserted on every transition, so the previous wrapper spans are
  // gone and we need to re-enhance the new elements. init() is
  // idempotent — data-line-hover-init guards prevent double-wrap.
  function hookBarba(attempts) {
    if (typeof window.barba !== 'undefined' && window.barba.hooks) {
      window.barba.hooks.afterEnter(function () { init(); });
      return;
    }
    if (attempts > 100) return;  // give up after ~10s
    setTimeout(function () { hookBarba((attempts || 0) + 1); }, 100);
  }
  hookBarba(0);

}());
