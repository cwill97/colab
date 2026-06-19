/* ============================================================
   GridDistort — canvas grid-zoom hover effect.
   The image is divided into a grid; each box samples a zoomed
   portion of the image scaled by its distance from the cursor,
   creating a ripple-like magnification that trails the mouse.
   Dots at grid corners scale with the distortion.
   Technique by Tom Miller / creativeocean (codepen emBOove).
   Desktop only. Requires GSAP.
   ============================================================ */
(function (global) {
  'use strict';

  var TWO_PI = Math.PI * 2;

  function GridDistort(fig) {
    this.fig        = fig;
    this.canvas     = null;
    this.ctx        = null;
    this._img       = null;
    this._imgReady  = false;
    this.boxes      = [];
    this.cw         = 600;
    this.ch         = 832;   /* matches 888×1232 portrait ratio */
    this.boxSize    = 40;
    this.m          = { x: 300, y: 416, s: 0, x2: 300, y2: 416 };
    this.xTo        = null;
    this.yTo        = null;
    this.sTo        = null;
    this._figRect   = null;
    this._sx        = 1;
    this._sy        = 1;
    this.running    = false;
    this.rafId      = null;
    this._leaveAt   = null;
    this._hiding    = false;

    this._tick         = this._tick.bind(this);
    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onMouseEnter = this._onMouseEnter.bind(this);
    this._onMouseLeave = this._onMouseLeave.bind(this);
    this._onResize     = this._onResize.bind(this);
  }

  GridDistort.prototype.init = function (imgSrc) {
    var self = this;
    var cw = this.cw, ch = this.ch;

    if (window.getComputedStyle(this.fig).position === 'static') {
      this.fig.style.position = 'relative';
    }

    var canvas = document.createElement('canvas');
    canvas.width  = cw;
    canvas.height = ch;
    canvas.style.cssText = [
      'position:absolute', 'inset:0', 'width:100%', 'height:100%',
      'display:block', 'pointer-events:none',
      'opacity:0', 'transition:opacity 0.35s ease'
    ].join(';');
    this.fig.appendChild(canvas);
    this.canvas = canvas;

    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    this.ctx = ctx;

    this.m.x = this.m.x2 = cw / 2;
    this.m.y = this.m.y2 = ch / 2;

    if (typeof gsap !== 'undefined') {
      this.xTo = gsap.quickTo(this.m, 'x', { duration: 1,   ease: 'expo' });
      this.yTo = gsap.quickTo(this.m, 'y', { duration: 1,   ease: 'expo' });
      this.sTo = gsap.quickTo(this.m, 's', { duration: 2,   ease: 'power2' });
    }

    /* Load image — no crossOrigin per /sanity/* proxy rules */
    var img = new Image();
    img.onload = function () {
      self._img      = img;
      self._imgReady = true;
      self._buildGrid();
    };
    img.src = imgSrc;

    this._updateRect();
    this.fig.addEventListener('mouseenter', this._onMouseEnter);
    this.fig.addEventListener('mouseleave', this._onMouseLeave);
    this.fig.addEventListener('mousemove',  this._onMouseMove);
    window.addEventListener('resize',       this._onResize);
  };

  GridDistort.prototype._buildGrid = function () {
    this.boxes = [];
    var cw = this.cw, ch = this.ch, bs = this.boxSize;
    for (var x = 0; x <= cw; x += bs) {
      for (var y = 0; y <= ch; y += bs) {
        this.boxes.push({ x: x, y: y, d: 0, s: 0 });
      }
    }
  };

  GridDistort.prototype._updateRect = function () {
    this._figRect = this.fig.getBoundingClientRect();
    this._sx = this.cw / this._figRect.width;
    this._sy = this.ch / this._figRect.height;
  };

  GridDistort.prototype._onMouseEnter = function () {
    if (!this._imgReady) return;
    this._leaveAt = null;
    this._hiding  = false;
    if (!this.running) {
      this.running = true;
      this.canvas.style.opacity = '1';
      this._tick();
    }
  };

  GridDistort.prototype._onMouseLeave = function () {
    /* Ease cursor back to centre — effect dissolves as m.s → 0 */
    if (this.xTo) { this.xTo(this.cw / 2); this.yTo(this.ch / 2); }
    this.m.x2 = this.cw / 2;
    this.m.y2 = this.ch / 2;
    this._leaveAt = Date.now();
  };

  GridDistort.prototype._onMouseMove = function (e) {
    var r = this._figRect;
    this.m.x2 = (e.clientX - r.left) * this._sx;
    this.m.y2 = (e.clientY - r.top)  * this._sy;
    if (this.xTo) { this.xTo(this.m.x2); this.yTo(this.m.y2); }
    this._leaveAt = null;
  };

  GridDistort.prototype._onResize = function () {
    this._updateRect();
  };

  GridDistort.prototype._tick = function () {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    var m   = this.m;
    var ctx = this.ctx;
    var img = this._img;
    var cw  = this.cw, ch = this.ch;
    var self = this;

    var d = Math.hypot(m.x - m.x2, m.y - m.y2);
    if (this.sTo) this.sTo(d / cw * 2);

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, 0, 0, cw, ch, 0, 0, cw, ch);

    this.boxes.forEach(function (b) { self._drawBox(b); });

    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    this.boxes.forEach(function (b) { self._drawDot(b); });

    /* Fade out and stop once the effect has fully settled post-leave */
    if (!this._hiding && this._leaveAt &&
        Date.now() - this._leaveAt > 1200 && m.s < 0.005) {
      this._hiding = true;
      this.canvas.style.opacity = '0';
      var self2 = this;
      setTimeout(function () {
        self2.running = false;
        if (self2.rafId) { cancelAnimationFrame(self2.rafId); self2.rafId = null; }
        self2._hiding = false;
      }, 380);
    }
  };

  GridDistort.prototype._drawBox = function (b) {
    var m = this.m, bs = this.boxSize, cw = this.cw;
    b.d = Math.hypot(b.x - m.x, b.y - m.y);
    b.s = (m.s > 0.001)
      ? 1 - gsap.utils.clamp(0, 1, b.d / cw / m.s)
      : 0;
    if (b.s < 0.001) return;
    var sc      = bs * b.s;
    var srcSize = Math.max(bs - sc, 1); /* guard against drawImage(…,0,…) error */
    this.ctx.drawImage(
      this._img,
      b.x + sc / 2, b.y + sc / 2, srcSize, srcSize,
      b.x, b.y, bs, bs
    );
  };

  GridDistort.prototype._drawDot = function (b) {
    if (b.s < 0.001) return;
    this.ctx.beginPath();
    this.ctx.arc(b.x, b.y, this.boxSize * 0.15 * b.s, 0, TWO_PI);
    this.ctx.fill();
  };

  GridDistort.prototype.destroy = function () {
    this.running = false;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.fig.removeEventListener('mouseenter', this._onMouseEnter);
    this.fig.removeEventListener('mouseleave', this._onMouseLeave);
    this.fig.removeEventListener('mousemove',  this._onMouseMove);
    window.removeEventListener('resize',       this._onResize);
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx    = null;
    this._img   = null;
    this.xTo = this.yTo = this.sTo = null;
  };

  global.GridDistort = GridDistort;
}(window));
