/* ============================================================
   WebGL fluid simulation overlay — desktop Studio (about) page.

   Navier-Stokes fluid solver adapted from Pavel Dobryakov's
   WebGL-Fluid-Simulation (MIT). Modifications for co:lab:
     • Monochrome dye (white/grey smoke) — no rainbow splats.
     • Mouse-driven only — no random/auto splats.
     • Transparent full-viewport overlay canvas, blended over
       all text + image content via CSS mix-blend-mode.
     • Desktop only (>=768px); skipped on touch/mobile.
     • Standard init/destroy lifecycle for Barba navigation.

   Original source: https://github.com/PavelDoGreat/WebGL-Fluid-Simulation
   ============================================================ */
(function () {
  'use strict';

  /* ── Tunable config ──────────────────────────────────────── */
  var CONFIG = {
    SIM_RESOLUTION:      128,
    DYE_RESOLUTION:      1024,
    DENSITY_DISSIPATION: 5.0,   /* how fast the smoke fades   */
    VELOCITY_DISSIPATION: 6.0,  /* how fast motion settles    */
    PRESSURE:            0.4,
    PRESSURE_ITERATIONS: 20,
    CURL:                8,      /* swirliness                 */
    SPLAT_RADIUS:        0.12,
    SPLAT_FORCE:         1500,
    SHADING:             true,
    Z_INDEX:             60,     /* above content (<=50), below nav (100) */
    INTENSITY:           0.4,    /* white smoke brightness     */

    /* ── Geometric warp of the hero (text + image) ── */
    WARP:            true,
    WARP_SELECTOR:   '[data-studio]',  /* full page content container */
    WARP_SCALE:      0.0005,  /* how hard the velocity field bends pixels */
    HERO_GAIN:       1.7,     /* boost the rasterized page's coverage     */
    SMOKE_ALPHA:     0.0,     /* smoke disabled                           */
    SNAPSHOT_DELAY:  900,     /* ms after hero entrance before snapshot   */
    HTML2CANVAS_SRC: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js'
  };
  /* Blend mode depends on warp: warp draws opaque hero pixels (normal),
     plain smoke uses screen so white lightens the dark page. */
  var BLEND_MODE = CONFIG.WARP ? 'normal' : 'screen';

  var canvas = null;
  var gl = null;
  var ext = null;
  var rafId = null;
  var running = false;
  var lastUpdateTime = 0;
  var pointers = [];
  var programs = {};
  var displayMaterial = null;
  var warpMaterial = null;
  var blit = null;
  var dye, velocity, divergenceFBO, curlFBO, pressureFBO;
  var boundHandlers = {};

  /* Warp state */
  var heroEl = null;
  var heroTexture = null;
  var heroReady = false;
  var heroRect = [0, 0, 1, 1];   /* x0, y0, x1, y1 in vUv (bottom-origin) space */
  var snapshotTimer = null;
  var resnapTimer = null;
  var hiddenHeroNodes = [];

  /* ── Pointer prototype ───────────────────────────────────── */
  function Pointer() {
    this.id = -1;
    this.texcoordX = 0;
    this.texcoordY = 0;
    this.prevTexcoordX = 0;
    this.prevTexcoordY = 0;
    this.deltaX = 0;
    this.deltaY = 0;
    this.down = false;
    this.moved = false;
  }

  /* ── WebGL context + extensions ──────────────────────────── */
  function getWebGLContext(c) {
    var params = { alpha: true, depth: false, stencil: false, antialias: false, preserveDrawingBuffer: false };
    var g = c.getContext('webgl2', params);
    var isWebGL2 = !!g;
    if (!isWebGL2) g = c.getContext('webgl', params) || c.getContext('experimental-webgl', params);
    if (!g) return null;

    var halfFloat, supportLinearFiltering;
    if (isWebGL2) {
      g.getExtension('EXT_color_buffer_float');
      supportLinearFiltering = g.getExtension('OES_texture_float_linear');
    } else {
      halfFloat = g.getExtension('OES_texture_half_float');
      supportLinearFiltering = g.getExtension('OES_texture_half_float_linear');
    }
    g.clearColor(0.0, 0.0, 0.0, 1.0);

    var halfFloatTexType = isWebGL2 ? g.HALF_FLOAT : (halfFloat && halfFloat.HALF_FLOAT_OES);
    var formatRGBA, formatRG, formatR;

    if (isWebGL2) {
      formatRGBA = getSupportedFormat(g, g.RGBA16F, g.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(g, g.RG16F,   g.RG,   halfFloatTexType);
      formatR    = getSupportedFormat(g, g.R16F,    g.RED,  halfFloatTexType);
    } else {
      formatRGBA = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
      formatRG   = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
      formatR    = getSupportedFormat(g, g.RGBA, g.RGBA, halfFloatTexType);
    }

    return {
      gl: g,
      ext: {
        formatRGBA: formatRGBA,
        formatRG: formatRG,
        formatR: formatR,
        halfFloatTexType: halfFloatTexType,
        supportLinearFiltering: supportLinearFiltering
      }
    };
  }

  function getSupportedFormat(g, internalFormat, format, type) {
    if (!supportRenderTextureFormat(g, internalFormat, format, type)) {
      switch (internalFormat) {
        case g.R16F:    return getSupportedFormat(g, g.RG16F, g.RG, type);
        case g.RG16F:   return getSupportedFormat(g, g.RGBA16F, g.RGBA, type);
        default:        return null;
      }
    }
    return { internalFormat: internalFormat, format: format };
  }

  function supportRenderTextureFormat(g, internalFormat, format, type) {
    var texture = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, texture);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    g.texImage2D(g.TEXTURE_2D, 0, internalFormat, 4, 4, 0, format, type, null);

    var fbo = g.createFramebuffer();
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, texture, 0);
    var status = g.checkFramebufferStatus(g.FRAMEBUFFER);
    return status === g.FRAMEBUFFER_COMPLETE;
  }

  /* ── Shader compilation ──────────────────────────────────── */
  function compileShader(type, source, keywords) {
    source = addKeywords(source, keywords);
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.warn(gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function addKeywords(source, keywords) {
    if (!keywords) return source;
    var keywordsString = '';
    keywords.forEach(function (k) { keywordsString += '#define ' + k + '\n'; });
    return keywordsString + source;
  }

  function createProgram(vertexShader, fragmentShader) {
    var program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn(gl.getProgramInfoLog(program));
    }
    return program;
  }

  function getUniforms(program) {
    var uniforms = {};
    var count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < count; i++) {
      var name = gl.getActiveUniform(program, i).name;
      uniforms[name] = gl.getUniformLocation(program, name);
    }
    return uniforms;
  }

  function Program(vertexShader, fragmentShader) {
    this.uniforms = {};
    this.program = createProgram(vertexShader, fragmentShader);
    this.uniforms = getUniforms(this.program);
  }
  Program.prototype.bind = function () { gl.useProgram(this.program); };

  function Material(vertexShader, fragmentShaderSource) {
    this.vertexShader = vertexShader;
    this.fragmentShaderSource = fragmentShaderSource;
    this.programs = [];
    this.activeProgram = null;
    this.uniforms = [];
  }
  Material.prototype.setKeywords = function (keywords) {
    var hash = 0;
    for (var i = 0; i < keywords.length; i++) hash += hashCode(keywords[i]);
    var program = this.programs[hash];
    if (program == null) {
      var fragmentShader = compileShader(gl.FRAGMENT_SHADER, this.fragmentShaderSource, keywords);
      program = createProgram(this.vertexShader, fragmentShader);
      this.programs[hash] = program;
    }
    if (program === this.activeProgram) return;
    this.uniforms = getUniforms(program);
    this.activeProgram = program;
  };
  Material.prototype.bind = function () { gl.useProgram(this.activeProgram); };

  function hashCode(s) {
    if (s.length === 0) return 0;
    var hash = 0;
    for (var i = 0; i < s.length; i++) {
      hash = (hash << 5) - hash + s.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  /* ── Shader sources ──────────────────────────────────────── */
  var baseVertexShader =
    'precision highp float;' +
    'attribute vec2 aPosition;' +
    'varying vec2 vUv;' +
    'varying vec2 vL;' +
    'varying vec2 vR;' +
    'varying vec2 vT;' +
    'varying vec2 vB;' +
    'uniform vec2 texelSize;' +
    'void main () {' +
    '  vUv = aPosition * 0.5 + 0.5;' +
    '  vL = vUv - vec2(texelSize.x, 0.0);' +
    '  vR = vUv + vec2(texelSize.x, 0.0);' +
    '  vT = vUv + vec2(0.0, texelSize.y);' +
    '  vB = vUv - vec2(0.0, texelSize.y);' +
    '  gl_Position = vec4(aPosition, 0.0, 1.0);' +
    '}';

  var copyShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'uniform sampler2D uTexture;' +
    'void main () { gl_FragColor = texture2D(uTexture, vUv); }';

  var clearShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'uniform sampler2D uTexture;' +
    'uniform float value;' +
    'void main () { gl_FragColor = value * texture2D(uTexture, vUv); }';

  var displayShaderSource =
    'precision highp float;' +
    'precision highp sampler2D;' +
    'varying vec2 vUv;' +
    'varying vec2 vL;' +
    'varying vec2 vR;' +
    'varying vec2 vT;' +
    'varying vec2 vB;' +
    'uniform sampler2D uTexture;' +
    'uniform vec2 texelSize;' +
    'void main () {' +
    '  vec3 c = texture2D(uTexture, vUv).rgb;\n' +
    '#ifdef SHADING\n' +
    '  vec3 lc = texture2D(uTexture, vL).rgb;' +
    '  vec3 rc = texture2D(uTexture, vR).rgb;' +
    '  vec3 tc = texture2D(uTexture, vT).rgb;' +
    '  vec3 bc = texture2D(uTexture, vB).rgb;' +
    '  float dx = length(rc) - length(lc);' +
    '  float dy = length(tc) - length(bc);' +
    '  vec3 n = normalize(vec3(dx, dy, length(texelSize)));' +
    '  vec3 l = vec3(0.0, 0.0, 1.0);' +
    '  float diffuse = clamp(dot(n, l) + 0.7, 0.7, 1.0);' +
    '  c *= diffuse;\n' +
    '#endif\n' +
    '  float a = max(c.r, max(c.g, c.b));' +
    '  gl_FragColor = vec4(c, a);' +
    '}';

  /* Warp composite: displaces the rasterized hero (text + image) by the
     fluid velocity field, then lays the white smoke over it. Outside the
     hero rect the canvas is transparent (live DOM shows through) save for
     a soft smoke haze. */
  var warpShaderSource =
    'precision highp float;' +
    'precision highp sampler2D;' +
    'varying vec2 vUv;' +
    'uniform sampler2D uDye;' +
    'uniform sampler2D uVelocity;' +
    'uniform sampler2D uHero;' +
    'uniform vec4 uHeroRect;' +    /* x0, y0, x1, y1 in vUv (bottom-origin) */
    'uniform float uScale;' +
    'uniform float uGain;' +
    'uniform float uSmokeAlpha;' +
    'void main () {' +
    '  vec2 vel = texture2D(uVelocity, vUv).xy;' +
    '  vec2 disp = vUv + vel * uScale;' +
    '  vec4 hero = vec4(0.0);' +
    '  if (disp.x >= uHeroRect.x && disp.x <= uHeroRect.z &&' +
    '      disp.y >= uHeroRect.y && disp.y <= uHeroRect.w) {' +
    '    vec2 huv = vec2((disp.x - uHeroRect.x) / (uHeroRect.z - uHeroRect.x),' +
    '                    (disp.y - uHeroRect.y) / (uHeroRect.w - uHeroRect.y));' +
    '    hero = texture2D(uHero, huv);' +
    '  }' +
    /* hero is premultiplied — recover true colour, then boost coverage so
       thin rasterized text reads at full brightness. */
    '  vec3 hrgb = hero.a > 0.003 ? hero.rgb / hero.a : hero.rgb;' +
    '  float ha = clamp(hero.a * uGain, 0.0, 1.0);' +
    '  vec3 smoke = texture2D(uDye, vUv).rgb;' +
    '  float smokeA = clamp(max(smoke.r, max(smoke.g, smoke.b)), 0.0, 1.0);' +
    /* Premultiplied composite: hero over page, smoke filling the gaps and
       screen-blended over the hero pixels. */
    '  vec3 col = hrgb * ha + smoke * (1.0 - ha);' +
    '  float a = clamp(ha + smokeA * uSmokeAlpha * (1.0 - ha), 0.0, 1.0);' +
    '  gl_FragColor = vec4(col, a);' +
    '}';

  var splatShader =
    'precision highp float;' +
    'precision highp sampler2D;' +
    'varying vec2 vUv;' +
    'uniform sampler2D uTarget;' +
    'uniform float aspectRatio;' +
    'uniform vec3 color;' +
    'uniform vec2 point;' +
    'uniform float radius;' +
    'void main () {' +
    '  vec2 p = vUv - point.xy;' +
    '  p.x *= aspectRatio;' +
    '  vec3 splat = exp(-dot(p, p) / radius) * color;' +
    '  vec3 base = texture2D(uTarget, vUv).xyz;' +
    '  gl_FragColor = vec4(base + splat, 1.0);' +
    '}';

  var advectionShader =
    'precision highp float;' +
    'precision highp sampler2D;' +
    'varying vec2 vUv;' +
    'uniform sampler2D uVelocity;' +
    'uniform sampler2D uSource;' +
    'uniform vec2 texelSize;' +
    'uniform vec2 dyeTexelSize;' +
    'uniform float dt;' +
    'uniform float dissipation;' +
    'vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {' +
    '  vec2 st = uv / tsize - 0.5;' +
    '  vec2 iuv = floor(st);' +
    '  vec2 fuv = fract(st);' +
    '  vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);' +
    '  vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);' +
    '  vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);' +
    '  vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);' +
    '  return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);' +
    '}' +
    'void main () {\n' +
    '#ifdef MANUAL_FILTERING\n' +
    '  vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;' +
    '  vec4 result = bilerp(uSource, coord, dyeTexelSize);\n' +
    '#else\n' +
    '  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;' +
    '  vec4 result = texture2D(uSource, coord);\n' +
    '#endif\n' +
    '  float decay = 1.0 + dissipation * dt;' +
    '  gl_FragColor = result / decay;' +
    '}';

  var divergenceShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'varying highp vec2 vL;' +
    'varying highp vec2 vR;' +
    'varying highp vec2 vT;' +
    'varying highp vec2 vB;' +
    'uniform sampler2D uVelocity;' +
    'void main () {' +
    '  float L = texture2D(uVelocity, vL).x;' +
    '  float R = texture2D(uVelocity, vR).x;' +
    '  float T = texture2D(uVelocity, vT).y;' +
    '  float B = texture2D(uVelocity, vB).y;' +
    '  vec2 C = texture2D(uVelocity, vUv).xy;' +
    '  if (vL.x < 0.0) { L = -C.x; }' +
    '  if (vR.x > 1.0) { R = -C.x; }' +
    '  if (vT.y > 1.0) { T = -C.y; }' +
    '  if (vB.y < 0.0) { B = -C.y; }' +
    '  float div = 0.5 * (R - L + T - B);' +
    '  gl_FragColor = vec4(div, 0.0, 0.0, 1.0);' +
    '}';

  var curlShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'varying highp vec2 vL;' +
    'varying highp vec2 vR;' +
    'varying highp vec2 vT;' +
    'varying highp vec2 vB;' +
    'uniform sampler2D uVelocity;' +
    'void main () {' +
    '  float L = texture2D(uVelocity, vL).y;' +
    '  float R = texture2D(uVelocity, vR).y;' +
    '  float T = texture2D(uVelocity, vT).x;' +
    '  float B = texture2D(uVelocity, vB).x;' +
    '  float vorticity = R - L - T + B;' +
    '  gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);' +
    '}';

  var vorticityShader =
    'precision highp float;' +
    'precision highp sampler2D;' +
    'varying vec2 vUv;' +
    'varying vec2 vL;' +
    'varying vec2 vR;' +
    'varying vec2 vT;' +
    'varying vec2 vB;' +
    'uniform sampler2D uVelocity;' +
    'uniform sampler2D uCurl;' +
    'uniform float curl;' +
    'uniform float dt;' +
    'void main () {' +
    '  float L = texture2D(uCurl, vL).x;' +
    '  float R = texture2D(uCurl, vR).x;' +
    '  float T = texture2D(uCurl, vT).x;' +
    '  float B = texture2D(uCurl, vB).x;' +
    '  float C = texture2D(uCurl, vUv).x;' +
    '  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));' +
    '  force /= length(force) + 0.0001;' +
    '  force *= curl * C;' +
    '  force.y *= -1.0;' +
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;' +
    '  velocity += force * dt;' +
    '  velocity = min(max(velocity, -1000.0), 1000.0);' +
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);' +
    '}';

  var pressureShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'varying highp vec2 vL;' +
    'varying highp vec2 vR;' +
    'varying highp vec2 vT;' +
    'varying highp vec2 vB;' +
    'uniform sampler2D uPressure;' +
    'uniform sampler2D uDivergence;' +
    'void main () {' +
    '  float L = texture2D(uPressure, vL).x;' +
    '  float R = texture2D(uPressure, vR).x;' +
    '  float T = texture2D(uPressure, vT).x;' +
    '  float B = texture2D(uPressure, vB).x;' +
    '  float divergence = texture2D(uDivergence, vUv).x;' +
    '  float pressure = (L + R + B + T - divergence) * 0.25;' +
    '  gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);' +
    '}';

  var gradientSubtractShader =
    'precision mediump float;' +
    'precision mediump sampler2D;' +
    'varying highp vec2 vUv;' +
    'varying highp vec2 vL;' +
    'varying highp vec2 vR;' +
    'varying highp vec2 vT;' +
    'varying highp vec2 vB;' +
    'uniform sampler2D uPressure;' +
    'uniform sampler2D uVelocity;' +
    'void main () {' +
    '  float L = texture2D(uPressure, vL).x;' +
    '  float R = texture2D(uPressure, vR).x;' +
    '  float T = texture2D(uPressure, vT).x;' +
    '  float B = texture2D(uPressure, vB).x;' +
    '  vec2 velocity = texture2D(uVelocity, vUv).xy;' +
    '  velocity.xy -= vec2(R - L, T - B);' +
    '  gl_FragColor = vec4(velocity, 0.0, 1.0);' +
    '}';

  /* ── Blit (fullscreen quad) ──────────────────────────────── */
  function setupBlit() {
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([0, 1, 2, 0, 2, 3]), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    return function (target, clear) {
      if (target == null) {
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      } else {
        gl.viewport(0, 0, target.width, target.height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      }
      if (clear) {
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    };
  }

  /* ── Framebuffers ────────────────────────────────────────── */
  function createFBO(w, h, internalFormat, format, type, param) {
    gl.activeTexture(gl.TEXTURE0);
    var texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, format, type, null);

    var fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, w, h);
    gl.clear(gl.COLOR_BUFFER_BIT);

    var texelSizeX = 1.0 / w;
    var texelSizeY = 1.0 / h;
    return {
      texture: texture, fbo: fbo, width: w, height: h,
      texelSizeX: texelSizeX, texelSizeY: texelSizeY,
      attach: function (id) {
        gl.activeTexture(gl.TEXTURE0 + id);
        gl.bindTexture(gl.TEXTURE_2D, texture);
        return id;
      }
    };
  }

  function createDoubleFBO(w, h, internalFormat, format, type, param) {
    var fbo1 = createFBO(w, h, internalFormat, format, type, param);
    var fbo2 = createFBO(w, h, internalFormat, format, type, param);
    return {
      width: w, height: h, texelSizeX: fbo1.texelSizeX, texelSizeY: fbo1.texelSizeY,
      get read() { return fbo1; },
      set read(value) { fbo1 = value; },
      get write() { return fbo2; },
      set write(value) { fbo2 = value; },
      swap: function () { var temp = fbo1; fbo1 = fbo2; fbo2 = temp; }
    };
  }

  function getResolution(resolution) {
    var aspectRatio = gl.drawingBufferWidth / gl.drawingBufferHeight;
    if (aspectRatio < 1) aspectRatio = 1.0 / aspectRatio;
    var min = Math.round(resolution);
    var max = Math.round(resolution * aspectRatio);
    if (gl.drawingBufferWidth > gl.drawingBufferHeight) return { width: max, height: min };
    return { width: min, height: max };
  }

  function initFramebuffers() {
    var simRes = getResolution(CONFIG.SIM_RESOLUTION);
    var dyeRes = getResolution(CONFIG.DYE_RESOLUTION);
    var texType = ext.halfFloatTexType;
    var rgba = ext.formatRGBA;
    var rg = ext.formatRG;
    var r = ext.formatR;
    var filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
    gl.disable(gl.BLEND);

    dye = createDoubleFBO(dyeRes.width, dyeRes.height, rgba.internalFormat, rgba.format, texType, filtering);
    velocity = createDoubleFBO(simRes.width, simRes.height, rg.internalFormat, rg.format, texType, filtering);
    divergenceFBO = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    curlFBO = createFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
    pressureFBO = createDoubleFBO(simRes.width, simRes.height, r.internalFormat, r.format, texType, gl.NEAREST);
  }

  /* ── Simulation step ─────────────────────────────────────── */
  function step(dt) {
    gl.disable(gl.BLEND);

    programs.curl.bind();
    gl.uniform2f(programs.curl.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.curl.uniforms.uVelocity, velocity.read.attach(0));
    blit(curlFBO);

    programs.vorticity.bind();
    gl.uniform2f(programs.vorticity.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.vorticity.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.vorticity.uniforms.uCurl, curlFBO.attach(1));
    gl.uniform1f(programs.vorticity.uniforms.curl, CONFIG.CURL);
    gl.uniform1f(programs.vorticity.uniforms.dt, dt);
    blit(velocity.write);
    velocity.swap();

    programs.divergence.bind();
    gl.uniform2f(programs.divergence.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.divergence.uniforms.uVelocity, velocity.read.attach(0));
    blit(divergenceFBO);

    programs.clear.bind();
    gl.uniform1i(programs.clear.uniforms.uTexture, pressureFBO.read.attach(0));
    gl.uniform1f(programs.clear.uniforms.value, CONFIG.PRESSURE);
    blit(pressureFBO.write);
    pressureFBO.swap();

    programs.pressure.bind();
    gl.uniform2f(programs.pressure.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.pressure.uniforms.uDivergence, divergenceFBO.attach(0));
    for (var i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
      gl.uniform1i(programs.pressure.uniforms.uPressure, pressureFBO.read.attach(1));
      blit(pressureFBO.write);
      pressureFBO.swap();
    }

    programs.gradientSubtract.bind();
    gl.uniform2f(programs.gradientSubtract.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    gl.uniform1i(programs.gradientSubtract.uniforms.uPressure, pressureFBO.read.attach(0));
    gl.uniform1i(programs.gradientSubtract.uniforms.uVelocity, velocity.read.attach(1));
    blit(velocity.write);
    velocity.swap();

    programs.advection.bind();
    gl.uniform2f(programs.advection.uniforms.texelSize, velocity.texelSizeX, velocity.texelSizeY);
    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, velocity.texelSizeX, velocity.texelSizeY);
    }
    var velId = velocity.read.attach(0);
    gl.uniform1i(programs.advection.uniforms.uVelocity, velId);
    gl.uniform1i(programs.advection.uniforms.uSource, velId);
    gl.uniform1f(programs.advection.uniforms.dt, dt);
    gl.uniform1f(programs.advection.uniforms.dissipation, CONFIG.VELOCITY_DISSIPATION);
    blit(velocity.write);
    velocity.swap();

    if (!ext.supportLinearFiltering) {
      gl.uniform2f(programs.advection.uniforms.dyeTexelSize, dye.texelSizeX, dye.texelSizeY);
    }
    gl.uniform1i(programs.advection.uniforms.uVelocity, velocity.read.attach(0));
    gl.uniform1i(programs.advection.uniforms.uSource, dye.read.attach(1));
    gl.uniform1f(programs.advection.uniforms.dissipation, CONFIG.DENSITY_DISSIPATION);
    blit(dye.write);
    dye.swap();
  }

  function render() {
    gl.disable(gl.BLEND);

    if (CONFIG.WARP && heroReady && heroTexture) {
      updateHeroRect();
      warpMaterial.bind();
      gl.uniform1i(warpMaterial.uniforms.uDye, dye.read.attach(0));
      gl.uniform1i(warpMaterial.uniforms.uVelocity, velocity.read.attach(1));
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, heroTexture);
      gl.uniform1i(warpMaterial.uniforms.uHero, 2);
      gl.uniform4f(warpMaterial.uniforms.uHeroRect, heroRect[0], heroRect[1], heroRect[2], heroRect[3]);
      gl.uniform1f(warpMaterial.uniforms.uScale, CONFIG.WARP_SCALE);
      gl.uniform1f(warpMaterial.uniforms.uGain, CONFIG.HERO_GAIN);
      gl.uniform1f(warpMaterial.uniforms.uSmokeAlpha, CONFIG.SMOKE_ALPHA);
      blit(null);
      return;
    }

    var width = gl.drawingBufferWidth;
    var height = gl.drawingBufferHeight;
    displayMaterial.bind();
    gl.uniform2f(displayMaterial.uniforms.texelSize, 1.0 / width, 1.0 / height);
    gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
    blit(null);
  }

  /* ── Hero rasterization + warp plumbing ──────────────────── */

  /* Snapshot covers the full viewport — rect is always the entire canvas. */
  function updateHeroRect() {
    heroRect[0] = 0; heroRect[1] = 0;
    heroRect[2] = 1; heroRect[3] = 1;
  }

  function loadHtml2Canvas() {
    return new Promise(function (resolve, reject) {
      if (window.html2canvas) return resolve(window.html2canvas);
      var existing = document.querySelector('script[data-html2canvas]');
      if (existing) {
        existing.addEventListener('load', function () { resolve(window.html2canvas); });
        existing.addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.src = CONFIG.HTML2CANVAS_SRC;
      s.async = true;
      s.setAttribute('data-html2canvas', '');
      s.onload = function () { resolve(window.html2canvas); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function uploadHeroTexture(source) {
    if (!gl) return;
    if (!heroTexture) heroTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, heroTexture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  }

  function snapshotHero() {
    if (!window.html2canvas) return;
    var scrollY = window.scrollY || 0;
    window.html2canvas(document.body, {
      x: 0,
      y: scrollY,
      width: window.innerWidth,
      height: window.innerHeight,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      backgroundColor: null,
      scale: Math.min(window.devicePixelRatio || 1, 2),
      logging: false,
      useCORS: true,
      removeContainer: true,
      onclone: function (doc) {
        /* Exclude the fluid canvas itself from the capture. */
        var oc = doc.querySelector('.fluid-overlay');
        if (oc) oc.style.display = 'none';
      }
    }).then(function (snap) {
      if (!gl) return;
      uploadHeroTexture(snap);
      hideHeroDom();
      updateHeroRect();
      heroReady = true;
    }).catch(function () { /* DOM fallback — canvas stays transparent */ });
  }

  /* Hide all page content — the fixed canvas now renders the full-page snapshot. */
  function hideHeroDom() {
    restoreHeroDom();
    if (!heroEl) return;
    hiddenHeroNodes.push([heroEl, heroEl.style.visibility]);
    heroEl.style.visibility = 'hidden';
  }

  function restoreHeroDom() {
    hiddenHeroNodes.forEach(function (pair) { pair[0].style.visibility = pair[1] || ''; });
    hiddenHeroNodes = [];
  }

  function scheduleSnapshot() {
    if (!CONFIG.WARP) return;
    heroEl = document.querySelector(CONFIG.WARP_SELECTOR);
    if (!heroEl) return;

    loadHtml2Canvas().then(function () {
      /* Snapshot after the hero entrance animation has settled. */
      function fire() {
        if (snapshotTimer) clearTimeout(snapshotTimer);
        snapshotTimer = setTimeout(snapshotHero, CONFIG.SNAPSHOT_DELAY);
      }
      document.addEventListener('colab:shader-revealed', fire, { once: true });
      /* Fallback if the reveal event never fires. */
      snapshotTimer = setTimeout(snapshotHero, 3800);
    }).catch(function () { /* plain smoke fallback */ });
  }

  /* Re-rasterize on resize (layout shifts invalidate the snapshot). */
  function scheduleResnapshot() {
    if (!CONFIG.WARP || !heroReady) return;
    if (resnapTimer) clearTimeout(resnapTimer);
    resnapTimer = setTimeout(function () {
      restoreHeroDom();
      heroReady = false;
      snapshotHero();
    }, 250);
  }

  /* ── Splats ──────────────────────────────────────────────── */
  function splat(x, y, dx, dy) {
    programs.splat.bind();
    gl.uniform1i(programs.splat.uniforms.uTarget, velocity.read.attach(0));
    gl.uniform1f(programs.splat.uniforms.aspectRatio, canvas.width / canvas.height);
    gl.uniform2f(programs.splat.uniforms.point, x, y);
    gl.uniform3f(programs.splat.uniforms.color, dx, dy, 0.0);
    gl.uniform1f(programs.splat.uniforms.radius, correctRadius(CONFIG.SPLAT_RADIUS / 100.0));
    blit(velocity.write);
    velocity.swap();
    /* Smoke disabled — velocity-only splat. */
  }

  function splatPointer(pointer) {
    var dx = pointer.deltaX * CONFIG.SPLAT_FORCE;
    var dy = pointer.deltaY * CONFIG.SPLAT_FORCE;
    splat(pointer.texcoordX, pointer.texcoordY, dx, dy);
  }

  function correctRadius(radius) {
    var aspectRatio = canvas.width / canvas.height;
    if (aspectRatio > 1) radius *= aspectRatio;
    return radius;
  }

  /* Monochrome dye — white smoke, no hue. */
  function monochromeColor() {
    var v = CONFIG.INTENSITY;
    return { r: v, g: v, b: v };
  }

  /* ── Pointer input (window-level, since canvas is click-through) ── */
  function updatePointerMoveData(pointer, posX, posY) {
    pointer.prevTexcoordX = pointer.texcoordX;
    pointer.prevTexcoordY = pointer.texcoordY;
    pointer.texcoordX = posX / canvas.clientWidth;
    pointer.texcoordY = 1.0 - posY / canvas.clientHeight;
    pointer.deltaX = correctDeltaX(pointer.texcoordX - pointer.prevTexcoordX);
    pointer.deltaY = correctDeltaY(pointer.texcoordY - pointer.prevTexcoordY);
    pointer.moved = Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
  }

  function correctDeltaX(delta) {
    var aspectRatio = canvas.clientWidth / canvas.clientHeight;
    if (aspectRatio < 1) delta *= aspectRatio;
    return delta;
  }
  function correctDeltaY(delta) {
    var aspectRatio = canvas.clientWidth / canvas.clientHeight;
    if (aspectRatio > 1) delta /= aspectRatio;
    return delta;
  }

  function onPointerMove(e) {
    var pointer = pointers[0];
    updatePointerMoveData(pointer, e.clientX, e.clientY);
    if (pointer.moved) {
      pointer.moved = false;
      splatPointer(pointer);
    }
  }

  /* ── Canvas sizing ───────────────────────────────────────── */
  function resizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = Math.round(canvas.clientWidth * dpr);
    var h = Math.round(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  /* ── Main loop ───────────────────────────────────────────── */
  function frame() {
    if (!running) return;
    var now = Date.now();
    var dt = Math.min((now - lastUpdateTime) / 1000, 0.016666);
    lastUpdateTime = now;
    if (resizeCanvas()) initFramebuffers();
    step(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }

  /* ── Public init / destroy ───────────────────────────────── */
  function init() {
    destroy();

    /* Desktop only — skip touch / narrow viewports. */
    if (window.matchMedia('(max-width: 767px)').matches) return;
    if (!document.body || !document.body.classList.contains('about-page')) return;

    canvas = document.createElement('canvas');
    canvas.className = 'fluid-overlay';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;top:0;left:0;width:100vw;height:100vh;' +
      'pointer-events:none;z-index:' + CONFIG.Z_INDEX + ';' +
      'mix-blend-mode:' + BLEND_MODE + ';';
    document.body.appendChild(canvas);

    var context = getWebGLContext(canvas);
    if (!context) { destroy(); return; }
    gl = context.gl;
    ext = context.ext;

    if (!ext.supportLinearFiltering) {
      CONFIG.DYE_RESOLUTION = 512;
    }

    resizeCanvas();

    /* Compile programs */
    var baseVertex = compileShader(gl.VERTEX_SHADER, baseVertexShader);
    function P(frag) { return new Program(baseVertex, compileShader(gl.FRAGMENT_SHADER, frag)); }
    programs.copy = P(copyShader);
    programs.clear = P(clearShader);
    programs.splat = P(splatShader);
    programs.advection = new Program(baseVertex, compileShader(gl.FRAGMENT_SHADER, advectionShader,
      ext.supportLinearFiltering ? null : ['MANUAL_FILTERING']));
    programs.divergence = P(divergenceShader);
    programs.curl = P(curlShader);
    programs.vorticity = P(vorticityShader);
    programs.pressure = P(pressureShader);
    programs.gradientSubtract = P(gradientSubtractShader);

    displayMaterial = new Material(baseVertex, displayShaderSource);
    displayMaterial.setKeywords(CONFIG.SHADING ? ['SHADING'] : []);

    warpMaterial = new Program(baseVertex, compileShader(gl.FRAGMENT_SHADER, warpShaderSource));

    blit = setupBlit();
    initFramebuffers();

    pointers = [new Pointer()];

    /* Window-level listeners — canvas is pointer-events:none so the
       page stays fully interactive; we read the cursor globally. */
    boundHandlers.move = onPointerMove;
    boundHandlers.resize = function () {
      if (resizeCanvas()) initFramebuffers();
      scheduleResnapshot();
    };
    boundHandlers.scroll = function () {
      /* On scroll: restore DOM and re-snapshot 400ms after scrolling stops. */
      if (heroReady) {
        restoreHeroDom();
        heroReady = false;
      }
      if (boundHandlers.scrollTimer) clearTimeout(boundHandlers.scrollTimer);
      boundHandlers.scrollTimer = setTimeout(snapshotHero, 400);
    };
    window.addEventListener('mousemove', boundHandlers.move);
    window.addEventListener('resize', boundHandlers.resize);
    window.addEventListener('scroll', boundHandlers.scroll, { passive: true });

    running = true;
    lastUpdateTime = Date.now();
    rafId = requestAnimationFrame(frame);

    /* Rasterize the hero and switch on the geometric warp. */
    scheduleSnapshot();
  }

  function destroy() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    if (snapshotTimer) { clearTimeout(snapshotTimer); snapshotTimer = null; }
    if (resnapTimer) { clearTimeout(resnapTimer); resnapTimer = null; }
    if (boundHandlers.move) window.removeEventListener('mousemove', boundHandlers.move);
    if (boundHandlers.resize) window.removeEventListener('resize', boundHandlers.resize);
    if (boundHandlers.scroll) window.removeEventListener('scroll', boundHandlers.scroll);
    if (boundHandlers.scrollTimer) clearTimeout(boundHandlers.scrollTimer);
    boundHandlers = {};
    restoreHeroDom();
    if (gl) {
      if (heroTexture) { gl.deleteTexture(heroTexture); heroTexture = null; }
      var loseCtx = gl.getExtension('WEBGL_lose_context');
      if (loseCtx) loseCtx.loseContext();
    }
    heroTexture = null;
    heroReady = false;
    heroEl = null;
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    canvas = null; gl = null; ext = null;
    programs = {}; displayMaterial = null; warpMaterial = null; blit = null;
    dye = velocity = divergenceFBO = curlFBO = pressureFBO = null;
  }

  window.colabFluidAbout = { init: init, destroy: destroy };

  /* ── Auto-init on direct page load ───────────────────────── */
  if (document.body && document.body.classList.contains('about-page')) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }
}());
