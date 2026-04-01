/**
 * co:lab — Infinite Canvas
 *
 * Core approach (matches the reference exactly):
 *  - Perspective camera at Z=50, FOV=60
 *  - Camera moves in XY to pan, Z to zoom (scroll)
 *  - Chunk-based seeded random plane generation (5 planes/chunk)
 *  - Plane sizes: 12–20 world units, aspect-corrected from image dims
 *  - THREE.Fog for atmospheric depth fade (near=120, far=320)
 *  - Per-plane depth fade: lerped opacity based on abs(plane.z - cam.z)
 *  - Drag: targetVelocity XY with inertia (decay=0.9, lerp=0.16)
 *  - Scroll: accumulates into targetVelocity Z
 *  - Mouse drift when not dragging (subtle parallax)
 *  - Chunk neighbourhood rendered: RENDER_DISTANCE=2 + FADE_MARGIN=1
 */

(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    setTimeout(function () { init(); }, 100);
    return;
  }

  /* ============================================================
     PROJECT DATA
     ============================================================ */
  var PROJECTS = [
    {
      index:    '001',
      title:    'Viking Gear',
      services: 'Brand Development · Web Design · E-Commerce · 3D · Animation',
      images: [
        'assets/Project_Img_01.webp',
        'assets/Project_Img_Viking_02.webp',
        'assets/Project_Img_Viking_03.webp',
        'assets/Project_Img_Viking_04.webp',
        'assets/Project_Img_Viking_05.webp',
        'assets/Project_Img_Viking_06.webp',
        'assets/Project_Img_Viking_07.webp',
        'assets/Project_Img_Viking_08.webp',
        'assets/Project_Img_Viking_09.webp',
        'assets/Project_Img_Viking_10.webp',
        'assets/Project_Img_Viking_11.webp'
      ],
      /* aspect ratios matching manifest dims: width/height per image slot */
      aspects: [1.529, 0.567, 0.714, 1.358, 1.333, 1.000,
                0.800, 1.600, 1.212, 0.750, 1.455, 0.900]
    },
    {
      index:    '002',
      title:    'Rebel Kids Club',
      services: 'Brand Development · Photography · E-Commerce · Web Design',
      images: [
        'assets/Project_Img_02.webp',
        'assets/Project_Img_Rebel_02.webp',
        'assets/Project_Img_Rebel_03.webp',
        'assets/Project_Img_Rebel_04.webp',
        'assets/Project_Img_Rebel_05.webp',
        'assets/Project_Img_Rebel_06.webp',
        'assets/Project_Img_Rebel_07.webp'
      ],
      aspects: [1.529, 0.567, 0.714, 1.358, 1.333, 1.000,
                0.800, 1.600, 1.212, 0.750, 1.455, 0.900]
    },
    {
      index:    '003',
      title:    'Mannequin Films',
      services: 'Brand Development · Web Design · Motion',
      images: [
        'assets/Project_Img_03.webp',
        'assets/Project_Img_Mannequin_02.webp',
        'assets/Project_Img_Mannequin_03.webp',
        'assets/Project_Img_Mannequin_04.webp',
        'assets/Project_Img_Mannequin_05.webp',
        'assets/Project_Img_Mannequin_06.webp',
        'assets/Project_Img_Mannequin_07.webp',
        'assets/Project_Img_Mannequin_08.webp',
        'assets/Project_Img_Mannequin_09.webp',
        'assets/Project_Img_Mannequin_10.webp',
        'assets/Project_Img_Mannequin_10.webp'
      ],
      aspects: [1.529, 0.567, 0.714, 1.358, 1.333, 1.000,
                0.800, 1.600, 1.212, 0.750, 1.455, 0.900]
    }
  ];

  /* ============================================================
     CONSTANTS — exact values from reference source
     ============================================================ */
  var CHUNK_SIZE        = 110;
  var RENDER_DISTANCE   = 2;
  var CHUNK_FADE_MARGIN = 1;
  var MAX_VELOCITY      = 3.2;
  var DEPTH_FADE_START  = 140;
  var DEPTH_FADE_END    = 260;
  var INVIS_THRESHOLD   = 0.01;
  var VELOCITY_LERP     = 0.16;
  var VELOCITY_DECAY    = 0.9;
  var INITIAL_CAMERA_Z  = 50;
  var ITEMS_PER_CHUNK   = 5;
  var CAMERA_FOV        = 60;
  var FOG_NEAR          = 120;
  var FOG_FAR           = 320;
  var BG_COLOR          = 0x080808;
  var FOG_COLOR         = 0x080808;

  /* ============================================================
     SEEDED RANDOM (same algo as reference)
     ============================================================ */
  function seededRandom(seed) {
    var x = Math.sin(seed * 9999) * 10000;
    return x - Math.floor(x);
  }

  function hashString(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return Math.abs(h);
  }

  /* ============================================================
     CHUNK PLANE GENERATION — exact port from utils.ts
     ============================================================ */
  var planeCache = {};

  function generateChunkPlanes(cx, cy, cz) {
    var planes = [];
    var seed = hashString(cx + ',' + cy + ',' + cz);

    for (var i = 0; i < ITEMS_PER_CHUNK; i++) {
      var s = seed + i * 1000;
      var r = function (n) { return seededRandom(s + n); };
      var size = 9 + r(4) * 6;   /* 9–15 world units — 25% smaller than reference */

      planes.push({
        id: cx + '-' + cy + '-' + cz + '-' + i,
        px: cx * CHUNK_SIZE + r(0) * CHUNK_SIZE,
        py: cy * CHUNK_SIZE + r(1) * CHUNK_SIZE,
        pz: cz * CHUNK_SIZE + r(2) * CHUNK_SIZE,
        size: size,
        mediaIndex: Math.floor(r(5) * 1000000)
      });
    }
    return planes;
  }

  function getChunkPlanes(cx, cy, cz) {
    var key = cx + ',' + cy + ',' + cz;
    if (!planeCache[key]) planeCache[key] = generateChunkPlanes(cx, cy, cz);
    return planeCache[key];
  }

  /* ============================================================
     THREE.JS SETUP
     ============================================================ */
  var canvasEl   = document.querySelector('[data-webgl-canvas]');
  var canvasWrap = document.querySelector('[data-project-canvas-wrap]');
  if (!canvasEl) return;

  var W = canvasWrap ? canvasWrap.offsetWidth  : window.innerWidth;
  var H = canvasWrap ? canvasWrap.offsetHeight : (window.innerHeight - 64);

  var renderer = new THREE.WebGLRenderer({
    canvas:    canvasEl,
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(W, H);
  renderer.setClearColor(BG_COLOR, 1);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(BG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, FOG_NEAR, FOG_FAR);

  /* Perspective camera — key difference from previous orthographic approach */
  var camera = new THREE.PerspectiveCamera(CAMERA_FOV, W / H, 1, 500);
  camera.position.set(0, 0, INITIAL_CAMERA_Z);

  /* Shared geometry — one quad, scaled per plane */
  var PLANE_GEO = new THREE.PlaneGeometry(1, 1);

  /* ============================================================
     TEXTURE MANAGER
     ============================================================ */
  var textureCache   = {};   /* url → THREE.Texture */
  var textureLoader  = new THREE.TextureLoader();
  var currentTextures = [];  /* array of loaded textures for current project */

  function loadProjectTextures(project, onDone) {
    currentTextures = new Array(project.images.length).fill(null);
    var loaded = 0;
    var total  = project.images.length;

    project.images.forEach(function (url, i) {
      if (textureCache[url]) {
        currentTextures[i] = textureCache[url];
        if (++loaded === total) onDone();
        return;
      }
      textureLoader.load(url, function (tex) {
        tex.minFilter = THREE.LinearFilter;
        tex.magFilter = THREE.LinearFilter;
        textureCache[url] = tex;
        currentTextures[i] = tex;
        if (++loaded === total) onDone();
      }, undefined, function () {
        var fb = new THREE.DataTexture(new Uint8Array([20,20,20,255]), 1, 1);
        fb.needsUpdate = true;
        textureCache[url] = fb;
        currentTextures[i] = fb;
        if (++loaded === total) onDone();
      });
    });
  }

  function getTextureForIndex(mediaIndex, project) {
    var idx = mediaIndex % project.images.length;
    return currentTextures[idx] || null;
  }

  /* ============================================================
     PLANE POOL
     Live meshes, keyed by plane id. Created lazily, opacity lerped.
     ============================================================ */
  var meshPool = {};  /* id → { mesh, opacity, target } */

  function getOrCreateMesh(planeData, project) {
    var id  = planeData.id;
    var tex = getTextureForIndex(planeData.mediaIndex, project);
    if (!tex) return null;

    if (!meshPool[id]) {
      /* Aspect-correct scale: height = size, width = size * aspect */
      var imgIdx  = planeData.mediaIndex % project.images.length;
      var aspect  = project.aspects ? project.aspects[imgIdx % project.aspects.length] : 1.0;

      /* Use actual loaded texture dimensions if available */
      if (tex.image && tex.image.naturalWidth) {
        aspect = tex.image.naturalWidth / tex.image.naturalHeight;
      }

      var h = planeData.size;
      var w = h * aspect;

      var mat = new THREE.MeshBasicMaterial({
        map:         tex,
        transparent: true,
        opacity:     0,
        depthWrite:  false,
        side:        THREE.DoubleSide
      });

      var mesh = new THREE.Mesh(PLANE_GEO, mat);
      mesh.scale.set(w, h, 1);
      mesh.position.set(planeData.px, planeData.py, planeData.pz);
      mesh.visible = false;
      scene.add(mesh);

      meshPool[id] = { mesh: mesh, opacity: 0 };
    }

    return meshPool[id];
  }

  /* Fade out and remove all meshes not in active set */
  var activePlaneIds = {};

  function syncMeshPool() {
    Object.keys(meshPool).forEach(function (id) {
      if (!activePlaneIds[id]) {
        /* Not in active set — fade out and remove */
        var entry = meshPool[id];
        entry.opacity = 0;
        entry.mesh.material.opacity = 0;
        scene.remove(entry.mesh);
        entry.mesh.material.dispose();
        delete meshPool[id];
      }
    });
  }

  /* ============================================================
     CHUNK NEIGHBOURHOOD — same CHUNK_OFFSETS logic as reference
     ============================================================ */
  var CHUNK_OFFSETS = (function () {
    var maxDist = RENDER_DISTANCE + CHUNK_FADE_MARGIN;
    var offsets = [];
    for (var dx = -maxDist; dx <= maxDist; dx++) {
      for (var dy = -maxDist; dy <= maxDist; dy++) {
        for (var dz = -maxDist; dz <= maxDist; dz++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz));
          if (dist > maxDist) continue;
          offsets.push({ dx: dx, dy: dy, dz: dz, dist: dist });
        }
      }
    }
    return offsets;
  })();

  /* ============================================================
     CAMERA / CONTROLLER STATE — mirrors ControllerState in scene.tsx
     ============================================================ */
  var state = {
    velocity:    { x: 0, y: 0, z: 0 },
    targetVel:   { x: 0, y: 0, z: 0 },
    basePos:     { x: 0, y: 0, z: INITIAL_CAMERA_Z },
    drift:       { x: 0, y: 0 },
    mouse:       { x: 0, y: 0 },
    lastMouse:   { x: 0, y: 0 },
    scrollAccum: 0,
    isDragging:  false,
    lastChunkKey: '',
    cx: 0, cy: 0, cz: 0
  };

  /* ============================================================
     INPUT EVENTS — exact port from SceneController useEffect
     ============================================================ */
  canvasEl.style.cursor = 'grab';

  canvasEl.addEventListener('mousedown', function (e) {
    state.isDragging = true;
    state.lastMouse  = { x: e.clientX, y: e.clientY };
    canvasEl.style.cursor = 'grabbing';
  });

  window.addEventListener('mouseup', function () {
    state.isDragging = false;
    canvasEl.style.cursor = 'grab';
  });

  canvasEl.addEventListener('mouseleave', function () {
    state.mouse     = { x: 0, y: 0 };
    state.isDragging = false;
    canvasEl.style.cursor = 'grab';
  });

  window.addEventListener('mousemove', function (e) {
    state.mouse = {
      x:  (e.clientX / window.innerWidth)  * 2 - 1,
      y: -(e.clientY / window.innerHeight) * 2 + 1
    };

    if (state.isDragging) {
      /* Exact coefficient from reference: 0.025 */
      state.targetVel.x -= (e.clientX - state.lastMouse.x) * 0.025;
      state.targetVel.y += (e.clientY - state.lastMouse.y) * 0.025;
      state.lastMouse = { x: e.clientX, y: e.clientY };
    }
  });

  canvasEl.addEventListener('wheel', function (e) {
    e.preventDefault();
    /* Exact coefficient from reference: 0.006 */
    state.scrollAccum += e.deltaY * 0.006;
  }, { passive: false });

  /* Touch */
  var lastTouches    = [];
  var lastTouchDist  = 0;

  function getTouchDist(touches) {
    if (touches.length < 2) return 0;
    var dx = touches[0].clientX - touches[1].clientX;
    var dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  canvasEl.addEventListener('touchstart', function (e) {
    e.preventDefault();
    lastTouches   = Array.from(e.touches);
    lastTouchDist = getTouchDist(lastTouches);
    canvasEl.style.cursor = 'grabbing';
  }, { passive: false });

  canvasEl.addEventListener('touchmove', function (e) {
    e.preventDefault();
    var touches = Array.from(e.touches);
    if (touches.length === 1 && lastTouches.length >= 1) {
      state.targetVel.x -= (touches[0].clientX - lastTouches[0].clientX) * 0.02;
      state.targetVel.y += (touches[0].clientY - lastTouches[0].clientY) * 0.02;
    } else if (touches.length === 2 && lastTouchDist > 0) {
      var dist = getTouchDist(touches);
      state.scrollAccum += (lastTouchDist - dist) * 0.006;
      lastTouchDist = dist;
    }
    lastTouches = touches;
  }, { passive: false });

  canvasEl.addEventListener('touchend', function (e) {
    lastTouches   = Array.from(e.touches);
    lastTouchDist = getTouchDist(lastTouches);
    canvasEl.style.cursor = 'grab';
  }, { passive: false });

  /* ============================================================
     HELPERS
     ============================================================ */
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

  /* ============================================================
     ACTIVE CHUNKS TRACKING
     ============================================================ */
  var activeChunks = [];

  function updateChunks(cx, cy, cz) {
    activeChunks = CHUNK_OFFSETS.map(function (o) {
      return { cx: cx + o.dx, cy: cy + o.dy, cz: cz + o.dz, dist: o.dist };
    });
  }

  /* ============================================================
     PER-FRAME UPDATE — mirrors useFrame in SceneController
     ============================================================ */
  var currentProject = null;
  var transitionAlpha  = 1.0;    /* master fade for project switching */
  var infiniteRunning  = true;    /* false when depth gallery is active */

  function tick() {
    requestAnimationFrame(tick);
    if (!infiniteRunning) return;

    var s = state;

    /* Drift (mouse parallax when not dragging) */
    var isZooming = Math.abs(s.velocity.z) > 0.05;
    var zoomFactor  = clamp(s.basePos.z / 50, 0.3, 2.0);
    var driftAmount = 8.0 * zoomFactor;
    var driftLerp   = isZooming ? 0.2 : 0.12;

    if (!s.isDragging) {
      s.drift.x = lerp(s.drift.x, s.mouse.x * driftAmount, driftLerp);
      s.drift.y = lerp(s.drift.y, s.mouse.y * driftAmount, driftLerp);
    }

    /* Accumulate scroll into Z velocity */
    s.targetVel.z  += s.scrollAccum;
    s.scrollAccum  *= 0.8;

    /* Clamp velocities */
    s.targetVel.x = clamp(s.targetVel.x, -MAX_VELOCITY, MAX_VELOCITY);
    s.targetVel.y = clamp(s.targetVel.y, -MAX_VELOCITY, MAX_VELOCITY);
    s.targetVel.z = clamp(s.targetVel.z, -MAX_VELOCITY, MAX_VELOCITY);

    /* Lerp velocity toward target */
    s.velocity.x = lerp(s.velocity.x, s.targetVel.x, VELOCITY_LERP);
    s.velocity.y = lerp(s.velocity.y, s.targetVel.y, VELOCITY_LERP);
    s.velocity.z = lerp(s.velocity.z, s.targetVel.z, VELOCITY_LERP);

    /* Move base position */
    s.basePos.x += s.velocity.x;
    s.basePos.y += s.velocity.y;
    s.basePos.z += s.velocity.z;

    /* Apply camera */
    camera.position.set(
      s.basePos.x + s.drift.x,
      s.basePos.y + s.drift.y,
      s.basePos.z
    );

    /* Decay */
    s.targetVel.x *= VELOCITY_DECAY;
    s.targetVel.y *= VELOCITY_DECAY;
    s.targetVel.z *= VELOCITY_DECAY;

    /* Chunk update */
    var cx = Math.floor(s.basePos.x / CHUNK_SIZE);
    var cy = Math.floor(s.basePos.y / CHUNK_SIZE);
    var cz = Math.floor(s.basePos.z / CHUNK_SIZE);
    var chunkKey = cx + ',' + cy + ',' + cz;

    if (chunkKey !== s.lastChunkKey) {
      s.lastChunkKey = chunkKey;
      s.cx = cx; s.cy = cy; s.cz = cz;
      updateChunks(cx, cy, cz);
    }

    if (!currentProject) {
      renderer.render(scene, camera);
      return;
    }

    /* --- Per-plane visibility + depth fade --- */
    activePlaneIds = {};

    activeChunks.forEach(function (chunk) {
      var planes = getChunkPlanes(chunk.cx, chunk.cy, chunk.cz);

      planes.forEach(function (planeData) {
        var entry = getOrCreateMesh(planeData, currentProject);
        if (!entry) return;

        activePlaneIds[planeData.id] = true;

        var mesh     = entry.mesh;
        var material = mesh.material;
        var camZ     = s.basePos.z;

        /* Grid-distance fade (same as reference) */
        var dist = chunk.dist;
        var gridFade = dist <= RENDER_DISTANCE
          ? 1
          : Math.max(0, 1 - (dist - RENDER_DISTANCE) / Math.max(CHUNK_FADE_MARGIN, 0.0001));

        /* Depth fade (same as reference) */
        var absDepth = Math.abs(planeData.pz - camZ);

        if (absDepth > DEPTH_FADE_END + 50) {
          entry.opacity = 0;
          material.opacity = 0;
          mesh.visible = false;
          return;
        }

        var depthFade = absDepth <= DEPTH_FADE_START
          ? 1
          : Math.max(0, 1 - (absDepth - DEPTH_FADE_START) / Math.max(DEPTH_FADE_END - DEPTH_FADE_START, 0.0001));

        var target = Math.min(gridFade, depthFade * depthFade) * transitionAlpha;

        /* Lerp opacity — same 0.18 as reference */
        entry.opacity = (target < INVIS_THRESHOLD && entry.opacity < INVIS_THRESHOLD)
          ? 0
          : lerp(entry.opacity, target, 0.18);

        var isOpaque = entry.opacity > 0.99;
        material.opacity     = isOpaque ? 1 : entry.opacity;
        material.depthWrite  = isOpaque;
        mesh.visible         = entry.opacity > INVIS_THRESHOLD;
      });
    });

    /* Hide meshes no longer in active set */
    Object.keys(meshPool).forEach(function (id) {
      if (!activePlaneIds[id]) {
        var entry = meshPool[id];
        entry.opacity = lerp(entry.opacity, 0, 0.18);
        entry.mesh.material.opacity = entry.opacity;
        entry.mesh.visible = entry.opacity > INVIS_THRESHOLD;
      }
    });

    renderer.render(scene, camera);
  }

  /* ============================================================
     PROJECT SWITCHING
     ============================================================ */
  var currentIndex  = 0;
  var transitioning = false;

  function clearAllMeshes() {
    Object.keys(meshPool).forEach(function (id) {
      scene.remove(meshPool[id].mesh);
      meshPool[id].mesh.material.dispose();
    });
    meshPool = {};
    planeCache = {};
  }

  function switchProject(index) {
    if (transitioning || index === currentIndex) return;
    transitioning = true;
    currentIndex  = index;

    document.querySelectorAll('[data-project-index]').forEach(function (el) {
      el.classList.toggle('is-active', parseInt(el.dataset.projectIndex, 10) === index);
    });

    var project = PROJECTS[index];

    /* Fade out */
    var t0 = performance.now();
    (function fadeOut() {
      var p = Math.min((performance.now() - t0) / 300, 1);
      transitionAlpha = 1 - p;
      if (p < 1) { requestAnimationFrame(fadeOut); return; }

      clearAllMeshes();
      loadProjectTextures(project, function () {
        currentProject = project;
        updateMeta(project, index);

        /* Reset camera position */
        state.basePos = { x: 0, y: 0, z: INITIAL_CAMERA_Z };
        state.velocity   = { x: 0, y: 0, z: 0 };
        state.targetVel  = { x: 0, y: 0, z: 0 };
        state.scrollAccum = 0;
        state.lastChunkKey = '';
        camera.position.set(0, 0, INITIAL_CAMERA_Z);
        updateChunks(0, 0, 0);

        /* Fade in */
        var t1 = performance.now();
        (function fadeIn() {
          var p2 = Math.min((performance.now() - t1) / 400, 1);
          transitionAlpha = p2;
          if (p2 < 1) { requestAnimationFrame(fadeIn); return; }
          transitionAlpha = 1;
          transitioning   = false;
        })();
      });
    })();
  }

  /* ============================================================
     META OVERLAY
     ============================================================ */
  var metaNum      = document.querySelector('[data-meta-num]');
  var metaTitle    = document.querySelector('[data-meta-title]');
  var metaServices = document.querySelector('[data-meta-services]');
  var metaFill     = document.querySelector('[data-meta-fill]');
  var metaCount    = document.querySelector('[data-meta-count]');
  var scrollHint   = document.querySelector('[data-scroll-hint]');

  function updateMeta(project, index) {
    if (metaNum)      metaNum.textContent      = project.index;
    if (metaServices) metaServices.textContent  = project.services;
    if (metaCount)    metaCount.textContent     = '0'+(index+1)+' / 0'+PROJECTS.length;
    if (metaFill)     metaFill.style.width      = ((index/Math.max(PROJECTS.length-1,1))*100)+'%';
    if (metaTitle) {
      metaTitle.textContent = project.title;
    }
  }

  /* ============================================================
     RESIZE
     ============================================================ */
  window.addEventListener('resize', function () {
    if (!canvasWrap) return;
    W = canvasWrap.offsetWidth;
    H = canvasWrap.offsetHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  });

  /* ============================================================
     RELATED PROJECT RAIL EVENTS
     ============================================================ */
  document.querySelectorAll('[data-project-switch]').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (scrollHint) scrollHint.classList.add('is-hidden');
      switchProject(parseInt(btn.dataset.projectSwitch, 10));
    });
  });

  document.querySelectorAll('[data-project-index]').forEach(function (item) {
    item.addEventListener('click', function () {
      switchProject(parseInt(item.dataset.projectIndex, 10));
    });
  });

  /* ============================================================
     SESSION RESTORE
     ============================================================ */
  function getInitialIndex() {
    try {
      var s = sessionStorage.getItem('colab_activeProject');
      if (s !== null) {
        sessionStorage.removeItem('colab_activeProject');
        var idx = parseInt(s, 10);
        return (idx >= 0 && idx < PROJECTS.length) ? idx : 0;
      }
    } catch(e) {}
    return 0;
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    var startIdx = getInitialIndex();
    currentIndex = startIdx;
    var p = PROJECTS[startIdx];

    if (metaNum)      metaNum.textContent      = p.index;
    if (metaTitle)    metaTitle.textContent     = p.title;
    if (metaServices) metaServices.textContent  = p.services;
    if (metaCount)    metaCount.textContent     = '0'+(startIdx+1)+' / 0'+PROJECTS.length;
    if (metaFill)     metaFill.style.width      = '0%';

    document.querySelectorAll('[data-project-index]').forEach(function (el) {
      el.classList.toggle('is-active', parseInt(el.dataset.projectIndex,10) === startIdx);
    });

    updateChunks(0, 0, 0);

    loadProjectTextures(p, function () {
      currentProject = p;
      transitionAlpha = 0;

      tick();

      /* Fade in */
      var t0 = performance.now();
      (function fadeIn() {
        var prog = Math.min((performance.now() - t0) / 800, 1);
        transitionAlpha = prog;
        if (prog < 1) requestAnimationFrame(fadeIn);
      })();

      requestAnimationFrame(function () {
        document.body.classList.add('is-ready');
      });
    });
  }

  /* Wait for THREE then boot */
  (function waitForLibs() {
    if (typeof THREE !== 'undefined') init();
    else setTimeout(waitForLibs, 50);
  })();


  /* ============================================================
     VIEW MODE TOGGLE
     Two modes: 'infinite' (default) | 'depth'
     Toggle button sits in the canvas panel bottom-right.
     ============================================================ */
  var viewMode     = 'infinite';   /* current active mode */
  var depthGallery = null;         /* DepthGallery instance, created lazily */

  var toggleBtn = document.querySelector('[data-view-toggle]');

  function getProjectImages(project) {
    return project ? project.images : [];
  }

  function switchToDepth() {
    if (viewMode === 'depth') return;
    viewMode = 'depth';

    /* Pause infinite canvas render loop */
    infiniteRunning = false;

    /* Hide the main WebGL canvas */
    canvasEl.style.display = 'none';

    /* Show / create depth canvas */
    var depthCanvas = document.querySelector('[data-depth-canvas]');
    depthCanvas.style.display = 'block';

    if (!depthGallery) {
      depthGallery = new DepthGallery();
      depthGallery.init(depthCanvas, canvasWrap, getProjectImages(currentProject));
    } else {
      depthGallery.loadImages(getProjectImages(currentProject));
    }

    depthGallery.start();

    if (toggleBtn) {
      toggleBtn.setAttribute('data-mode', 'depth');
      toggleBtn.title = 'Switch to Infinite Canvas';
    }
  }

  function switchToInfinite() {
    if (viewMode === 'infinite') return;
    viewMode = 'infinite';

    /* Stop depth gallery */
    if (depthGallery) depthGallery.stop();

    /* Hide depth canvas, show infinite canvas */
    var depthCanvas = document.querySelector('[data-depth-canvas]');
    depthCanvas.style.display = 'none';
    canvasEl.style.display    = 'block';

    /* Resume infinite canvas */
    infiniteRunning = true;

    if (toggleBtn) {
      toggleBtn.setAttribute('data-mode', 'infinite');
      toggleBtn.title = 'Switch to Depth Gallery';
    }
  }

  /* Track whether the infinite canvas loop should run */

  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      if (viewMode === 'infinite') switchToDepth();
      else switchToInfinite();
    });
  }

  /* Sync depth gallery when project switches */
  var _origSwitchProject = switchProject;
  switchProject = function (index) {
    _origSwitchProject(index);
    if (viewMode === 'depth' && depthGallery) {
      /* Small delay so textures have started loading */
      setTimeout(function () {
        depthGallery.loadImages(getProjectImages(PROJECTS[index]));
      }, 350);
    }
  };

}());