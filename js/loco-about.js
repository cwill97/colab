(function () {
  'use strict';

  var scroll = null;

  function init() {
    destroy();

    var el = document.querySelector('[data-scroll-container]');
    if (!el || typeof LocomotiveScroll === 'undefined') return;

    scroll = new LocomotiveScroll({
      el: el,
      smooth: true,
      lerp: 0.1,
      multiplier: 1.0,
      class: 'is-inview',
      smartphone: { smooth: true },
      tablet: { smooth: true, breakpoint: 768 }
    });

    window.colabLocoScroll = scroll;
  }

  function destroy() {
    if (scroll) {
      scroll.destroy();
      scroll = null;
    }
    window.colabLocoScroll = null;
  }

  function waitForLib(cb, attempts) {
    if (typeof LocomotiveScroll !== 'undefined') return cb();
    if ((attempts || 0) > 40) return;
    setTimeout(function () { waitForLib(cb, (attempts || 0) + 1); }, 50);
  }

  window.colabLocoAbout = { init: init, destroy: destroy };

  if (document.body && document.body.classList.contains('about-page')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { waitForLib(init); });
    } else {
      waitForLib(init);
    }
  }
}());
