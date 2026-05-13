
(function () {
  'use strict';

  var VIMEO_ID  = '1171733635';
  var SDK_URL   = 'https://player.vimeo.com/api/player.js';

  var sdkLoaded  = false;
  var sdkLoading = false;
  var sdkQueue   = [];

  var previewPlayer  = null;   /* Vimeo Player instance for the thumbnail */
  var lightboxPlayer = null;   /* Vimeo Player instance for the full view */
  var currentClose   = null;   /* the active closeLightbox closure (replaced on each init) */

  /* ============================================================
     SDK LOADER — load once, queue callbacks
     ============================================================ */
  function loadSdk(cb) {
    if (sdkLoaded) { cb(); return; }
    sdkQueue.push(cb);
    if (sdkLoading) return;
    sdkLoading = true;
    var s = document.createElement('script');
    s.src = SDK_URL;
    s.onload = function () {
      sdkLoaded = true;
      sdkLoading = false;
      sdkQueue.forEach(function (fn) { fn(); });
      sdkQueue = [];
    };
    document.head.appendChild(s);
  }

  /* ============================================================
     DOM REFS
     ============================================================ */

  function initVideoPreview() {
    var preview   = document.querySelector('[data-video-preview]');
    var lightbox  = document.querySelector('[data-video-lightbox]');
    var frameWrap = document.querySelector('[data-lightbox-frame]');
    var closeBtn  = document.querySelector('[data-video-close]');
    var thumbEl   = document.querySelector('[data-video-thumb]');

    if (!preview || !lightbox || !frameWrap) return;

  /* ============================================================
     INIT PREVIEW PLAYER
     Load SDK early so we can query the current time on click.
     ============================================================ */
  function initPreviewPlayer() {
    if (!thumbEl || !window.Vimeo) return;
    try {
      previewPlayer = new window.Vimeo.Player(thumbEl);
    } catch (e) {
      previewPlayer = null;
    }
  }

  /* Load SDK as soon as the page is ready, initialise preview player */
  loadSdk(function () {
    initPreviewPlayer();
  });

  /* ============================================================
     OPEN LIGHTBOX — resume from preview position
     ============================================================ */
  function openLightbox() {
    function buildAndOpen(startTime) {
      /* Inject iframe into lightbox */
      var iframe = document.createElement('iframe');
      iframe.src = 'https://player.vimeo.com/video/' + VIMEO_ID
        + '?autoplay=1&color=ffffff&byline=0&title=0&portrait=0';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');
      frameWrap.innerHTML = '';
      frameWrap.appendChild(iframe);

      /* Use SDK to seek to preview position once player is ready */
      if (window.Vimeo && startTime > 0) {
        try {
          lightboxPlayer = new window.Vimeo.Player(iframe);
          lightboxPlayer.ready().then(function () {
            lightboxPlayer.setCurrentTime(startTime).catch(function () {});
          }).catch(function () {});
        } catch (e) {
          lightboxPlayer = null;
        }
      }

      /* Show overlay */
      lightbox.setAttribute('aria-hidden', 'false');
      lightbox.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      if (closeBtn) closeBtn.focus();
    }

    /* Try to get current time from preview player */
    if (previewPlayer) {
      previewPlayer.getCurrentTime().then(function (t) {
        buildAndOpen(t || 0);
      }).catch(function () {
        buildAndOpen(0);
      });
    } else {
      buildAndOpen(0);
    }
  }

  /* ============================================================
     CLOSE LIGHTBOX
     ============================================================ */
  function closeLightbox() {
    if (!lightbox.classList.contains('is-open')) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    lightboxPlayer = null;

    /* Destroy iframe after CSS transition completes (stops audio instantly) */
    setTimeout(function () {
      frameWrap.innerHTML = '';

      /* Resume the muted preview player — it pauses automatically when
         the lightbox player starts because Vimeo pauses other players
         on the same page when a new one begins playback */
      if (previewPlayer) {
        previewPlayer.play().catch(function () {});
      }
    }, 360);

    preview.focus();
  }

  /* ============================================================
     EVENTS
     ============================================================ */

  /* Preview — click or keyboard */
  preview.setAttribute('tabindex', '0');
  preview.setAttribute('role', 'button');
  preview.addEventListener('click', openLightbox);
  preview.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(); }
  });

  /* Close button */
  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

  /* Backdrop click (outside the inner video frame) */
  lightbox.addEventListener('click', function (e) {
    if (e.target === lightbox) closeLightbox();
  });

  /* Publish the current closer so the persistent ESC listener can reach
     the most recent lightbox instance after Barba swaps the container. */
  currentClose = closeLightbox;

  } /* end initVideoPreview */

  /* Single persistent ESC handler — Barba calls init() on every project
     page enter, so binding inside init() would accumulate one document
     listener (and a stale closure over the previous lightbox) per visit. */
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && currentClose) currentClose();
  });

  /* Auto-init if elements exist */
  initVideoPreview();

  /* Expose for Barba re-init */
  window.colabVideoPreview = { init: initVideoPreview };

}());
