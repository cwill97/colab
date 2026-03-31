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
    { text: 'FETCHING CORE RUNTIME............', ok: true,  delay: 80  },
    { text: 'DOWNLOADING PROJECT TEMPLATES....', ok: true,  delay: 120 },
    { text: 'LOADING UI COMPONENTS............', ok: true,  delay: 90  },
    { text: 'SYNCING NOTEBOOK EXTENSIONS......', ok: true,  delay: 150 },
    { text: 'MOUNTING VIRTUAL FILESYSTEM......', ok: true,  delay: 100 },
    { text: 'ALLOCATING GPU ACCELERATOR.......', ok: true,  delay: 200 },
    { text: 'INITIALISING THREE.JS RENDERER...', ok: true,  delay: 110 },
    { text: 'BUILDING PARTICLE GEOMETRY.......', ok: true,  delay: 180 },
    { text: 'LOADING AUDIO PIPELINE...........', ok: true,  delay: 130 },
    { text: 'CALIBRATING FFT ANALYSER.........', ok: true,  delay: 90  },
    { text: 'COMPILING SHADER PROGRAMS........', ok: true,  delay: 160 },
    { text: 'DOWNLOADING SAMPLE DATASETS......', ok: true,  delay: 140 },
    { text: 'ACTIVATING INTERACTIVE WIDGETS...', ok: true,  delay: 100 },
    { text: 'ENABLING REAL-TIME COLLABORATION.', ok: true,  delay: 120 },
    { text: 'VERIFYING ASSET INTEGRITY........', ok: true,  delay: 90  },
    { text: 'ESTABLISHING SECURE CONTEXT......', ok: true,  delay: 110 },
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
     Typewriter: print each log line sequentially
  ---------------------------------------------------------- */
  function printLines(index) {
    if (index >= LINES.length) {
      printFooter(0);
      return;
    }

    var entry = LINES[index];
    var li    = document.createElement('li');
    var okStr = entry.ok ? ' [OK]' : ' [ERR]';

    li.innerHTML = entry.text + '<span class="log-ok">' + okStr + '</span>';
    logEl.appendChild(li);

    /* Tiny frame delay then show */
    requestAnimationFrame(function () {
      li.classList.add('is-visible');
    });

    linesComplete++;
    var pct = (linesComplete / totalLines) * 100;
    setProgress(pct);

    setTimeout(function () {
      printLines(index + 1);
    }, entry.delay);
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
    p.textContent = line || '\u00A0'; /* non-breaking space for blank lines */
    footerEl.appendChild(p);

    setTimeout(function () {
      printFooter(index + 1);
    }, 120);
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
