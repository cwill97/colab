/* ============================================================
   Scroll-driven editorial animations for the Studio (about) page.
   Text: Codrops ScrollBlurTypography variant 4 — word-by-word
         blur + skew + opacity, scrubbed to scroll position.
   Images: clip-path reveal (top-left → bottom-right) + parallax.
   Uses GSAP ScrollTrigger + Lenis integration.
   ============================================================ */
(function () {
  'use strict';

  var triggers = [];
  var heroTL = null;
  var shaderFallback = null;

  /* ── Word-split utility ────────────────────────────────────
     Wraps every word in <span class="word"> for per-word
     animation. Returns the array of word spans. */
  function splitWords(el) {
    var savedIndent = getComputedStyle(el).textIndent;
    var text = el.textContent.trim();
    var words = text.split(/\s+/);

    el.innerHTML = words.map(function (w) {
      return '<span class="word">' + w + '</span>';
    }).join(' ');

    el.style.textIndent = '0';
    var firstWord = el.querySelector('.word');
    if (firstWord && parseFloat(savedIndent) > 0) {
      firstWord.style.marginLeft = savedIndent;
    }

    return el.querySelectorAll('.word');
  }

  /* ── Variant 4 blur-scroll effect ──────────────────────────
     Matches Codrops ScrollBlurTypography effect-4 exactly:
     words scrub from blurred/skewed/invisible → clear. */
  function blurScrollEffect(el) {
    var words = splitWords(el);

    var tween = gsap.fromTo(words, {
      opacity: 0,
      skewX: 0,
      willChange: 'filter, transform',
      filter: 'blur(8px)'
    }, {
      ease: 'sine',
      opacity: 1,
      skewX: 0,
      filter: 'blur(0px)',
      stagger: 0.04,
      scrollTrigger: {
        trigger: el,
        start: 'top bottom-=15%',
        end: 'bottom center+=15%',
        scrub: true
      }
    });

    if (tween.scrollTrigger) triggers.push(tween.scrollTrigger);
  }

  /* ── Timed variant 4 entrance ──────────────────────────────
     Same blur/skew/opacity visual as variant 4, but played as
     a timed animation instead of scroll-scrubbed. Used for
     hero text that's already in the viewport on load. */
  function blurEntranceEffect(el) {
    var words = splitWords(el);

    gsap.fromTo(words, {
      opacity: 0,
      skewX: 0,
      willChange: 'filter, transform',
      filter: 'blur(8px)'
    }, {
      ease: 'sine.out',
      opacity: 1,
      skewX: 0,
      filter: 'blur(0px)',
      stagger: 0.03,
      duration: 0.8
    });
  }

  /* ── Init ──────────────────────────────────────────────────── */
  function init() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;
    gsap.registerPlugin(ScrollTrigger);

    var lenis = window.colabLenis;
    if (lenis) {
      lenis.on('scroll', ScrollTrigger.update);
    }

    var heroImages   = document.querySelectorAll('.studio-hero-image');
    var gridCells    = document.querySelectorAll('.studio-grid-cell-tall');
    var wideImage    = document.querySelector('.studio-wide');
    var lockup       = document.querySelector('.studio-lockup');

    /* ═══════════════════════════════════════════════════════════
       DESKTOP STICKY — studio-hero-image--3 pins until
       studio-middle-copy--c is reached (cross-section, so
       CSS sticky can't do this; GSAP pin handles it).
       ═══════════════════════════════════════════════════════════ */
    var img3     = document.querySelector('.studio-hero-image--3');
    var gridRow  = document.querySelector('.studio-grid-tall-row');

    if (img3 && gridRow && window.matchMedia('(min-width: 768px)').matches) {
      var navEl     = document.querySelector('.site-nav');
      var navH      = navEl ? navEl.offsetHeight : 0;
      /* img3 pins at top:navH, so its bottom sits at navH + img3.offsetHeight.
         Release when gridRow's bottom reaches that same viewport Y so img3's
         bottom and the 4 grid cells' bottoms land in line. */
      var endOffset = navH + img3.offsetHeight;

      var stickyPin = ScrollTrigger.create({
        trigger:    img3,
        endTrigger: gridRow,
        start:      'top top+=' + navH,
        end:        'bottom top+=' + endOffset,
        pin:        true,
        pinSpacing: false
      });
      triggers.push(stickyPin);
    }

    /* ═══════════════════════════════════════════════════════════
       BELOW-FOLD TEXT — variant 4 blur-scroll applied immediately
       (hidden by scroll position, so no flash)
       ═══════════════════════════════════════════════════════════ */
    var belowFoldText = document.querySelectorAll(
      '.studio-middle-lead, .studio-middle-copy'
    );
    belowFoldText.forEach(function (el) {
      blurScrollEffect(el);
    });

    /* ═══════════════════════════════════════════════════════════
       HERO — text + images hidden until shader reveal completes
       ═══════════════════════════════════════════════════════════ */
    var heroLead  = document.querySelector('.studio-lead');
    var heroIntro = document.querySelector('.studio-intro');

    // Hide hero text until reveal
    if (heroLead)  gsap.set(heroLead, { opacity: 0 });
    if (heroIntro) gsap.set(heroIntro, { opacity: 0 });

    // Hide hero images until reveal — clipped from right+bottom (top-left origin)
    heroImages.forEach(function (fig) {
      gsap.set(fig, { clipPath: 'inset(0% 100% 100% 0%)' });
      var img = fig.querySelector('img');
      if (img) gsap.set(img, { scale: 1.2 });
    });

    heroTL = gsap.timeline({ paused: true });

    heroImages.forEach(function (fig) {
      heroTL.to(fig, {
        clipPath: 'inset(0% 0% 0% 0%)',
        duration: 1.0,
        ease: 'power3.inOut'
      }, 0);

      var img = fig.querySelector('img');
      if (img) {
        heroTL.to(img, {
          scale: 1,
          duration: 1.3,
          ease: 'power2.out'
        }, 0);
      }
    });

    var heroPlayed = false;
    function playHero() {
      if (heroPlayed) return;
      heroPlayed = true;
      if (shaderFallback) { clearTimeout(shaderFallback); shaderFallback = null; }

      // Reveal hero text with timed blur entrance
      if (heroLead) {
        gsap.set(heroLead, { opacity: 1 });
        blurEntranceEffect(heroLead);
      }
      if (heroIntro) {
        gsap.set(heroIntro, { opacity: 1 });
        blurEntranceEffect(heroIntro);
      }

      // Play image reveal
      heroTL.play();

      // Ensure any video elements inside hero figures start playing
      // (browsers may suspend autoplay on elements with clip-path hidden)
      heroImages.forEach(function (fig) {
        var vid = fig.querySelector('video');
        if (vid) vid.play().catch(function () {});
      });

      ScrollTrigger.refresh();
    }

    document.addEventListener('colab:shader-revealed', playHero, { once: true });

    var elapsed = performance.now();
    var remaining = Math.max(100, 3500 - elapsed);
    shaderFallback = setTimeout(playHero, remaining);

    /* ═══════════════════════════════════════════════════════════
       BELOW-FOLD IMAGES — ScrollTrigger reveals
       ═══════════════════════════════════════════════════════════ */

    // Grid cells — scroll-scrubbed clip reveal, top-left origin, per cell
    if (gridCells.length) {
      gridCells.forEach(function (cell) {
        gsap.set(cell, { clipPath: 'inset(0% 100% 100% 0%)' });
        var img = cell.querySelector('img');
        if (img) gsap.set(img, { scale: 1.15 });

        var tl = gsap.timeline({
          scrollTrigger: {
            trigger: cell,
            start: 'top 85%',
            end: 'center 40%',
            scrub: 0.8
          }
        });
        tl.to(cell, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.inOut' });
        if (img) tl.to(img, { scale: 1, ease: 'power2.out' }, 0);
        if (tl.scrollTrigger) triggers.push(tl.scrollTrigger);
      });
    }

    // Wide image — scroll-scrubbed clip reveal + parallax scrub
    if (wideImage) {
      gsap.set(wideImage, { clipPath: 'inset(0% 100% 100% 0%)' });
      var wideImg = wideImage.querySelector('img');
      if (wideImg) gsap.set(wideImg, { scale: 1.12 });

      var revealTL = gsap.timeline({
        scrollTrigger: {
          trigger: wideImage,
          start: 'top 80%',
          end: 'center 40%',
          scrub: 0.8
        }
      });
      revealTL.to(wideImage, { clipPath: 'inset(0% 0% 0% 0%)', ease: 'power2.inOut' });
      if (wideImg) revealTL.to(wideImg, { scale: 1.05, ease: 'power2.out' }, 0);
      if (revealTL.scrollTrigger) triggers.push(revealTL.scrollTrigger);

      if (wideImg) {
        var scrub = gsap.fromTo(wideImg,
          { yPercent: 4 },
          { yPercent: -4, ease: 'none',
            scrollTrigger: {
              trigger: '.studio-wide-row',
              start: 'top bottom',
              end: 'bottom top',
              scrub: true
            }
          }
        );
        if (scrub.scrollTrigger) triggers.push(scrub.scrollTrigger);
      }
    }

    // Lockup — simple fade-up
    if (lockup) {
      gsap.set(lockup, { opacity: 0, y: 40 });
      triggers.push(ScrollTrigger.create({
        trigger: lockup,
        start: 'top 92%',
        onEnter: function () {
          gsap.to(lockup, {
            opacity: 1, y: 0,
            duration: 1.0,
            ease: 'power2.out'
          });
        },
        once: true
      }));
    }

    ScrollTrigger.refresh();
  }

  /* ── Destroy ──────────────────────────────────────────────── */
  function destroy() {
    if (shaderFallback) { clearTimeout(shaderFallback); shaderFallback = null; }
    if (heroTL) { heroTL.kill(); heroTL = null; }
    triggers.forEach(function (st) { if (st && st.kill) st.kill(); });
    triggers = [];
    ScrollTrigger.getAll().forEach(function (st) { st.kill(); });
  }

  /* ── Public API ─────────────────────────────────────────── */
  window.colabScrollAbout = { init: init, destroy: destroy };

  /* ── Auto-init on direct page load ─────────────────────── */
  function waitForDeps(cb, attempts) {
    if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined' && window.colabLenis) return cb();
    if ((attempts || 0) > 120) return;
    setTimeout(function () { waitForDeps(cb, (attempts || 0) + 1); }, 50);
  }

  if (document.body && document.body.classList.contains('about-page')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { waitForDeps(init); });
    } else {
      waitForDeps(init);
    }
  }
}());
