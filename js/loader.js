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
     Progress tracking — smooth lerp
  ---------------------------------------------------------- */
  var progressTarget  = 0;
  var progressCurrent = 0;

  function setProgress(pct) {
    fillEl.style.width = pct + '%';
    barEl.setAttribute('aria-valuenow', Math.round(pct));
  }

  /* ----------------------------------------------------------
     Type Shuffle — rain-style global decode
     All lines appear scrambled at once. Characters resolve
     randomly with a top-to-bottom bias, like rain trickling
     down the terminal.
  ---------------------------------------------------------- */
  var GLYPHS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$%&*(){}<>[]|/\\:;=-+_?,.';
  var COLORS = [
    'rgba(0, 57, 148)',   /* blue  */
    'rgba(8, 171, 216)',   /* blue light  */

  ];

  var TICK_MS         = 1000 / 35;   /* shuffle tick rate */
  var RESOLVES_PER_TICK = 6;         /* chars resolved each tick */

  function randomGlyph() {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
  }
  function randomColor() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
  }

  /* ----------------------------------------------------------
     Build ALL lines into the DOM at once — fully scrambled
  ---------------------------------------------------------- */
  var allChars  = [];   /* flat array of every character object */
  var totalChars = 0;
  var resolvedCount = 0;

  function stampLine(parentEl, tag, text, extraClass) {
    var el = document.createElement(tag);
    if (extraClass) el.className = extraClass;
    parentEl.appendChild(el);

    var row = allChars.length;  /* use current length as row index */

    for (var i = 0; i < text.length; i++) {
      var span = document.createElement('span');
      var isSpace = text[i] === ' ';
      span.textContent = isSpace ? '\u00A0' : randomGlyph();
      if (!isSpace) span.style.color = randomColor();
      el.appendChild(span);

      var charObj = {
        el: span,
        final: text[i],
        resolved: isSpace,
        /* Resolve threshold: lower = resolves sooner.
           Top-to-bottom bias + per-char randomness = rain effect */
        threshold: (row * 0.6) + (i * 0.15) + (Math.random() * 8)
      };
      allChars.push(charObj);
      if (!isSpace) totalChars++;
      else resolvedCount++;
    }

    /* Make visible immediately */
    requestAnimationFrame(function () { el.classList.add('is-visible'); });
    return el;
  }

  function buildTerminal() {
    /* Log lines */
    for (var i = 0; i < LINES.length; i++) {
      var entry = LINES[i];
      var li = document.createElement('li');
      logEl.appendChild(li);

      /* Text span */
      var textSpan = document.createElement('span');
      li.appendChild(textSpan);

      /* OK tag — will be revealed when line fully resolves */
      var okSpan = document.createElement('span');
      okSpan.className = 'log-ok';
      okSpan.style.opacity = '0';
      okSpan.textContent = entry.ok ? ' [OK]' : ' [ERR]';
      li.appendChild(okSpan);

      /* Stamp scrambled characters */
      var row = i;
      for (var c = 0; c < entry.text.length; c++) {
        var span = document.createElement('span');
        var isSpace = entry.text[c] === ' ';
        span.textContent = isSpace ? '\u00A0' : randomGlyph();
        if (!isSpace) span.style.color = randomColor();
        textSpan.appendChild(span);

        allChars.push({
          el: span,
          final: entry.text[c],
          resolved: isSpace,
          threshold: (row * 1.2) + (c * 0.08) + (Math.random() * 10),
          okSpan: okSpan,          /* ref to the line's [OK] tag */
          lineIndex: i
        });
        if (!isSpace) totalChars++;
        else resolvedCount++;
      }

      requestAnimationFrame((function (el) {
        return function () { el.classList.add('is-visible'); };
      })(li));
    }

    /* Footer lines */
    for (var f = 0; f < FOOTER_LINES.length; f++) {
      var line = FOOTER_LINES[f];
      if (!line) {
        var blank = document.createElement('p');
        blank.textContent = '\u00A0';
        footerEl.appendChild(blank);
        continue;
      }

      var p = document.createElement('p');
      footerEl.appendChild(p);
      var fRow = LINES.length + f;

      for (var fc = 0; fc < line.length; fc++) {
        var fspan = document.createElement('span');
        var fIsSpace = line[fc] === ' ';
        fspan.textContent = fIsSpace ? '\u00A0' : randomGlyph();
        if (!fIsSpace) fspan.style.color = randomColor();
        p.appendChild(fspan);

        allChars.push({
          el: fspan,
          final: line[fc],
          resolved: fIsSpace,
          threshold: (fRow * 1.2) + (fc * 0.08) + (Math.random() * 10)
        });
        if (!fIsSpace) totalChars++;
        else resolvedCount++;
      }
    }
  }

  /* ----------------------------------------------------------
     Global tick — shuffles + resolves across all lines at once
  ---------------------------------------------------------- */
  var tickCount = 0;
  var lineResolved = {};  /* track per-line completion for [OK] tags */

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
          ch2.el.textContent = ch2.final === ' ' ? '\u00A0' : ch2.final;
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
     Kick off sequence — stamp everything, then start the rain
  ---------------------------------------------------------- */
  setTimeout(function () {
    buildTerminal();
    startGlobalShuffle();
  }, 300);

}());
