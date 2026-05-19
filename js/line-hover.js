

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
  // The project applies CSS `zoom` to <html> via js/scale.js. To convert
  // a measured rect into the unzoomed CSS pixels we want to lock, we
  // need the factor that the *browser* applied to rects — not necessarily
  // the same as the `zoom` CSS value:
  //
  //   - Blink (Chrome/Edge) and modern Gecko (Firefox 126+) zoom rects:
  //     a 100px element at zoom 0.5 reports rect.width = 50.
  //   - WebKit (Safari, including current macOS/iOS releases) does NOT
  //     zoom rects: the same element reports rect.width = 100.
  //
  // The previous implementation read `documentElement.style.zoom` and
  // divided every char width by it. That works in Chrome but in Safari
  // it inflates every char width by 1/zoom, which compounded across
  // each line pushes the services + contact two-column layout past its
  // 255px envelope — second-column items overlap or clip on the right.
  //
  // Probe the live browser instead: render a 100px-wide reference div
  // and divide locked widths by whatever rect.width it reports. In
  // Chrome the probe returns ≈ 100 * zoom (so we divide out the zoom);
  // in Safari it returns ≈ 100 (so we divide by 1 and store the
  // measured rect as-is, which is already in unzoomed CSS px).
  function measureRectScale() {
    if (!document.body) return 1;
    var probe = document.createElement('div');
    probe.style.cssText =
      'position:absolute;left:-9999px;top:0;width:100px;height:1px;' +
      'margin:0;padding:0;border:0;visibility:hidden;pointer-events:none';
    document.body.appendChild(probe);
    var w = probe.getBoundingClientRect().width;
    document.body.removeChild(probe);
    if (!isFinite(w) || w <= 0) return 1;
    return w / 100;
  }

  function lockCharWidths(chars) {
    if (!chars || !chars.length) return false;
    var rectScale = measureRectScale();
    var anyMeasured = false;
    for (var i = 0; i < chars.length; i++) {
      var span = chars[i];
      // Only lock if not already locked AND char is laid out (skip
      // display:none parents — measurement returns 0 there).
      if (span.style.width) continue;
      var rect = span.getBoundingClientRect();
      if (rect.width <= 0) continue;
      var natural = rect.width / rectScale;
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
