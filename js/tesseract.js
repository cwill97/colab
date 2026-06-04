document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    pause();
  } else {
    resume();
  }
});


(function () {
  'use strict';

  /* ============================================================
     SHADERS
     ============================================================ */
  var VS = '#version 300 es\n' +
      'in vec2 p;\n' +
      'void main(){ gl_Position = vec4(p, 0.0, 1.0); }';

  /* Per-tier #defines are injected after the precision line at build
     time. The placeholder comment is replaced in buildProgram(). */
  var FS = '#version 300 es\n' +
      'precision highp float;\n' +
      '//[TIER_DEFINES]\n' +
      'out vec4 outColor;\n' +
      '\n' +
      'uniform vec2  iResolution;\n' +
      'uniform float iTime;\n' +
      'uniform vec2  iMouse;\n' +
      'uniform float iZoom;\n' +
      'uniform float iImpact;\n' +
      'uniform float iHeat;\n' +
      'uniform float iProximity;\n' +
      '\n' +
      'mat2 rot(float a){ return mat2(cos(a),sin(a),-sin(a),cos(a)); }\n' +
      'vec2 csqr(vec2 a){ return vec2(a.x*a.x - a.y*a.y, 2.0*a.x*a.y); }\n' +
      '\n' +
      '// fractal density field — adapted from S. Guillitte 2015 (CC BY-NC-SA)\n' +
      'float map(in vec3 p){\n' +
      '    float res = 0.0;\n' +
      '    vec3  c   = p;\n' +
      '    float fold = 0.7 + iProximity * 0.01;\n' +
      '    for(int i=0; i<FRACTAL_ITERS; ++i){\n' +
      '        p = fold*abs(p)/dot(p,p) - fold;\n' +
      '        p.yz = csqr(p.yz);\n' +
      '        p = p.zxy;\n' +
      '        res += exp(-22.0 * abs(dot(p,c)));\n' +
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
      '    // cool (idle) → hot (fast drag) color palette\n' +
      '    vec3 coolR = vec3(1.30, 0.85, 1.45);  // blue-cyan\n' +
      '    vec3 hotR  = vec3(0.55, 1.10, 1.45);  // violet-white\n' +
      '    vec3 tint  = mix(coolR, hotR, iHeat);\n' +
      '    for(int i=0; i<RAYMARCH_STEPS; i++){\n' +
      '        t += dt*exp(-2.0*c);\n' +
      '        if(t > tmm.y) break;\n' +
      '        c = map(ro + t*rd);\n' +
      '        col = 0.99*col + 0.15*vec3(c*c*c*tint.x, c*tint.y, c*tint.z);\n' +
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
      '    ro.xz *= rot(iMouse.x - 0.12*iTime);\n' +
      '    vec3 ta = vec3(0.0);\n' +
      '    vec3 ww = normalize(ta - ro);\n' +
      '    vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));\n' +
      '    vec3 vv = normalize(cross(uu, ww));\n' +
      '    float focal = 2.5;\n' +
      '    vec3 rd = normalize(p.x*uu + p.y*vv + focal*ww);\n' +
      '\n' +
      '    vec3 col = vec3(0.0);\n' +
      '\n' +
      '    // dimensional bleed — proximity expands containment\n' +
      '    float bounds = 1.50 + iProximity * 0.15;\n' +
      '\n' +
      '    // outer cube rim glow\n' +
      '    float tc = max(-dot(ro, rd), 0.0);\n' +
      '    vec3  cp = ro + tc*rd;\n' +
      '    vec3  qd = abs(cp) - vec3(bounds);\n' +
      '    float sd = length(max(qd, 0.0)) + min(max(qd.x, max(qd.y, qd.z)), 0.0);\n' +
      '    // soften rim edge as it bleeds outward\n' +
      '    float rimFall = mix(2.2, 1.4, iProximity);\n' +
      '    float rim = exp(-max(sd, 0.0) * rimFall);\n' +
      '    float impBoost = 1.0 + iImpact * 1.5;\n' +
      '    col += rim * vec3(0.15, 0.55, 0.95) * 0.55 * impBoost;\n' +
      '    // shift rim toward white-hot on impact\n' +
      '    col += rim * vec3(0.45, 0.25, 0.05) * iImpact * 1.5;\n' +
      '\n' +
      '    // fractal energy core (bounded inside tesseract envelope)\n' +
      '    vec2 tmm = iBox(ro, rd, vec3(bounds));\n' +
      '    if(tmm.x > -0.5){\n' +
      '        col += raymarch(ro, rd, tmm) * impBoost;\n' +
      '    }\n' +
      '\n' +
      '    float vig = 1.0 - 0.38 * length(p * vec2(0.55, 0.72));\n' +
      '    col *= vig;\n' +
      '\n' +
      '    col = 0.70 * log(1.0 + col);\n' +
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
  var uImpact     = null;
  var uHeat       = null;
  var uProximity  = null;
  var rafId       = 0;
  var t0          = 0;
  var running     = false;
  var initialized = false;
  var resizeBound = false;

  /* ============================================================
     ADAPTIVE QUALITY
     Three tiers swap the fractal iteration count, raymarch step
     count, and devicePixelRatio cap. Tier is picked once at init
     from GPU + CPU + memory + viewport signals, and can be
     overridden at runtime via window.colabTesseract.setTier().
     ============================================================ */
  var TIER_CONFIG = {
    high:   { fractalIters: 6, raymarchSteps: 32, dprCap: 1.5 },
    medium: { fractalIters: 6, raymarchSteps: 28, dprCap: 1.5 },
    low:    { fractalIters: 5, raymarchSteps: 22, dprCap: 1.25 }
  };
  var currentTier = 'medium';  // safe default until detection runs

  function detectTier(glCtx) {
    /* Respect explicit user preference */
    try {
      if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return 'low';
      }
    } catch (e) {}

    var ua       = (navigator.userAgent || '').toLowerCase();
    var isIPad   = /ipad/.test(ua) || (navigator.maxTouchPoints > 1 && /macintosh/.test(ua));
    var isIPhone = /iphone/.test(ua);
    var isMobile = /android|iphone|ipod|webos|blackberry|iemobile|opera mini/.test(ua) || isIPad;
    var cores    = navigator.hardwareConcurrency || 4;
    var mem      = navigator.deviceMemory       || 4;

    var renderer = '';
    try {
      var ext = glCtx.getExtension('WEBGL_debug_renderer_info');
      if (ext) renderer = String(glCtx.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase();
    } catch (e) {}

    var isAppleSilicon = /apple\s*m\d/.test(renderer);
    var isHighGPU      = /(rtx\s*[2-9]|geforce\s*(?:rtx|gtx\s*1[06-9])|radeon\s*(?:rx\s*[6-9]|pro\s*[5-9]))/.test(renderer);
    var isLowGPU       = /(intel.*(?:hd\s*graphics\s*[3-5]|hd\s*graphics$|gma)|mali-[gt]\s*\d|adreno\s*[345]\d{2}|powervr)/.test(renderer);

    if (isMobile) {
      /* iPhone — always full quality. The browser can't read the iPhone
         model (iOS masks the GPU string to "Apple GPU" and withholds
         deviceMemory), and modern iOS hardware handles the shader well.
         The prefers-reduced-motion check above still wins for a11y. */
      if (isIPhone) return 'high';
      /* iPad + Apple-silicon tablets are GPU-rich — full quality too. */
      if (isIPad || isAppleSilicon) return 'high';
      /* Android with a known weak GPU — minimum tier. */
      if (isLowGPU) return 'low';
      /* Mid-range Android — be generous, raymarch is the only real cost. */
      if (cores >= 6 && mem >= 4) return 'medium';
      return 'low';
    }

    if (isAppleSilicon || isHighGPU) return 'high';
    if (isLowGPU) return 'low';
    if (cores >= 8 && mem >= 8) return 'high';
    if (cores >= 4 && mem >= 4) return 'medium';
    return 'low';
  }

  /* ============================================================
     PROXIMITY — cursor distance from center drives fractal
     mutation and dimensional bleed
     ============================================================ */
  var PROX_LERP      = 0.12;   // per-frame blend toward target
  var proximityVal   = 0.0;    // current interpolated proximity (0–1)
  var targetProx     = 0.0;    // where we're heading
  var cursorInside   = false;  // is cursor within the hit zone?

  /* ============================================================
     IMPACT PULSE — click/tap fires a flare that decays
     ============================================================ */
  var IMPACT_DECAY  = 0.93;   // per-frame multiplier (lower = faster fade)
  var impactVal     = 0.0;    // current impact intensity (0–1)

  /* ============================================================
     DRAG HEAT — velocity magnitude drives color temperature
     ============================================================ */
  var HEAT_GAIN     = 6.0;    // how fast drag velocity builds heat
  var HEAT_DECAY    = 0.850;  // per-frame decay back to cool (closer to 1 = slower)
  var heatVal       = 0.0;    // current heat (0 = cool blue, 1 = white-hot)

  /* ============================================================
     INTERACTION STATE
     ============================================================
     The shader already bakes a constant idle spin into iMouse.x via
     `rot(iMouse.x + 0.12*iTime)`, so JS never needs to add its own
     auto-rotate. All we do here is accumulate a user-driven offset
     with momentum + friction that settles smoothly back to zero.
     Axis mapping:
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

  // Physics constants — tuned for hand-feel
  var DRAG_SENSITIVITY = 0.004;
  var FRICTION         = 0.98;    // per-frame decay (heavier = longer coast)
  var SETTLE_LERP      = 0.009;   // how fast momentum blends back toward 0

  /* ============================================================
     UPDATE — called every frame from render loop
     ============================================================ */
  function updateInteraction() {
    if (!interaction.isDragging) {
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

    // Proximity — lerp toward target
    proximityVal += (targetProx - proximityVal) * PROX_LERP;

    // Impact pulse — exponential decay toward zero
    if (impactVal > 0.001) {
      impactVal *= IMPACT_DECAY;
    } else {
      impactVal = 0.0;
    }

    // Drag heat — velocity magnitude drives color temperature
    var speed = Math.sqrt(interaction.velX * interaction.velX +
                          interaction.velY * interaction.velY);
    if (interaction.isDragging && speed > 0.0001) {
      heatVal = Math.min(heatVal + speed * HEAT_GAIN, 1.0);
    } else {
      heatVal *= HEAT_DECAY;
      if (heatVal < 0.001) heatVal = 0.0;
    }
  }

  /* ============================================================
     EVENT HANDLERS
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

  /**
   * Geometric hit-zone: only start a drag if the pointer is within
   * the tesseract's visible footprint. The shader renders a cube
   * (half-size 1.55) at camera distance 4.5 with focal 2.5, so the
   * silhouette projects to p ≈ 0.917 of half-viewport-height — i.e.
   * a centered square of ~0.92 × viewport-height. We use a centered
   * square of side = min(vw, vh), which is slightly generous so the
   * outer rim glow stays grabbable, and collapses sensibly on
   * portrait viewports where vh > vw.
   */
  function isWithinTesseractHitZone(clientX, clientY) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var half = Math.min(vw, vh) * 0.5;
    var dx = clientX - vw * 0.5;
    var dy = clientY - vh * 0.5;
    return Math.abs(dx) <= half && Math.abs(dy) <= half;
  }

  /** Compute proximity: 1 = cursor at center, 0 = at edge or beyond */
  function computeProximity(clientX, clientY) {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var dx = clientX - vw * 0.5;
    var dy = clientY - vh * 0.5;
    var dist = Math.sqrt(dx * dx + dy * dy);
    var radius = Math.min(vw, vh) * 0.5;
    var t = Math.min(dist / radius, 1.0);
    // Quadratic ease — intense near center, gentle at edges
    return (1.0 - t) * (1.0 - t);
  }

  function onMouseDown(e) {
    // Only react to primary button
    if (e.button !== undefined && e.button !== 0) return;
    if (shouldIgnoreTarget(e.target)) return;
    if (!isWithinTesseractHitZone(e.clientX, e.clientY)) return;

    // ── Impact pulse ──
    impactVal = 0.30;

    interaction.isDragging = true;
    interaction.prevX = e.clientX;
    interaction.prevY = e.clientY;
    interaction.velX = 0;
    interaction.velY = 0;
    document.body.style.cursor = 'grabbing';
    document.body.classList.add('is-dragging-tesseract');
    if (window.getSelection) {
      var sel = window.getSelection();
      if (sel && sel.removeAllRanges) sel.removeAllRanges();
    }
    if (e.preventDefault) e.preventDefault();
  }

  function onMouseMove(e) {
    // ── Proximity (always, even when not dragging) ──
    if (isWithinTesseractHitZone(e.clientX, e.clientY)) {
      cursorInside = true;
      targetProx = computeProximity(e.clientX, e.clientY);
    } else {
      cursorInside = false;
      targetProx = 0.0;
    }

    // ── Drag rotation ──
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

  function onMouseLeave() {
    cursorInside = false;
    targetProx = 0.0;
  }

  function onTouchStart(e) {
    if (!e.touches.length) return;
    if (shouldIgnoreTarget(e.target)) return;
    var t = e.touches[0];
    if (!isWithinTesseractHitZone(t.clientX, t.clientY)) return;

    // ── Impact pulse ──
    impactVal = 1.0;

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
    var T = TIER_CONFIG[currentTier];
    var fsSrc = FS.replace(
      '//[TIER_DEFINES]',
      '#define FRACTAL_ITERS '   + T.fractalIters + '\n' +
      '#define RAYMARCH_STEPS '  + T.raymarchSteps
    );
    var vs = compile(gl.VERTEX_SHADER, VS);
    var fs = compile(gl.FRAGMENT_SHADER, fsSrc);
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

    uRes    = gl.getUniformLocation(prog, 'iResolution');
    uTime   = gl.getUniformLocation(prog, 'iTime');
    uMouse  = gl.getUniformLocation(prog, 'iMouse');
    uZoom   = gl.getUniformLocation(prog, 'iZoom');
    uImpact = gl.getUniformLocation(prog, 'iImpact');
    uHeat   = gl.getUniformLocation(prog, 'iHeat');
    uProximity = gl.getUniformLocation(prog, 'iProximity');
    return true;
  }

  /* ============================================================
     RESIZE
     ============================================================ */
  function resize() {
    if (!canvas || !gl) return;
    var dpr = Math.min(window.devicePixelRatio || 1, TIER_CONFIG[currentTier].dprCap);
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
     ------------------------------------------------------------
     The tesseract is a slow ambient orbit — it does NOT need to
     redraw at the panel's native refresh. We cap the fullscreen
     raymarch to ~40fps (≈30fps on 60Hz panels, ~40 on 120Hz
     ProMotion), which roughly halves GPU load with no perceptible
     change to the idle motion. The rAF keeps ticking at full rate
     so the pause/menu checks stay responsive; only the expensive
     draw is throttled.
     ============================================================ */
  var FRAME_INTERVAL = 1000 / 40;
  var lastDraw       = 0;

  function frame() {
    if (!running) return;
    rafId = requestAnimationFrame(frame);

    /* Nothing of the tesseract is visible while the nav menu overlay
       covers the screen — skip the fullscreen raymarch entirely. */
    if (document.body.hasAttribute('data-menu-open')) return;

    var now = performance.now();
    if (now - lastDraw < FRAME_INTERVAL - 1) return;
    lastDraw = now;

    resize();

    var t = (now - t0) * 0.001;

    // Update interaction physics
    updateInteraction();

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, interaction.rotationX, interaction.rotationY);
    gl.uniform1f(uZoom, 1.0);
    gl.uniform1f(uImpact, impactVal);
    gl.uniform1f(uHeat, heatVal);
    gl.uniform1f(uProximity, proximityVal);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
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
    document.addEventListener('mouseleave', onMouseLeave, false);

    window.addEventListener('touchstart',  onTouchStart, { passive: true });
    window.addEventListener('touchmove',   onTouchMove,  { passive: true });
    window.addEventListener('touchend',    onTouchEnd,   { passive: true });
    window.addEventListener('touchcancel', onTouchEnd,   { passive: true });
  }

  function unbindEvents() {
    window.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup',   onMouseUp);
    document.removeEventListener('mouseleave', onMouseLeave);

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

    /* Pick an adaptive-quality tier from device signals BEFORE
       compiling the shader — the tier injects #define macros that
       set the fractal iteration and raymarch step counts. */
    currentTier = detectTier(gl);

    if (!buildProgram()) {
      destroy();
      return;
    }

    if (!resizeBound) {
      window.addEventListener('resize', resize);
      resizeBound = true;
    }

    // Bind interaction events — homepage only. The project page
    // has the depth gallery and video lightbox, and we don't want
    // window-level drag detection interfering with either.
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
    interaction.rotationX = 0;
    interaction.rotationY = 0;
    interaction.velX = 0;
    interaction.velY = 0;
    interaction.isDragging = false;
    proximityVal = 0.0;
    targetProx   = 0.0;
    cursorInside = false;
    impactVal    = 0.0;
    heatVal      = 0.0;
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
  function setTier(t) {
    if (!TIER_CONFIG[t] || t === currentTier) return false;
    currentTier = t;
    if (gl && initialized) {
      if (prog) gl.deleteProgram(prog);
      if (!buildProgram()) return false;
      resize();
    }
    return true;
  }

  window.colabTesseract = {
    init:    init,
    pause:   pause,
    resume:  resume,
    reset:   reset,
    destroy: destroy,
    getTier: function () { return currentTier; },
    setTier: setTier
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
