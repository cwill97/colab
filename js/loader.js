
(function () {
  'use strict';

  /* ----------------------------------------------------------
     Terminal lines — mimics a real asset/script boot log
  ---------------------------------------------------------- */
  var LINES = [
    { text: 'NMAP -SS -PN -T4 10.0.0.0/24..', ok: true,  delay: 25  },
    { text: 'INITIATING SYN STEALTH SCAN...', ok: true,  delay: 40  },
    { text: 'SCANNING 256 HOSTS [1000 PORTS/HOST]', ok: true,  delay: 30  },
    { text: 'DISCOVERED OPEN PORT 22/TCP (SSH)', ok: true,  delay: 50  },
    { text: 'DISCOVERED OPEN PORT 80/TCP (HTTP)', ok: true,  delay: 35  },
    { text: 'OS FINGERPRINTING IN PROGRESS...', ok: true,  delay: 65  },
    { text: 'RUNNING SERVICE DETECTION (-SV)', ok: true,  delay: 35  },
    { text: 'SERVICE SCAN REPORT: OPENSSH 8.2P1', ok: true,  delay: 60  },
    { text: 'SERVICE SCAN REPORT: APACHE HTTPD 2.4.54', ok: true,  delay: 45  },
    { text: 'ENUMERATING SSL/TLS CONFIGURATION...', ok: true,  delay: 30  },
    { text: 'CHECKING FOR KNOWN CVES...', ok: true,  delay: 55  },
    { text: 'NO CRITICAL VULNERABILITIES DETECTED', ok: true,  delay: 45  },
    { text: 'ESTABLISHING REVERSE TCP HANDLER...', ok: true,  delay: 35  },
    { text: 'ATTEMPTING CREDENTIAL BRUTE FORCE (SSH)...', ok: true,  delay: 40  },
    { text: 'SPAWNING PSEUDO-TERMINAL...', ok: true,  delay: 30  },
    { text: 'ACCESS LEVEL: ROOT', ok: true,  delay: 35  },
  ];

  var FOOTER_LINES = [
    'CLEANING TRACES',
    '',
    '(PRESS ANY KEY TO CONTINUE)',
  ];

  /* ----------------------------------------------------------
     Stagger timing
  ---------------------------------------------------------- */
  var LINE_STAGGER = 110;  /* ms between each line fading in */
  var LINE_START   = 400;  /* delay before first log line (after intro fades) */

  /* ----------------------------------------------------------
     DOM refs
  ---------------------------------------------------------- */
  var loader     = document.getElementById('loader');
  var logEl      = document.getElementById('loaderLog');
  var footerEl   = document.getElementById('loaderFooter');
  var fillEl     = document.getElementById('loaderFill');
  var barEl      = document.getElementById('loaderBar');
  var ctaEl      = document.getElementById('loaderCta');

  if (!loader) return;

  /* ----------------------------------------------------------
     Session check — skip loader on internal navigation.
     First visit / hard refresh: no flag → show loader normally.
     Subsequent page loads within same tab: flag exists → bypass.
  ---------------------------------------------------------- */
  var SESSION_KEY = 'colab_visited';

  function skipLoader() {
    /* Remove the loader element immediately — no transition */
    loader.remove();
    /* Ensure body is never locked */
    document.body.classList.remove('loader-active');

    /* Orchestrate elegant page entrance:
       1. page-entering hides elements (opacity:0, tesseract scale:0.82)
       2. Next frame: page-revealed added — CSS transitions kick in
       3. colab:revealed fires so shader reveal runs in sync */
    document.body.classList.add('page-entering');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        /* Double rAF ensures browser has painted the hidden state
           before we trigger transitions */
        document.body.classList.add('page-revealed');

        /* Fire reveal event with a small offset */
        setTimeout(function () {
          document.dispatchEvent(new CustomEvent('colab:revealed'));
        }, 80);

        /* Clean up helper classes after all transitions finish */
        setTimeout(function () {
          document.body.classList.remove('page-entering', 'page-revealed');
        }, 1400);
      });
    });
  }

  try {
    /* If arriving via shader page transition, the shader-reveal.js
       handles everything — just remove the loader silently and bail */
    if (sessionStorage.getItem('colab_shaderNav')) {
      loader.remove();
      document.body.classList.remove('loader-active');
      return;
    }

    if (sessionStorage.getItem(SESSION_KEY)) {
      /* Already visited this session — skip entirely */
      skipLoader();
      return;
    }
  } catch (e) { /* sessionStorage blocked (private mode edge case) — show loader */ }

  /* Lock body while loading */
  document.body.classList.add('loader-active');

  /* ----------------------------------------------------------
     Progress tracking — smooth lerp
  ---------------------------------------------------------- */
  var progressTarget  = 0;
  var progressCurrent = 0;

  /* Build segmented blocks once */
  var SEG_COUNT = 52;
  var segEls = [];
  (function buildSegments() {
    if (!fillEl) return;
    for (var s = 0; s < SEG_COUNT; s++) {
      var seg = document.createElement('span');
      seg.className = 'loader-seg';
      fillEl.appendChild(seg);
      segEls.push(seg);
    }
  }());

  function setProgress(pct) {
    var filled = Math.round((pct / 100) * SEG_COUNT);
    for (var i = 0; i < segEls.length; i++) {
      var on = i < filled;
      if (on !== segEls[i].classList.contains('is-filled')) {
        segEls[i].classList.toggle('is-filled', on);
      }
    }
    barEl.setAttribute('aria-valuenow', Math.round(pct));
  }

  /* ----------------------------------------------------------
     Type Shuffle — rain-style global decode
     Characters resolve randomly with a top-to-bottom bias.
  ---------------------------------------------------------- */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWX1234567890!@#$%^&*()_+{}[]?/><';
  var COLORS = [
    'rgba(255,255,255)',
    'rgba(255,255,255,0.50)',
  ];

  var TICK_MS           = 600 / 35;
  var RESOLVES_PER_TICK = 3;

  function randomGlyph() {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  /* ----------------------------------------------------------
     Character pool
  ---------------------------------------------------------- */
  var allChars      = [];
  var totalChars    = 0;
  var resolvedCount = 0;

  /* ----------------------------------------------------------
     Build terminal — lines appear one by one via staggered
     opacity fade-in; scramble decode runs across all lines.
  ---------------------------------------------------------- */
  function buildTerminal() {
    /* Intro line — fades in first */
    var introEl = loader.querySelector('.loader-terminal-intro');
    if (introEl) {
      setTimeout(function () { introEl.classList.add('is-visible'); }, 100);
    }

    /* Log lines — each fades in LINE_STAGGER ms after the previous */
    for (var i = 0; i < LINES.length; i++) {
      var entry = LINES[i];
      var li = document.createElement('li');
      logEl.appendChild(li);

      var textSpan = document.createElement('span');
      li.appendChild(textSpan);

      /* [READY] tag — revealed when line fully decodes */
      var okSpan = document.createElement('span');
      okSpan.className = 'log-ok';
      okSpan.style.opacity = '0';
      okSpan.textContent = entry.ok ? ' [READY]' : ' [ERR]';
      li.appendChild(okSpan);

      /* Stamp scrambled characters */
      var row = i;
      for (var c = 0; c < entry.text.length; c++) {
        var span = document.createElement('span');
        var isSpace = entry.text[c] === ' ';
        span.textContent = isSpace ? ' ' : randomGlyph();
        if (!isSpace) span.style.color = randomColor();
        textSpan.appendChild(span);

        allChars.push({
          el: span,
          final: entry.text[c],
          resolved: isSpace,
          threshold: (LINE_START + row * LINE_STAGGER) / TICK_MS + (c * 0.3) + (Math.random() * 8),
          okSpan: okSpan,
          lineIndex: i
        });
        if (!isSpace) totalChars++;
        else resolvedCount++;
      }

      /* Staggered fade-in */
      (function (el, idx) {
        setTimeout(function () { el.classList.add('is-visible'); }, LINE_START + idx * LINE_STAGGER);
      })(li, i);
    }

    /* Footer lines — continue stagger after last log line */
    for (var f = 0; f < FOOTER_LINES.length; f++) {
      var line = FOOTER_LINES[f];
      var fDelay = LINE_START + (LINES.length + f) * LINE_STAGGER;

      if (!line) {
        var blank = document.createElement('p');
        blank.textContent = ' ';
        footerEl.appendChild(blank);
        (function (el, d) {
          setTimeout(function () { el.classList.add('is-visible'); }, d);
        })(blank, fDelay);
        continue;
      }

      var p = document.createElement('p');
      footerEl.appendChild(p);
      var fRow = LINES.length + f;

      for (var fc = 0; fc < line.length; fc++) {
        var fspan = document.createElement('span');
        var fIsSpace = line[fc] === ' ';
        fspan.textContent = fIsSpace ? ' ' : randomGlyph();
        if (!fIsSpace) fspan.style.color = randomColor();
        p.appendChild(fspan);

        allChars.push({
          el: fspan,
          final: line[fc],
          resolved: fIsSpace,
          threshold: (LINE_START + fRow * LINE_STAGGER) / TICK_MS + (fc * 0.3) + (Math.random() * 8)
        });
        if (!fIsSpace) totalChars++;
        else resolvedCount++;
      }

      (function (el, d) {
        setTimeout(function () { el.classList.add('is-visible'); }, d);
      })(p, fDelay);
    }
  }

  /* ----------------------------------------------------------
     Global tick — shuffles + resolves across all lines at once
  ---------------------------------------------------------- */
  var tickCount    = 0;
  var lineResolved = {};

  function startGlobalShuffle() {
    var intervalId = setInterval(function () {
      tickCount++;

      /* Cycle all unresolved chars */
      for (var i = 0; i < allChars.length; i++) {
        var ch = allChars[i];
        if (!ch.resolved) {
          ch.el.textContent = randomGlyph();
          ch.el.style.color = randomColor();
        }
      }

      /* Resolve characters whose threshold has been reached */
      var resolved = 0;
      for (var j = 0; j < allChars.length; j++) {
        if (resolved >= RESOLVES_PER_TICK) break;
        var ch2 = allChars[j];
        if (ch2.resolved) continue;
        if (tickCount >= ch2.threshold) {
          ch2.el.textContent = ch2.final === ' ' ? ' ' : ch2.final;
          ch2.el.style.color = '';
          ch2.resolved = true;
          resolvedCount++;
          resolved++;

          /* Reveal [OK] when all chars in that line are done */
          if (ch2.okSpan != null && ch2.lineIndex != null && !lineResolved[ch2.lineIndex]) {
            var lineDone = true;
            for (var k = 0; k < allChars.length; k++) {
              if (allChars[k].lineIndex === ch2.lineIndex && !allChars[k].resolved) {
                lineDone = false;
                break;
              }
            }
            if (lineDone) {
              lineResolved[ch2.lineIndex] = true;
              ch2.okSpan.style.opacity = '1';
            }
          }
        }
      }

      /* Smooth progress */
      progressTarget = (resolvedCount / allChars.length) * 100;
      progressCurrent += (progressTarget - progressCurrent) * 0.18;
      setProgress(progressCurrent);

      /* All done */
      if (resolvedCount >= allChars.length) {
        clearInterval(intervalId);
        setProgress(100);

        /* Cursor prompt */
        var prompt = document.createElement('div');
        prompt.innerHTML = '> <span class="loader-cursor"></span>';
        footerEl.appendChild(prompt);

        setTimeout(enableCta, 300);
      }
    }, TICK_MS);
  }

  /* ----------------------------------------------------------
     Enable the CTA button once complete
  ---------------------------------------------------------- */
  var autoEnterTimer = null;

  function enableCta() {
    setProgress(100);
    ctaEl.disabled = false;
    ctaEl.setAttribute('aria-label', 'Enter site with audio enabled');

    document.addEventListener('keydown', handleKeyEnter);
    loader.addEventListener('touchend', handleTouchEnter);

    autoEnterTimer = setTimeout(function () {
      if (!dismissed) dismissLoader(false);
    }, 2400);
  }

  function handleKeyEnter() {
    document.removeEventListener('keydown', handleKeyEnter);
    dismissLoader(true);
  }

  function handleTouchEnter(e) {
    if (ctaEl.disabled) return;
    e.preventDefault();
    loader.removeEventListener('touchend', handleTouchEnter);
    dismissLoader(true);
  }

  /* ----------------------------------------------------------
     Dismiss loader and reveal homepage
  ---------------------------------------------------------- */
  var dismissed = false;

  function dismissLoader(withAudio) {
    if (dismissed) return;
    dismissed = true;

    document.removeEventListener('keydown', handleKeyEnter);
    loader.removeEventListener('touchend', handleTouchEnter);
    if (autoEnterTimer) { clearTimeout(autoEnterTimer); autoEnterTimer = null; }

    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}

    loader.classList.add('is-hidden');
    document.body.classList.remove('loader-active');

    document.dispatchEvent(new CustomEvent('colab:revealed'));

    loader.addEventListener('transitionend', function onEnd() {
      loader.removeEventListener('transitionend', onEnd);
      loader.remove();
    });

    setTimeout(function () {
      if (loader.parentNode) loader.remove();
    }, 2000);

    if (withAudio) {
      /* Call startWithGesture() directly — this runs inside the original
         touchend/click handler so iOS Safari grants the user-activation
         token to AudioContext.resume() and audioEl.play().
         Routing via element.click() creates a synthetic event that can
         drop the activation token on older iOS (< 15). */
      if (window.colabAudio && typeof window.colabAudio.startWithGesture === 'function') {
        window.colabAudio.startWithGesture();
      } else {
        /* Fallback — visualizer.js not loaded yet (shouldn't happen with defer) */
        var viz = document.querySelector('[data-visualizer]');
        if (viz) viz.click();
      }
    }
  }

  /* ----------------------------------------------------------
     CTA click + touch
  ---------------------------------------------------------- */
  ctaEl.addEventListener('click', function () {
    dismissLoader(true);
  });

  ctaEl.addEventListener('touchend', function (e) {
    if (ctaEl.disabled) return;
    e.preventDefault();
    dismissLoader(true);
  });

  /* ----------------------------------------------------------
     Kick off sequence
  ---------------------------------------------------------- */
  setTimeout(function () {
    buildTerminal();
    startGlobalShuffle();
  }, 300);

}());
