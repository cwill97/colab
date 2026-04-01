/**
 * co:lab — Menu Fluid Ripple (GPU Wave Simulation)
 *
 * Physically-based 2D water simulation using ping-pong FBOs.
 * Each frame the GPU propagates waves via the discrete wave equation.
 * Cursor/touch drops "splats" into the heightmap.
 * A display shader refracts the menu background + content through
 * the resulting displacement map — text and everything underneath
 * warps like it's behind a sheet of water.
 *
 * Technique: Lusion Labs / sirxemic jquery.ripples style.
 */

(function () {
  'use strict';

  /* ── Config ── */
  var SIM_RESOLUTION = 256;    /* heightmap resolution (power of 2) */
  var DAMPING        = 0.985;  /* wave energy loss per step */
  var WAVE_SPEED     = 0.45;   /* propagation speed (delta in wave eq) */
  var DROP_RADIUS    = 0.04;   /* normalised radius of cursor drop */
  var PERTURBANCE    = 0.025;  /* refraction strength */
  var DROP_STRENGTH  = 0.15;   /* amplitude of each cursor drop */
  var MOVE_THRESHOLD = 4;      /* px of cursor movement to spawn drop */

  /* ── State ── */
  var menuEl    = null;
  var canvas    = null;
  var gl        = null;
  var running   = false;
  var rafId     = null;
  var inited    = false;

  /* WebGL resources */
  var simProgram, displayProgram, dropProgram;
  var fboA, fboB;     /* ping-pong framebuffers */
  var quadVAO;
  var texBackground;  /* rasterised menu snapshot */
  var bgCanvas;       /* offscreen canvas for text rasterisation */

  var prevMouseX = -1, prevMouseY = -1;
  var mouseX = -1, mouseY = -1;
  var menuRect = { left: 0, top: 0, width: 1, height: 1 };

  /* ── Shader sources ── */

  /* Shared fullscreen-quad vertex shader */
  var VERT = [
    'attribute vec2 aPosition;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPosition * 0.5 + 0.5;',
    '  gl_Position = vec4(aPosition, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* Wave simulation — reads previous 2 states from RG channels,
     propagates via discrete Laplacian, writes new state */
  var SIM_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec2 uDelta;',  /* 1/resolution */
    '',
    'void main() {',
    '  vec4 info = texture2D(uTexture, vUv);',
    '',
    '  /* Sample 4 neighbours */',
    '  float t = texture2D(uTexture, vUv + vec2(0.0, uDelta.y)).r;',
    '  float b = texture2D(uTexture, vUv - vec2(0.0, uDelta.y)).r;',
    '  float l = texture2D(uTexture, vUv - vec2(uDelta.x, 0.0)).r;',
    '  float r = texture2D(uTexture, vUv + vec2(uDelta.x, 0.0)).r;',
    '',
    '  /* Wave equation: new = (avg_neighbours * 2 - previous) * damping */',
    '  float avg = (t + b + l + r) * 0.5 - info.g;',
    '  avg *= ' + DAMPING.toFixed(4) + ';',
    '',
    '  /* Store: R = current height, G = previous height */',
    '  gl_FragColor = vec4(avg, info.r, 0.0, 1.0);',
    '}'
  ].join('\n');

  /* Drop shader — adds a circular splat to the heightmap */
  var DROP_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',
    'uniform vec2 uCenter;',
    'uniform float uRadius;',
    'uniform float uStrength;',
    '',
    'void main() {',
    '  vec4 info = texture2D(uTexture, vUv);',
    '  float dist = length(vUv - uCenter);',
    '  /* Smooth circular drop */',
    '  float drop = max(0.0, 1.0 - dist / uRadius);',
    '  drop = 0.5 - cos(drop * 3.14159) * 0.5;',
    '  info.r += drop * uStrength;',
    '  gl_FragColor = info;',
    '}'
  ].join('\n');

  /* Display shader — refracts background using heightmap normals */
  var DISPLAY_FRAG = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uTexture;',  /* heightmap */
    'uniform sampler2D uBackground;',
    'uniform vec2 uDelta;',
    '',
    'void main() {',
    '  vec4 info = texture2D(uTexture, vUv);',
    '',
    '  /* Compute normal from heightmap gradient */',
    '  float dx = texture2D(uTexture, vUv + vec2(uDelta.x, 0.0)).r',
    '           - texture2D(uTexture, vUv - vec2(uDelta.x, 0.0)).r;',
    '  float dy = texture2D(uTexture, vUv + vec2(0.0, uDelta.y)).r',
    '           - texture2D(uTexture, vUv - vec2(0.0, uDelta.y)).r;',
    '',
    '  /* Refract UV */',
    '  vec2 refractedUV = vUv + vec2(dx, dy) * ' + PERTURBANCE.toFixed(4) + ';',
    '',
    '  /* Sample background with refracted coordinates */',
    '  vec4 bg = texture2D(uBackground, refractedUV);',
    '',
    '  /* Subtle specular highlight on wave crests */',
    '  float specular = max(0.0, pow(max(abs(dx), abs(dy)) * 8.0, 3.0));',
    '  bg.rgb += vec3(0.6, 0.75, 1.0) * specular * 0.4;',
    '',
    '  gl_FragColor = bg;',
    '}'
  ].join('\n');

  /* ── WebGL helpers ── */

  function compileShader(src, type) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, src);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader error:', gl.getShaderInfoLog(shader));
      return null;
    }
    return shader;
  }

  function createProgram(vert, frag) {
    var vs = compileShader(vert, gl.VERTEX_SHADER);
    var fs = compileShader(frag, gl.FRAGMENT_SHADER);
    var prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.bindAttribLocation(prog, 0, 'aPosition');
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
    }
    return prog;
  }

  function createFBO(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* Try float textures first, fall back to half-float, then UNSIGNED_BYTE */
    var type = gl.FLOAT;
    var ext = gl.getExtension('OES_texture_float');
    if (!ext) {
      ext = gl.getExtension('OES_texture_half_float');
      type = ext ? ext.HALF_FLOAT_OES : gl.UNSIGNED_BYTE;
    }
    gl.getExtension('OES_texture_float_linear');

    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, type, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

    return { fbo: fbo, tex: tex };
  }

  function drawQuad() {
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVAO);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  /* ── Rasterise menu to texture ── */
  function rasteriseMenu() {
    if (!menuEl || !bgCanvas) return;
    menuRect = menuEl.getBoundingClientRect();
    var dpr = Math.min(window.devicePixelRatio, 2);
    var w = Math.round(menuRect.width * dpr);
    var h = Math.round(menuRect.height * dpr);
    if (w < 1 || h < 1) return;

    bgCanvas.width  = w;
    bgCanvas.height = h;
    var ctx = bgCanvas.getContext('2d');

    /* Dark background matching menu */
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, w, h);

    /* Render the DOM text content via html2canvas-lite approach:
       We paint text manually since we can't use html2canvas without a dep.
       Walk visible text nodes and draw them at their computed positions. */

    ctx.scale(dpr, dpr);

    var textEls = menuEl.querySelectorAll(
      '.menu-about p, .menu-footer-label, .menu-footer-col li'
    );

    textEls.forEach(function (el) {
      var r = el.getBoundingClientRect();
      var style = getComputedStyle(el);
      var x = r.left - menuRect.left;
      var y = r.top  - menuRect.top;

      ctx.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
      ctx.fillStyle = style.color;
      ctx.textBaseline = 'top';

      /* Handle text wrapping — split by lines based on element width */
      var words = el.textContent.split(' ');
      var line = '';
      var lineH = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.5;
      var maxW  = r.width;
      var curY  = y;

      for (var i = 0; i < words.length; i++) {
        var test = line + (line ? ' ' : '') + words[i];
        var metrics = ctx.measureText(test);
        if (metrics.width > maxW && line) {
          ctx.fillText(line, x, curY);
          line = words[i];
          curY += lineH;
        } else {
          line = test;
        }
      }
      if (line) ctx.fillText(line, x, curY);
    });

    /* Upload to WebGL texture */
    gl.bindTexture(gl.TEXTURE_2D, texBackground);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgCanvas);
  }

  /* ── Init WebGL ── */
  function initGL() {
    if (inited) return;
    menuEl = document.querySelector('[data-nav-menu]');
    if (!menuEl) return;

    canvas = document.createElement('canvas');
    canvas.className = 'menu-ripple-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;z-index:91;pointer-events:none;' +
      'width:100%;height:100%;display:none;';
    document.body.appendChild(canvas);

    gl = canvas.getContext('webgl', {
      alpha: true, premultipliedAlpha: false, antialias: false
    });
    if (!gl) { console.warn('menu-ripple: WebGL not available'); return; }

    /* Quad buffer */
    quadVAO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVAO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);

    /* Programs */
    simProgram     = createProgram(VERT, SIM_FRAG);
    dropProgram    = createProgram(VERT, DROP_FRAG);
    displayProgram = createProgram(VERT, DISPLAY_FRAG);

    /* FBOs — ping-pong pair */
    fboA = createFBO(SIM_RESOLUTION, SIM_RESOLUTION);
    fboB = createFBO(SIM_RESOLUTION, SIM_RESOLUTION);

    /* Background texture */
    texBackground = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texBackground);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    /* Offscreen canvas for text rasterisation */
    bgCanvas = document.createElement('canvas');

    /* Input */
    menuEl.addEventListener('mousemove', onPointer, { passive: true });
    menuEl.addEventListener('touchstart', onTouch, { passive: true });
    menuEl.addEventListener('touchmove', onTouch, { passive: true });
    menuEl.addEventListener('click', onClickDrop);

    inited = true;
  }

  /* ── Drop a splat into the heightmap ── */
  function addDrop(x, y, radius, strength) {
    if (!gl) return;

    gl.useProgram(dropProgram);

    gl.uniform1i(gl.getUniformLocation(dropProgram, 'uTexture'), 0);
    gl.uniform2f(gl.getUniformLocation(dropProgram, 'uCenter'), x, y);
    gl.uniform1f(gl.getUniformLocation(dropProgram, 'uRadius'), radius);
    gl.uniform1f(gl.getUniformLocation(dropProgram, 'uStrength'), strength);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    drawQuad();

    /* Swap */
    var tmp = fboA; fboA = fboB; fboB = tmp;
  }

  /* ── Step simulation ── */
  function stepSim() {
    gl.useProgram(simProgram);

    gl.uniform1i(gl.getUniformLocation(simProgram, 'uTexture'), 0);
    gl.uniform2f(gl.getUniformLocation(simProgram, 'uDelta'),
      1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fboB.fbo);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    drawQuad();

    var tmp = fboA; fboA = fboB; fboB = tmp;
  }

  /* ── Render display ── */
  function renderDisplay() {
    var W = canvas.width;
    var H = canvas.height;

    gl.useProgram(displayProgram);

    gl.uniform1i(gl.getUniformLocation(displayProgram, 'uTexture'), 0);
    gl.uniform1i(gl.getUniformLocation(displayProgram, 'uBackground'), 1);
    gl.uniform2f(gl.getUniformLocation(displayProgram, 'uDelta'),
      1.0 / SIM_RESOLUTION, 1.0 / SIM_RESOLUTION);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, fboA.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texBackground);

    drawQuad();
  }

  /* ── Input handlers ── */
  function onPointer(e) {
    menuRect = menuEl.getBoundingClientRect();
    var nx = (e.clientX - menuRect.left) / menuRect.width;
    var ny = 1.0 - (e.clientY - menuRect.top) / menuRect.height;

    var dx = e.clientX - prevMouseX;
    var dy = e.clientY - prevMouseY;
    if (Math.sqrt(dx*dx + dy*dy) > MOVE_THRESHOLD) {
      addDrop(nx, ny, DROP_RADIUS, DROP_STRENGTH);
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
    }
    mouseX = nx; mouseY = ny;
  }

  function onTouch(e) {
    var t = e.touches[0];
    if (!t) return;
    menuRect = menuEl.getBoundingClientRect();
    var nx = (t.clientX - menuRect.left) / menuRect.width;
    var ny = 1.0 - (t.clientY - menuRect.top) / menuRect.height;

    var dx = t.clientX - prevMouseX;
    var dy = t.clientY - prevMouseY;
    if (Math.sqrt(dx*dx + dy*dy) > MOVE_THRESHOLD) {
      addDrop(nx, ny, DROP_RADIUS * 1.2, DROP_STRENGTH * 1.5);
      prevMouseX = t.clientX;
      prevMouseY = t.clientY;
    }
  }

  function onClickDrop(e) {
    menuRect = menuEl.getBoundingClientRect();
    var nx = (e.clientX - menuRect.left) / menuRect.width;
    var ny = 1.0 - (e.clientY - menuRect.top) / menuRect.height;
    addDrop(nx, ny, DROP_RADIUS * 2.5, DROP_STRENGTH * 3);
  }

  /* ── Render loop ── */
  function tick() {
    if (!running) return;
    rafId = requestAnimationFrame(tick);

    /* Run 2 simulation steps per frame for faster propagation */
    stepSim();
    stepSim();

    renderDisplay();
  }

  /* ── Public API ── */
  function start() {
    if (!inited) initGL();
    if (!gl || !canvas) return;

    /* Resize canvas to window */
    var dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width  = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);

    /* Rasterise menu text after it's visible */
    canvas.style.display = 'block';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        rasteriseMenu();
        prevMouseX = -99; prevMouseY = -99;
        running = true;
        tick();
      });
    });
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (canvas) canvas.style.display = 'none';
  }

  window.colabMenuRipple = { start: start, stop: stop };

}());
