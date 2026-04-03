/**
 * co:lab — Preloader
 *
 * Terminal BIOS-style boot sequence with progress bar.
 * On complete, "Enter Site With Audio" CTA activates:
 *  - dismisses loader
 *  - reveals homepage
 *  - triggers audio playback via the visualizer
 */

(function () {
  'use strict';

  /* ----------------------------------------------------------
     Terminal lines — mimics a real asset/script boot log
  ---------------------------------------------------------- */
  var LINES = [
    { text: 'FETCHING CORE RUNTIME............', ok: true,  delay: 25  },
    { text: 'DOWNLOADING PROJECT TEMPLATES....', ok: true,  delay: 40  },
    { text: 'LOADING UI COMPONENTS............', ok: true,  delay: 30  },
    { text: 'SYNCING NOTEBOOK EXTENSIONS......', ok: true,  delay: 50  },
    { text: 'MOUNTING VIRTUAL FILESYSTEM......', ok: true,  delay: 35  },
    { text: 'ALLOCATING GPU ACCELERATOR.......', ok: true,  delay: 65  },
    { text: 'INITIALISING THREE.JS RENDERER...', ok: true,  delay: 35  },
    { text: 'BUILDING PARTICLE GEOMETRY.......', ok: true,  delay: 60  },
    { text: 'LOADING AUDIO PIPELINE...........', ok: true,  delay: 45  },
    { text: 'CALIBRATING FFT ANALYSER.........', ok: true,  delay: 30  },
    { text: 'COMPILING SHADER PROGRAMS........', ok: true,  delay: 55  },
    { text: 'DOWNLOADING SAMPLE DATASETS......', ok: true,  delay: 45  },
    { text: 'ACTIVATING INTERACTIVE WIDGETS...', ok: true,  delay: 35  },
    { text: 'ENABLING REAL-TIME COLLABORATION.', ok: true,  delay: 40  },
    { text: 'VERIFYING ASSET INTEGRITY........', ok: true,  delay: 30  },
    { text: 'ESTABLISHING SECURE CONTEXT......', ok: true,  delay: 35  },
  ];

  var FOOTER_LINES = [
    'ALL SYSTEMS READY.',
    'WELCOME TO THE EXPERIMENTAL ZONE',
    '',
    '(PRESS ANY KEY TO CONTINUE)',
    'READY!',
    '',
    'MONITOR READY.',
  ];

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
       1. page-entering hides elements (opacity:0, globe scale:0.82)
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
     Progress tracking
  ---------------------------------------------------------- */
  var totalLines    = LINES.length;
  var linesComplete = 0;

  function setProgress(pct) {
    fillEl.style.width = pct + '%';
    barEl.setAttribute('aria-valuenow', Math.round(pct));
  }

  /* ----------------------------------------------------------
     Type Shuffle — Effect 3 (staggered left-to-right decode)
     Characters cycle through random glyphs before resolving
     to their final value, creating a terminal decryption feel.
  ---------------------------------------------------------- */
  var GLYPHS = 'ラドクリフマラソンわたしワタシんョシ゚ンハバンドを！＝0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var SHUFFLE_FPS    = 1000 / 60;     /* tick rate — 60fps */
  var RESOLVE_PER_TICK = 3;           /* chars resolved each tick */
  var CYCLES_BEFORE   = 1;            /* min shuffle cycles before resolve */

  function randomGlyph() {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }

  /**
   * Shuffle-reveal a string inside a DOM element.
   * Characters start as random glyphs and resolve left-to-right.
   * @param {HTMLElement} el      — container element
   * @param {string}      text    — final resolved text
   * @param {function}    onDone  — callback when animation completes
   */
  function shuffleReveal(el, text, onDone) {
    /* Build a span for every character */
    var chars = [];
    el.innerHTML = '';
    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      span.textContent = text[i] === ' ' ? '\u00A0' : randomGlyph();
      span.style.opacity = '0.4';
      el.appendChild(span);
      chars.push({
        el: span,
        final: text[i],
        resolved: text[i] === ' ',   /* spaces resolve instantly */
        cycles: 0
      });
    }

    var resolveIndex = 0;
    var allDone = false;

    var intervalId = setInterval(function () {
      /* Cycle unresolved characters through random glyphs */
      for (var c = 0; c < chars.length; c++) {
        if (!chars[c].resolved) {
          chars[c].el.textContent = randomGlyph();
          chars[c].cycles++;
        }
      }

      /* Resolve the next batch of characters */
      var resolved = 0;
      while (resolveIndex < chars.length && resolved < RESOLVE_PER_TICK) {
        var ch = chars[resolveIndex];
        if (ch.resolved) {
          resolveIndex++;
          continue;
        }
        if (ch.cycles >= CYCLES_BEFORE) {
          ch.el.textContent = ch.final === ' ' ? '\u00A0' : ch.final;
          ch.el.style.opacity = '1';
          ch.resolved = true;
          resolveIndex++;
          resolved++;
        } else {
          break;
        }
      }

      /* Check if everything is resolved */
      if (resolveIndex >= chars.length && !allDone) {
        allDone = true;
        clearInterval(intervalId);
        if (onDone) onDone();
      }
    }, SHUFFLE_FPS);
  }

  /* ----------------------------------------------------------
     Typewriter: print each log line with shuffle decode
  ---------------------------------------------------------- */
  function printLines(index) {
    if (index >= LINES.length) {
      printFooter(0);
      return;
    }

    var entry = LINES[index];
    var li    = document.createElement('li');
    var textSpan = document.createElement('span');
    var okSpan   = document.createElement('span');
    okSpan.className = 'log-ok';

    li.appendChild(textSpan);
    li.appendChild(okSpan);
    logEl.appendChild(li);

    requestAnimationFrame(function () {
      li.classList.add('is-visible');
    });

    /* Shuffle-decode the main text, then reveal [OK] */
    shuffleReveal(textSpan, entry.text, function () {
      var okStr = entry.ok ? ' [OK]' : ' [ERR]';
      okSpan.textContent = okStr;

      linesComplete++;
      setProgress((linesComplete / totalLines) * 100);

      setTimeout(function () {
        printLines(index + 1);
      }, entry.delay);
    });
  }

  /* ----------------------------------------------------------
     Footer lines after all log entries complete
  ---------------------------------------------------------- */
  function printFooter(index) {
    if (index >= FOOTER_LINES.length) {
      /* Print cursor prompt */
      var prompt = document.createElement('div');
      prompt.innerHTML = '> <span class="loader-cursor"></span>';
      footerEl.appendChild(prompt);

      /* Enable CTA */
      setTimeout(enableCta, 300);
      return;
    }

    var line = FOOTER_LINES[index];
    var p    = document.createElement('p');
    footerEl.appendChild(p);

    if (line) {
      shuffleReveal(p, line, function () {
        setTimeout(function () { printFooter(index + 1); }, 40);
      });
    } else {
      p.textContent = '\u00A0';
      setTimeout(function () { printFooter(index + 1); }, 40);
    }
  }

  /* ----------------------------------------------------------
     Enable the CTA button once complete
  ---------------------------------------------------------- */
  function enableCta() {
    setProgress(100);
    ctaEl.disabled = false;
    ctaEl.setAttribute('aria-label', 'Enter site with audio enabled');

    /* Allow any key press to trigger */
    document.addEventListener('keydown', handleKeyEnter);

    /* Allow tapping anywhere on the loader to enter (mobile) */
    loader.addEventListener('touchend', handleTouchEnter);
  }

  function handleKeyEnter() {
    document.removeEventListener('keydown', handleKeyEnter);
    dismissLoader(true);
  }

  function handleTouchEnter(e) {
    /* Only respond if CTA is enabled */
    if (ctaEl.disabled) return;
    e.preventDefault(); /* prevent ghost click */
    loader.removeEventListener('touchend', handleTouchEnter);
    dismissLoader(true);
  }

  /* ----------------------------------------------------------
     Dismiss loader and reveal homepage
  ---------------------------------------------------------- */
  var dismissed = false; /* guard against double-fire from touch+click */

  function dismissLoader(withAudio) {
    if (dismissed) return;
    dismissed = true;

    /* Remove all entry listeners */
    document.removeEventListener('keydown', handleKeyEnter);
    loader.removeEventListener('touchend', handleTouchEnter);

    /* Mark session as visited so subsequent page loads skip the loader */
    try { sessionStorage.setItem(SESSION_KEY, '1'); } catch (e) {}

    loader.classList.add('is-hidden');
    document.body.classList.remove('loader-active');

    /* Fire reveal event — triggers shader reveal */
    document.dispatchEvent(new CustomEvent('colab:revealed'));

    /* Remove from DOM after transition */
    loader.addEventListener('transitionend', function onEnd() {
      loader.removeEventListener('transitionend', onEnd);
      loader.remove();
    });

    /* Safety fallback — if transitionend never fires (common on
       some mobile browsers), remove the loader after a timeout */
    setTimeout(function () {
      if (loader.parentNode) loader.remove();
    }, 2000);

    /* Trigger audio if requested — hooks into visualizer */
    if (withAudio) {
      var viz = document.querySelector('[data-visualizer]');
      if (viz) {
        setTimeout(function () {
          viz.click();
        }, 400);
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
    e.preventDefault(); /* prevent 300ms delay ghost click */
    dismissLoader(true);
  });

  /* ----------------------------------------------------------
     Kick off sequence
  ---------------------------------------------------------- */
  setTimeout(function () {
    printLines(0);
  }, 300);

}());
