/**
 * co:lab — Tesseract
 *
 * WebGL2 fragment-shader fractal energy core, mounted inside
 * [data-tesseract]. Replaces the previous particle globe.
 *
 * Now supports interactive dragging with momentum inertia.
 * Auto-rotates on a slow time-based orbit when not being dragged.
 * Survives Barba transitions via pause()/resume().
 */
(function () {
  'use strict';

  /* ============================================================
     SHADERS
     ============================================================ */
  var VS = '#version 300 es\n' +
      'in vec2 p;\n' +
      'void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  var FS = '#version 300 es\n' +
      'precision highp float;\n' +
      'out vec4 outColor;\n' +
      '\n' +
      'uniform vec2  iResolution;\n' +
      'uniform float iTime;\n' +
      'uniform vec2  iMouse;\n' +
      'uniform float iZoom;\n' +
      '\n' +
      'mat2 rot(float a){ return mat2(cos(a),sin(a),-sin(a),cos(a)); }\n' +
      'vec2 csqr(vec2 a){ return vec2(a.x*a.x - a.y*a.y, 2.0*a.x*a.y); }\n' +
      '\n' +
      '// fractal density field — adapted from S. Guillitte 2015 (CC BY-NC-SA)\n' +
      'float map(in vec3 p){\n' +
      '    float res = 0.0;\n' +
      '    vec3  c   = p;\n' +
      '    for(int i=0; i<8; ++i){\n' +
      '        p = 0.7*abs(p)/dot(p,p) - 0.7;\n' +
      '        p.yz = csqr(p.yz);\n' +
      '        p = p.zxy;\n' +
      '        res += exp(-19.0 * abs(dot(p,c)));\n' +
      '    }\n' +
      '    return res * 0.5;\n' +
      '}\n' +
      '\n' +
      'vec2 iBox(vec3 ro, vec3 rd, vec3 b){\n' +
      '    vec3 m = 1.0/rd;\n' +
      '    vec3 n = m*ro;\n' +
      '    vec3 k = abs(m)*b;\n' +
      '    vec3 t1 = -n - k;\n' +
      '    vec3 t2 = -n + k;\n' +
      '    float tN = max(max(t1.x,t1.y), t1.z);\n' +
      '    float tF = min(min(t2.x,t2.y), t2.z);\n' +
      '    if(tN > tF || tF < 0.0) return vec2(-1.0);\n' +
      '    return vec2(tN, tF);\n' +
      '}\n' +
      '\n' +
      'vec3 raymarch(vec3 ro, vec3 rd, vec2 tmm){\n' +
      '    float t = max(tmm.x, 0.0);\n' +
      '    float dt = 0.028;\n' +
      '    vec3 col = vec3(0.0);\n' +
      '    float c = 0.0;\n' +
      '    for(int i=0; i<72; i++){\n' +
      '        t += dt*exp(-2.0*c);\n' +
      '        if(t > tmm.y) break;\n' +
      '        c = map(ro + t*rd);\n' +
      '        col = 0.99*col + 0.10*vec3(c*c*c*0.55, c*1.20, c*1.25);\n' +
      '    }\n' +
      '    return col;\n' +
      '}\n' +
      '\n' +
      'void main(){\n' +
      '    vec2 q = gl_FragCoord.xy / iResolution.xy;\n' +
      '    vec2 p = -1.0 + 2.0*q;\n' +
      '    p.x *= iResolution.x / iResolution.y;\n' +
      '\n' +
      '    vec3 ro = iZoom * vec3(4.5);\n' +
      '    ro.yz *= rot(iMouse.y);\n' +
      '    ro.xz *= rot(iMouse.x + 0.12*iTime);\n' +
      '    vec3 ta = vec3(0.0);\n' +
      '    vec3 ww = normalize(ta - ro);\n' +
      '    vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));\n' +
      '    vec3 vv = normalize(cross(uu, ww));\n' +
      '    float focal = 2.5;\n' +
      '    vec3 rd = normalize(p.x*uu + p.y*vv + focal*ww);\n' +
      '\n' +
      '    vec3 col = vec3(0.0);\n' +
      '\n' +
      '    // outer cube rim glow\n' +
      '    float tc = max(-dot(ro, rd), 0.0);\n' +
      '    vec3  cp = ro + tc*rd;\n' +
      '    vec3  qd = abs(cp) - vec3(1.55);\n' +
      '    float sd = length(max(qd, 0.0)) + min(max(qd.x, max(qd.y, qd.z)), 0.0);\n' +
      '    float rim = exp(-max(sd, 0.0) * 2.2);\n' +
      '    col += rim * vec3(0.15, 0.55, 0.95) * 0.55;\n' +
      '\n' +
      '    // fractal energy core (bounded inside tesseract envelope)\n' +
      '    vec2 tmm = iBox(ro, rd, vec3(1.55));\n' +
      '    if(tmm.x > -0.5){\n' +
      '        col += raymarch(ro, rd, tmm);\n' +
      '    }\n' +
      '\n' +
      '    float vig = 1.0 - 0.38 * length(p * vec2(0.55, 0.72));\n' +
      '    col *= vig;\n' +
      '\n' +
      '    col = 0.65 * log(1.0 + col);\n' +
      '    col = clamp(col, 0.0, 1.0);\n' +
      '\n' +
      '    float a = clamp(max(col.r, max(col.g, col.b)) * 1.4, 0.0, 1.0);\n' +
      '    outColor = vec4(col * a, a);\n' +
      '}';

  /* ============================================================
     STATE
     ============================================================ */
  var wrap        = null;
  var canvas      = null;
  var gl          = null;
  var prog        = null;
  var uRes        = null;
  var uTime       = null;
  var uMouse      = null;
  var uZoom       = null;
  var rafId       = 0;
  var t0          = 0;
  var running     = false;
  var initialized = false;
  var resizeBound = false;

  /* ============================================================
     INTERACTION STATE — mirrors globe.js drag model exactly
     ============================================================
     The shader already bakes a constant idle spin into iMouse.x via
     `rot(iMouse.x + 0.12*iTime)`, so JS never needs to add its own
     auto-rotate. All we do here is accumulate a user-driven offset
     with momentum + friction that settles smoothly back to zero.
     Axis mapping matches the globe's feel:
       horizontal drag → rotationX (yaw, horizontal spin)
       vertical drag   → rotationY (pitch, tilt)
  */
  var interaction = {
    rotationX: 0,   // yaw  (horizontal spin offset)
    rotationY: 0,   // pitch (tilt offset)
    velX: 0,        // pitch velocity  (from vertical drag)
    velY: 0,        // yaw velocity    (from horizontal drag)
    isDragging: false,
    prevX: 0,
    prevY: 0
  };

  // Physics constants — matched to globe.js for identical feel
  var DRAG_SENSITIVITY = 0.005;   // same as globe.js
  var FRICTION         = 0.96;    // per-frame decay (heavier = longer coast)
  var SETTLE_LERP      = 0.009;   // how fast momentum blends back toward 0

  /* ============================================================
     UPDATE — called every frame from render loop
     ============================================================ */
  function updateInteraction() {
    if (interaction.isDragging) return;

    // Apply current velocity to rotation
    interaction.rotationX += interaction.velY;
    interaction.rotationY += interaction.velX;

    // Friction: decay velocity each frame
    interaction.velX *= FRICTION;
    interaction.velY *= FRICTION;

    // Blend both velocities back toward zero so the idle state is
    // just the shader's baked-in time spin — no JS drift.
    interaction.velX += (0 - interaction.velX) * SETTLE_LERP;
    interaction.velY += (0 - interaction.velY) * SETTLE_LERP;
  }

  /* ============================================================
     EVENT HANDLERS — mirrors globe.js pattern:
       • All listeners attach to WINDOW (the tesseract canvas is
         pointer-events:none and sits behind main, so we can't
         rely on canvas events at all).
       • On pointerdown, we check e.target: if the user clicked
         on an interactive element (link, button, scrolling
         project list, nav, open menu), we IGNORE it and let the
         content handle it normally. Otherwise, we start a
         tesseract drag.
     ============================================================ */

  // Elements that should swallow clicks/drags without rotating
  // the tesseract. Matches: links, buttons, the scrolling project
  // list, the nav, the menu overlay, any form control, and
  // anything explicitly tagged as interactive.
  var INTERACTIVE_SELECTOR =
    'a, button, input, textarea, select, label, ' +
    '.project-list, [data-scroll-list], ' +
    '.site-nav, .site-menu, .nav-toggle, ' +
    '[data-no-tesseract-drag]';

  function shouldIgnoreTarget(target) {
    if (!target || !target.nodeType) return true;
    // Skip while the menu overlay is open
    if (document.body.hasAttribute('data-menu-open')) return true;
    // Skip if the click landed on / inside any interactive element
    if (target.closest && target.closest(INTERACTIVE_SELECTOR)) return true;
    return false;
  }

  function onMouseDown(e) {
    // Only react to primary button
    if (e.button !== undefined && e.button !== 0) return;
    if (shouldIgnoreTarget(e.target)) return;
    interaction.isDragging = true;
    interaction.prevX = e.clientX;
    interaction.prevY = e.clientY;
    interaction.velX = 0;
    interaction.velY = 0;
    document.body.style.cursor = 'grabbing';
    // Suppress text selection / highlight while the user is rotating
    // the tesseract. Scoped to the drag lifetime only.
    document.body.classList.add('is-dragging-tesseract');
    // Clear any existing selection that was made just before mousedown.
    if (window.getSelection) {
      var sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    // preventDefault on mousedown stops the browser from starting a
    // text-selection drag. We only reach here after shouldIgnoreTarget
    // has cleared the target, so we are never blocking a real click
    // on a link, button, or form control.
    if (e.preventDefault) e.preventDefault();
  }

  function onMouseMove(e) {
    if (!interaction.isDragging) return;
    interaction.velY = -(e.clientX - interaction.prevX) * DRAG_SENSITIVITY;
    interaction.velX = (e.clientY - interaction.prevY) * DRAG_SENSITIVITY;
    interaction.rotationX += interaction.velY;
    interaction.rotationY += interaction.velX;
    interaction.prevX = e.clientX;
    interaction.prevY = e.clientY;
  }

  function onMouseUp() {
    if (!interaction.isDragging) return;
    interaction.isDragging = false;
    document.body.style.cursor = '';
    document.body.classList.remove('is-dragging-tesseract');
  }

  function onTouchStart(e) {
    if (!e.touches.length) return;
    if (shouldIgnoreTarget(e.target)) return;
    interaction.isDragging = true;
    interaction.velX = 0;
    interaction.velY = 0;
    interaction.prevX = e.touches[0].clientX;
    interaction.prevY = e.touches[0].clientY;
    document.body.classList.add('is-dragging-tesseract');
  }

  function onTouchMove(e) {
    if (!interaction.isDragging || !e.touches.length) return;
    interaction.velY = -(e.touches[0].clientX - interaction.prevX) * DRAG_SENSITIVITY;
    interaction.velX = (e.touches[0].clientY - interaction.prevY) * DRAG_SENSITIVITY;
    interaction.rotationX += interaction.velY;
    interaction.rotationY += interaction.velX;
    interaction.prevX = e.touches[0].clientX;
    interaction.prevY = e.touches[0].clientY;
  }

  function onTouchEnd() {
    if (!interaction.isDragging) return;
    interaction.isDragging = false;
    document.body.classList.remove('is-dragging-tesseract');
  }

  /* ============================================================
     COMPILE / LINK
     ============================================================ */
  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error('[tesseract] shader compile failed:', gl.getShaderInfoLog(s));
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  function buildProgram() {
    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return false;

    prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'p');
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('[tesseract] link failed:', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    /* fullscreen triangle */
    var vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    uRes   = gl.getUniformLocation(prog, 'iResolution');
    uTime  = gl.getUniformLocation(prog, 'iTime');
    uMouse = gl.getUniformLocation(prog, 'iMouse');
    uZoom  = gl.getUniformLocation(prog, 'iZoom');
    return true;
  }

  /* ============================================================
     RESIZE
     ============================================================ */
  function resize() {
    if (!canvas || !gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.max(1, Math.floor(canvas.clientWidth  * dpr));
    var h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width  = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  /* ============================================================
     RENDER LOOP
     ============================================================ */
  function frame() {
    if (!running) return;
    resize();

    var t = (performance.now() - t0) * 0.001;

    // Update interaction physics
    updateInteraction();

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, interaction.rotationX, interaction.rotationY);
    gl.uniform1f(uZoom, 1.0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    rafId = requestAnimationFrame(frame);
  }

  /* ============================================================
     CONTEXT LOSS HANDLING
     ============================================================ */
  function onContextLost(e) {
    e.preventDefault();
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function onContextRestored() {
    if (!buildProgram()) return;
    resize();
    if (!rafId) {
      running = true;
      rafId = requestAnimationFrame(frame);
    }
  }

  /* ============================================================
     EVENT BINDING/UNBINDING
     ============================================================ */
  function bindEvents() {
    // All events on window — the canvas is pointer-events:none
    // and sits behind <main>, so canvas-bound events never fire.
    // We filter by e.target in the down handlers instead.
    window.addEventListener('mousedown', onMouseDown, false);
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('mouseup',   onMouseUp,   false);

    window.addEventListener('touchstart',  onTouchStart, { passive: true });
    window.addEventListener('touchmove',   onTouchMove,  { passive: true });
    window.addEventListener('touchend',    onTouchEnd,   { passive: true });
    window.addEventListener('touchcancel', onTouchEnd,   { passive: true });
  }

  function unbindEvents() {
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',   onMouseUp);

    window.removeEventListener('touchstart',  onTouchStart);
    window.removeEventListener('touchmove',   onTouchMove);
    window.removeEventListener('touchend',    onTouchEnd);
    window.removeEventListener('touchcancel', onTouchEnd);

    document.body.style.cursor = '';
    document.body.classList.remove('is-dragging-tesseract');
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    if (initialized) {
      /* Already mounted — just make sure it's running */
      if (!running) resume();
      return;
    }

    wrap = document.querySelector('[data-tesseract]');
    if (!wrap) return;

    canvas = document.createElement('canvas');
    canvas.className = 'tesseract-canvas';
    wrap.appendChild(canvas);

    gl = canvas.getContext('webgl2', {
      alpha:               true,
      antialias:           false,
      premultipliedAlpha:  true,
      powerPreference:     'high-performance'
    });

    if (!gl) {
      console.warn('[tesseract] WebGL2 not available — visual disabled');
      wrap.removeChild(canvas);
      canvas = null;
      return;
    }

    canvas.addEventListener('webglcontextlost',     onContextLost,     false);
    canvas.addEventListener('webglcontextrestored', onContextRestored, false);

    if (!buildProgram()) {
      destroy();
      return;
    }

    if (!resizeBound) {
      window.addEventListener('resize', resize);
      resizeBound = true;
    }

    // Bind interaction events — homepage only. The project page
    // has the depth gallery, video lightbox, and related-projects
    // rail, and we don't want window-level drag detection
    // interfering with any of those.
    if (!document.body.classList.contains('project-page')) {
      bindEvents();
    }

    resize();
    t0 = performance.now();
    initialized = true;
    running = true;
    rafId = requestAnimationFrame(frame);
  }

  /* ============================================================
     PAUSE / RESUME / RESET / DESTROY
     ============================================================ */
  function pause() {
    if (!running) return;
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  function resume() {
    if (!initialized || running) return;
    running = true;
    /* Reset t0 so the auto-orbit doesn't jump after a long pause */
    t0 = performance.now() - ((performance.now() - t0) % 100000);
    rafId = requestAnimationFrame(frame);
  }

  function reset() {
    // Reset interaction state
    interaction.rotationX = 0;
    interaction.rotationY = 0;
    interaction.velX = 0;
    interaction.velY = 0;
    interaction.isDragging = false;
  }

  function destroy() {
    pause();
    unbindEvents();

    if (canvas) {
      canvas.removeEventListener('webglcontextlost',     onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    }
    if (resizeBound) {
      window.removeEventListener('resize', resize);
      resizeBound = false;
    }
    canvas = null;
    gl     = null;
    prog   = null;
    wrap   = null;
    initialized = false;
  }

  /* ============================================================
     PUBLIC API
     ============================================================ */
  window.colabTesseract = {
    init:    init,
    pause:   pause,
    resume:  resume,
    reset:   reset,
    destroy: destroy
  };

  /* ============================================================
     AUTO-BOOT
     ============================================================ */
  function autoBoot() {
    if (document.querySelector('[data-tesseract]')) init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoBoot);
  } else {
    autoBoot();
  }

}());