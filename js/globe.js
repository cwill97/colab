/**
 * co:lab — Globe v4
 * Particle earth with:
 *   1. Reactive glow aura       — particles brighten near cursor
 *   2. Atmosphere halo           — orbiting scatter particles
 *   3. Holographic HUD           — orbit rings, crosshair
 *   4. Connection arcs           — JHB → project city, one per project
 *   5. Project-hover zoom        — hover a project item to rotate globe
 *                                  toward that city and zoom in on its arc
 */
(function () {
  'use strict';

  function waitForThree(cb) {
    if (typeof THREE !== 'undefined') cb();
    else setTimeout(function () { waitForThree(cb); }, 50);
  }

  /* ── Lat/Lng helpers ─────────────────────────────────────── */
  var RADIUS = 1.0;

  function latLngToVec3(lat, lng, r) {
    var phi   = (90 - lat) * (Math.PI / 180);
    var theta = -lng        * (Math.PI / 180);
    return new THREE.Vector3(
       r * Math.sin(phi) * Math.sin(theta),
       r * Math.cos(phi),
      -r * Math.sin(phi) * Math.cos(theta)
    );
  }

  // Convert lat/lng to globe rotation.y that faces that point forward
  // The globe's initial rotation.y = PI*0.18 centres on ~32° E (JHB area).
  // To face a given longitude: rotation.y = -lng * PI/180  (then negate for our coord system)
  function lngToRotY(lng) {
    return -lng * (Math.PI / 180);
  }
  function latToRotX(lat) {
    return lat * (Math.PI / 180) * 0.35;  // damped — full tilt looks extreme
  }

  /* ── Project → City mapping ─────────────────────────────── */
  // Johannesburg is always the origin (home base)
  var HOME = { name: 'Johannesburg', lat: -26.2, lng: 28.0 };

  // data-project-link index → destination city
  var PROJECT_CITIES = {
    0: { name: 'South Africa',  lat: -26.2,  lng: 28.0  },   // Viking Gear → SA (home)
    1: { name: 'Sydney',        lat: -33.87, lng: 151.21 },   // Rebel Kids → Australia
    2: { name: 'New York',      lat: 40.71,  lng: -74.0  }    // Mannequin Films → NY
  };

  // Default (idle) globe orientation — Africa/Europe forward
  var DEFAULT_ROT_Y = Math.PI * 0.18;
  var DEFAULT_ROT_X = Math.PI * 0.05;
  var DEFAULT_CAM_Z = 3.6;


  /* ── Shaders ─────────────────────────────────────────────── */

  /* --- Earth particles (reactive glow) --- */
  var earthVert = [
    'attribute float aSize;',
    'attribute float aAlpha;',
    'uniform vec2  uMouse;',
    'uniform float uMouseIn;',
    'uniform float uTime;',
    'varying float vAlpha;',
    'varying float vGlow;',
    'void main() {',
    '  vAlpha = aAlpha;',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vec4 proj = projectionMatrix * mv;',
    '  vec2 screen = proj.xy / proj.w;',
    '  float dist = length(screen - uMouse);',
    '  float prox = 1.0 - smoothstep(0.08, 0.55, dist);',
    '  vGlow = prox * uMouseIn;',
    '  float sizeMult = 1.0 + prox * uMouseIn * 1.8;',
    '  gl_PointSize = aSize * sizeMult * (4.0 / -mv.z);',
    '  gl_Position  = proj;',
    '}'
  ].join('\n');

  var earthFrag = [
    'varying float vAlpha;',
    'varying float vGlow;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5);',
    '  if (d > 0.5) discard;',
    '  float soft = 1.0 - smoothstep(0.3, 0.5, d);',
    '  vec3 baseCol = vec3(0.1, 0.4, 1.0);',
    '  vec3 glowCol = vec3(0.75, 0.88, 1.0);',
    '  vec3 col = mix(baseCol, glowCol, vGlow * 0.7);',
    '  float alpha = vAlpha * soft + vGlow * 0.6 * soft;',
    '  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));',
    '}'
  ].join('\n');

  /* --- Atmosphere halo --- */
  var haloVert = [
    'attribute float aSize;',
    'attribute float aAlpha;',
    'attribute float aSpeed;',
    'uniform float uTime;',
    'varying float vAlpha;',
    'void main() {',
    '  vAlpha = aAlpha;',
    '  vec3 pos = position;',
    '  pos += normal * sin(uTime * aSpeed + position.x * 4.0) * 0.012;',
    '  vec4 mv = modelViewMatrix * vec4(pos, 1.0);',
    '  gl_PointSize = aSize * (3.5 / -mv.z);',
    '  gl_Position  = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var haloFrag = [
    'varying float vAlpha;',
    'void main() {',
    '  float d = length(gl_PointCoord - 0.5);',
    '  if (d > 0.5) discard;',
    '  float soft = 1.0 - smoothstep(0.15, 0.5, d);',
    '  gl_FragColor = vec4(0.7, 0.85, 1.0, vAlpha * soft);',
    '}'
  ].join('\n');

  /* --- HUD orbit rings --- */
  var ringVert = [
    'void main() {',
    '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
    '}'
  ].join('\n');

  var ringFrag = [
    'uniform float uOpacity;',
    'void main() {',
    '  gl_FragColor = vec4(0.45, 0.65, 0.85, uOpacity);',
    '}'
  ].join('\n');

  /* --- Arc shader --- */
  var arcVert = [
    'attribute float aProgress;',
    'uniform float uTime;',
    'uniform float uSpeed;',
    'uniform float uTrailLength;',
    'uniform float uHighlight;',    // 0 = dim, 1 = full brightness
    'varying float vBrightness;',
    'void main() {',
    '  float head = fract(uTime * uSpeed);',
    '  float dist = aProgress - head;',
    '  if (dist < 0.0) dist += 1.0;',
    '  float trail = 1.0 - smoothstep(0.0, uTrailLength, dist);',
    '  float baseLine = mix(0.04, 0.12, uHighlight);',
    '  float peak = mix(0.3, 1.0, uHighlight);',
    '  vBrightness = baseLine + trail * (peak - baseLine);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');

  var arcFrag = [
    'uniform vec3  uColor;',
    'uniform float uHighlight;',
    'varying float vBrightness;',
    'void main() {',
    '  float alpha = vBrightness * mix(0.35, 0.75, uHighlight);',
    '  gl_FragColor = vec4(uColor * vBrightness, alpha);',
    '}'
  ].join('\n');


  /* ── Scene builder ───────────────────────────────────────── */
  function buildScene(wrap, posArr, sizeArr, alpArr) {
    var rect = wrap.getBoundingClientRect();
    var W = rect.width  || (window.innerWidth  * 0.4);
    var H = rect.height || (window.innerHeight - 64);

    var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);
    wrap.appendChild(renderer.domElement);

    var scene  = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 1000);
    camera.position.set(0, 0, DEFAULT_CAM_Z);

    var globe = new THREE.Group();
    scene.add(globe);

    /* ── 1. Earth particles ── */
    var earthGeo = new THREE.BufferGeometry();
    earthGeo.setAttribute('position', new THREE.BufferAttribute(posArr,  3));
    earthGeo.setAttribute('aSize',    new THREE.BufferAttribute(sizeArr, 1));
    earthGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(alpArr,  1));

    var earthMat = new THREE.ShaderMaterial({
      vertexShader:   earthVert,
      fragmentShader: earthFrag,
      transparent: true,
      depthWrite:  false,
      blending:    THREE.AdditiveBlending,
      uniforms: {
        uMouse:   { value: new THREE.Vector2(0, 0) },
        uMouseIn: { value: 0.0 },
        uTime:    { value: 0.0 }
      }
    });

    globe.add(new THREE.Points(earthGeo, earthMat));


    /* ── 2. Atmosphere halo ── */
    var HALO_COUNT = 800;
    var haloPos = new Float32Array(HALO_COUNT * 3);
    var haloNrm = new Float32Array(HALO_COUNT * 3);
    var haloSz  = new Float32Array(HALO_COUNT);
    var haloAl  = new Float32Array(HALO_COUNT);
    var haloSp  = new Float32Array(HALO_COUNT);

    for (var i = 0; i < HALO_COUNT; i++) {
      var hr = RADIUS + 0.04 + Math.random() * 0.14;
      var ht = Math.random() * Math.PI * 2;
      var hp = Math.acos(2 * Math.random() - 1);
      var hx = hr * Math.sin(hp) * Math.cos(ht);
      var hy = hr * Math.cos(hp);
      var hz = hr * Math.sin(hp) * Math.sin(ht);
      haloPos[i*3] = hx; haloPos[i*3+1] = hy; haloPos[i*3+2] = hz;
      var hl = Math.sqrt(hx*hx + hy*hy + hz*hz);
      haloNrm[i*3] = hx/hl; haloNrm[i*3+1] = hy/hl; haloNrm[i*3+2] = hz/hl;
      haloSz[i]  = 0.4 + Math.random() * 0.6;
      haloAl[i]  = 0.04 + Math.random() * 0.10;
      haloSp[i]  = 0.3 + Math.random() * 0.7;
    }

    var haloGeo = new THREE.BufferGeometry();
    haloGeo.setAttribute('position', new THREE.BufferAttribute(haloPos, 3));
    haloGeo.setAttribute('normal',   new THREE.BufferAttribute(haloNrm, 3));
    haloGeo.setAttribute('aSize',    new THREE.BufferAttribute(haloSz,  1));
    haloGeo.setAttribute('aAlpha',   new THREE.BufferAttribute(haloAl,  1));
    haloGeo.setAttribute('aSpeed',   new THREE.BufferAttribute(haloSp,  1));

    var haloMat = new THREE.ShaderMaterial({
      vertexShader: haloVert, fragmentShader: haloFrag,
      transparent: true, depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0.0 } }
    });

    globe.add(new THREE.Points(haloGeo, haloMat));


    /* ── 3. HUD orbit rings ── */
    var hudGroup = new THREE.Group();
    globe.add(hudGroup);

    function makeRing(radius, tilt, rotY, opacity) {
      var segments = 128, verts = [];
      for (var j = 0; j <= segments; j++) {
        var angle = (j / segments) * Math.PI * 2;
        verts.push(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      var mat = new THREE.ShaderMaterial({
        vertexShader: ringVert, fragmentShader: ringFrag,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { uOpacity: { value: opacity } }
      });
      var line = new THREE.LineLoop(geo, mat);
      line.rotation.x = tilt; line.rotation.y = rotY;
      return line;
    }

    hudGroup.add(makeRing(1.22,  0.3,  0,   0.15));
    hudGroup.add(makeRing(1.30, -0.5,  0.4, 0.10));
    hudGroup.add(makeRing(1.38,  0.8, -0.2, 0.07));
    hudGroup.add(makeRing(1.01,  0,    0,    0.06));
    hudGroup.add(makeRing(1.01, Math.PI/2, 0, 0.04));

    // HUD crosshair overlay
    var hudOverlay = document.createElement('div');
    hudOverlay.className = 'globe-hud-overlay';
    hudOverlay.innerHTML = '<div class="hud-crosshair"></div>';
    wrap.appendChild(hudOverlay);
    requestAnimationFrame(function() { hudOverlay.style.opacity = '1'; });


    /* ── 4. Connection arcs (one per project) ── */
    var arcColors = [
      new THREE.Vector3(0.55, 0.80, 1.0),   // Viking Gear — cool blue
      new THREE.Vector3(0.45, 0.90, 0.75),   // Rebel Kids — teal
      new THREE.Vector3(0.75, 0.60, 0.95)    // Mannequin Films — purple
    ];
    var arcSpeeds = [0.13, 0.11, 0.14];

    // arcData[projectIndex] = { mat, line }
    var arcData = {};

    function createArc(fromCity, toCity, colorVec, speed) {
      var p0 = latLngToVec3(fromCity.lat, fromCity.lng, RADIUS);
      var p1 = latLngToVec3(toCity.lat,   toCity.lng,   RADIUS);
      var mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
      var dist = p0.distanceTo(p1);
      var arcH = RADIUS + 0.15 + dist * 0.35;
      mid.normalize().multiplyScalar(arcH);

      var curve = new THREE.QuadraticBezierCurve3(p0, mid, p1);
      var ARC_SEG = 80;
      var pts = curve.getPoints(ARC_SEG);
      var positions = new Float32Array(pts.length * 3);
      var progress  = new Float32Array(pts.length);
      for (var k = 0; k < pts.length; k++) {
        positions[k*3] = pts[k].x; positions[k*3+1] = pts[k].y; positions[k*3+2] = pts[k].z;
        progress[k] = k / (pts.length - 1);
      }

      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position',  new THREE.BufferAttribute(positions, 3));
      geo.setAttribute('aProgress', new THREE.BufferAttribute(progress,  1));

      var mat = new THREE.ShaderMaterial({
        vertexShader: arcVert, fragmentShader: arcFrag,
        transparent: true, depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime:        { value: 0.0 },
          uSpeed:       { value: speed },
          uTrailLength: { value: 0.28 },
          uColor:       { value: colorVec },
          uHighlight:   { value: 0.0 }
        }
      });

      var line = new THREE.Line(geo, mat);
      globe.add(line);
      return { mat: mat, line: line };
    }

    // City markers
    function createCityMarker(lat, lng) {
      var pos = latLngToVec3(lat, lng, RADIUS + 0.008);
      var dotGeo = new THREE.SphereGeometry(0.012, 8, 8);
      var dotMat = new THREE.MeshBasicMaterial({
        color: 0x88bbff, transparent: true, opacity: 0.8
      });
      var dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      globe.add(dot);

      var ringGeo = new THREE.RingGeometry(0.015, 0.022, 16);
      var ringMat = new THREE.MeshBasicMaterial({
        color: 0x88bbff, transparent: true, opacity: 0.3, side: THREE.DoubleSide
      });
      var ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(pos.clone().multiplyScalar(2));
      globe.add(ring);
      return { dot: dot, ring: ring, ringMat: ringMat };
    }

    // JHB home marker (always present)
    var homeMarker = createCityMarker(HOME.lat, HOME.lng);

    // Create arcs + destination markers for each project
    var projectKeys = Object.keys(PROJECT_CITIES);
    var destMarkers = {};

    for (var pi = 0; pi < projectKeys.length; pi++) {
      var projIdx = parseInt(projectKeys[pi]);
      var city = PROJECT_CITIES[projIdx];
      arcData[projIdx] = createArc(HOME, city, arcColors[pi], arcSpeeds[pi]);
      destMarkers[projIdx] = createCityMarker(city.lat, city.lng);
    }


    /* ── Orient globe ── */
    globe.rotation.y = DEFAULT_ROT_Y;
    globe.rotation.x = DEFAULT_ROT_X;


    /* ── 5. Project-hover → rotate globe to city ── */
    var activeProject = -1;   // -1 = none hovered
    var targetRotY = DEFAULT_ROT_Y;
    var targetRotX = DEFAULT_ROT_X;
    var targetCamZ = DEFAULT_CAM_Z;

    // Compute target rotations for each project city
    var projectTargets = {};
    projectKeys.forEach(function(key) {
      var idx = parseInt(key);
      var city = PROJECT_CITIES[idx];
      // midpoint longitude between JHB and destination for a nice framing
      var midLng = (HOME.lng + city.lng) / 2;
      var midLat = (HOME.lat + city.lat) / 2;

      // For SA (same location as home), just zoom in slightly
      if (idx === 0) {
        projectTargets[idx] = {
          rotY: DEFAULT_ROT_Y,
          rotX: DEFAULT_ROT_X,
          camZ: 2.9
        };
      } else {
        projectTargets[idx] = {
          rotY: lngToRotY(midLng),
          rotX: latToRotX(midLat),
          camZ: 3.0
        };
      }
    });

    // Listen for project item hover events
    function bindProjectHovers() {
      var items = document.querySelectorAll('.project-item');
      items.forEach(function(item) {
        var linkEl = item.querySelector('[data-project-link]');
        if (!linkEl) return;
        var projIdx = parseInt(linkEl.getAttribute('data-project-link'));

        item.addEventListener('mouseenter', function() {
          activeProject = projIdx;
          var tgt = projectTargets[projIdx];
          if (tgt) {
            targetRotY = tgt.rotY;
            targetRotX = tgt.rotX;
            targetCamZ = tgt.camZ;
          }
        });

        item.addEventListener('mouseleave', function() {
          if (activeProject === projIdx) {
            activeProject = -1;
            targetRotY = DEFAULT_ROT_Y;
            targetRotX = DEFAULT_ROT_X;
            targetCamZ = DEFAULT_CAM_Z;
          }
        });
      });
    }

    bindProjectHovers();

    /* ── Mobile: respond to scroll-activated project changes ── */
    document.addEventListener('colab:mobileProjectActivate', function (e) {
      var idx = e.detail && e.detail.index;
      if (idx == null || idx < 0) return;
      var tgt = projectTargets[idx];
      if (tgt) {
        activeProject = idx;
        targetRotY = tgt.rotY;
        targetRotX = tgt.rotX;
        targetCamZ = tgt.camZ;
      }
    });


    /* ── Drag — with momentum / inertia ── */
    var isDragging = false, prevX = 0, prevY = 0, velX = 0, velY = 0;
    var IDLE_SPEED_Y = 0.0060;   // neutral auto-rotate speed
    var FRICTION     = 0.96;     // per-frame decay (higher = heavier, longer coast)
    var SETTLE_LERP  = 0.008;    // how fast momentum blends back toward idle speed
    wrap.style.cursor = 'grab';

    var mouseNDC = new THREE.Vector2(9, 9);
    var mouseInside = false;

    wrap.addEventListener('mouseenter', function () { mouseInside = true; });
    wrap.addEventListener('mouseleave', function () { mouseInside = false; });

    wrap.addEventListener('mousemove', function (e) {
      var r = wrap.getBoundingClientRect();
      mouseNDC.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouseNDC.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    });

    wrap.addEventListener('mousedown', function (e) {
      isDragging = true; prevX = e.clientX; prevY = e.clientY;
      velX = 0; velY = 0; wrap.style.cursor = 'grabbing';
      /* Release city lock so user can freely rotate */
      activeProject = -1;
      targetCamZ = DEFAULT_CAM_Z;
    });
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      velY = (e.clientX - prevX) * 0.005;
      velX = (e.clientY - prevY) * 0.005;
      globe.rotation.y += velY;
      globe.rotation.x += velX;
      prevX = e.clientX; prevY = e.clientY;
    });
    window.addEventListener('mouseup', function () {
      isDragging = false; wrap.style.cursor = 'grab';
    });

    wrap.addEventListener('touchstart', function (e) {
      isDragging = true;
      velX = 0; velY = 0;
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
      /* Release city lock so user can freely rotate */
      activeProject = -1;
      targetCamZ = DEFAULT_CAM_Z;
    }, { passive: true });
    window.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      velY = (e.touches[0].clientX - prevX) * 0.005;
      velX = (e.touches[0].clientY - prevY) * 0.005;
      globe.rotation.y += velY; globe.rotation.x += velX;
      prevX = e.touches[0].clientX; prevY = e.touches[0].clientY;
    }, { passive: true });
    window.addEventListener('touchend', function () { isDragging = false; });


    /* ── Animate ── */
    var clock = new THREE.Clock();
    // Smoothing rate for globe rotation lerp
    var LERP_SPEED = 0.04;
    var globeRafId = null;
    var globeRunning = true;

    function animate() {
      if (!globeRunning) return;
      globeRafId = requestAnimationFrame(animate);
      var t = clock.getElapsedTime();

      // --- Globe rotation ---
      if (!isDragging) {
        if (activeProject >= 0) {
          // Smoothly rotate toward target city
          // Shortest-path rotation on Y (handle wraparound)
          var diffY = targetRotY - globe.rotation.y;
          // Normalise to -PI..PI for shortest path
          while (diffY > Math.PI) diffY -= Math.PI * 2;
          while (diffY < -Math.PI) diffY += Math.PI * 2;
          globe.rotation.y += diffY * LERP_SPEED;
          globe.rotation.x += (targetRotX - globe.rotation.x) * LERP_SPEED;
          // Kill any residual momentum when locked to a project
          velX *= 0.85;
          velY *= 0.85;
        } else {
          // ── Momentum phase: apply velocity then decay toward idle ──
          // Apply current velocity
          globe.rotation.y += velY;
          globe.rotation.x += velX;

          // Friction: decay velocity each frame
          velX *= FRICTION;
          velY *= FRICTION;

          // Gradually blend Y velocity toward idle speed
          // This creates the "settling" feel — the globe coasts, slows,
          // then smoothly resumes its neutral drift
          velY += (IDLE_SPEED_Y - velY) * SETTLE_LERP;

          // Blend X velocity toward 0 (no permanent tilt drift)
          velX += (0 - velX) * SETTLE_LERP;
        }
      }

      // Camera zoom
      camera.position.z += (targetCamZ - camera.position.z) * 0.05;

      // Subtle breathing
      globe.scale.setScalar(1.0 + Math.sin(t * 0.4) * 0.002);

      // HUD rings counter-rotate
      hudGroup.rotation.y = -t * 0.08;
      hudGroup.rotation.x = Math.sin(t * 0.15) * 0.05;

      // --- Update earth uniforms ---
      earthMat.uniforms.uTime.value = t;
      earthMat.uniforms.uMouse.value.copy(mouseNDC);
      earthMat.uniforms.uMouseIn.value += ((mouseInside ? 1.0 : 0.0) - earthMat.uniforms.uMouseIn.value) * 0.08;

      haloMat.uniforms.uTime.value = t;

      // --- Arc animation + highlight ---
      for (var ai = 0; ai < projectKeys.length; ai++) {
        var pIdx = parseInt(projectKeys[ai]);
        var arc = arcData[pIdx];
        arc.mat.uniforms.uTime.value = t;
        // Smoothly highlight/dim arcs
        var hlTarget = (activeProject === pIdx) ? 1.0 : 0.0;
        var hlCur = arc.mat.uniforms.uHighlight.value;
        arc.mat.uniforms.uHighlight.value += (hlTarget - hlCur) * 0.08;
      }

      // --- City marker pulse ---
      var pulseAlpha = 0.2 + Math.sin(t * 2.5) * 0.15;
      homeMarker.ringMat.opacity = pulseAlpha;
      for (var mi = 0; mi < projectKeys.length; mi++) {
        var mIdx = parseInt(projectKeys[mi]);
        destMarkers[mIdx].ringMat.opacity = pulseAlpha;
      }

      renderer.render(scene, camera);
    }
    animate();

    function onGlobeResize() {
      var nW = wrap.offsetWidth, nH = wrap.offsetHeight;
      if (nW && nH) {
        camera.aspect = nW / nH;
        camera.updateProjectionMatrix();
        renderer.setSize(nW, nH);
      }
    }
    window.addEventListener('resize', onGlobeResize);

    /* ── Globe lifecycle — exposed globally for Barba transitions ── */
    window.colabGlobe = {
      pause: function () {
        globeRunning = false;
        if (globeRafId) { cancelAnimationFrame(globeRafId); globeRafId = null; }
      },
      resume: function () {
        if (!globeRunning) { globeRunning = true; animate(); }
      },
      isInit: true
    };
  }


  /* ── Init ─────────────────────────────────────────────────── */
  function init() {
    var wrap = document.querySelector('[data-globe]');
    if (!wrap) return;

    fetch('https://unpkg.com/world-atlas@2/land-110m.json')
      .then(function (r) { return r.json(); })
      .then(function (topo) {
        var worker;
        try { worker = new Worker('js/globe.worker.js'); } catch(e) { computeInline(wrap, topo); return; }
        worker.postMessage({ topo: topo, landTarget: 42000, oceanTarget: 2500 });
        worker.onmessage = function (e) {
          worker.terminate();
          buildScene(wrap, e.data.positions, e.data.sizes, e.data.alphas);
        };
        worker.onerror = function (err) {
          worker.terminate();
          computeInline(wrap, topo);
        };
      })
      .catch(function () {
        buildScene(wrap, new Float32Array(0), new Float32Array(0), new Float32Array(0));
      });
  }

  /* ── Inline fallback ─────────────────────────────────────── */
  function computeInline(wrap, topo) {
    var features = topoToGeoInline(topo);
    var positions = [], sizes = [], alphas = [];
    var placed = 0, attempts = 0;
    while (placed < 24000 && attempts < 360000) {
      attempts++;
      var lat = Math.asin(2 * Math.random() - 1) * (180 / Math.PI);
      var lng = Math.random() * 360 - 180;
      if (!isLandInline(lng, lat, features)) continue;
      var r = RADIUS + (Math.random() - 0.5) * 0.004;
      var phi = (90 - lat) * (Math.PI / 180), theta = -lng * (Math.PI / 180);
      positions.push(r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi), -r * Math.sin(phi) * Math.cos(theta));
      sizes.push(1.0 + Math.random() * 0.5);
      alphas.push(0.9 + Math.random() * 0.1);
      placed++;
    }
    buildScene(wrap, new Float32Array(positions), new Float32Array(sizes), new Float32Array(alphas));
  }

  function pointInRing(lng, lat, ring) {
    var inside = false, j = ring.length - 1;
    for (var i = 0; i < ring.length; i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if (((yi > lat) !== (yj > lat)) && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
      j = i;
    }
    return inside;
  }
  function isLandInline(lng, lat, features) {
    for (var f = 0; f < features.length; f++) {
      var g = features[f].geometry; if (!g) continue;
      if (g.type === 'Polygon') { if (pointInRing(lng, lat, g.coordinates[0])) return true; }
      else if (g.type === 'MultiPolygon') { for (var p = 0; p < g.coordinates.length; p++) { if (pointInRing(lng, lat, g.coordinates[p][0])) return true; } }
    }
    return false;
  }
  function topoToGeoInline(topo) {
    var obj = topo.objects['land'];
    var sc = topo.transform.scale, tr = topo.transform.translate;
    var dec = topo.arcs.map(function(arc) {
      var x = 0, y = 0;
      return arc.map(function(pt) { x += pt[0]; y += pt[1]; return [x*sc[0]+tr[0], y*sc[1]+tr[1]]; });
    });
    function st(idxs) { var r = []; idxs.forEach(function(i) { var a = i<0?dec[~i].slice().reverse():dec[i].slice(); r=r.concat(a.slice(0,-1)); }); r.push(r[0]); return r; }
    return obj.geometries.map(function(g) {
      if (g.type==='Polygon') return {geometry:{type:'Polygon',coordinates:g.arcs.map(st)}};
      if (g.type==='MultiPolygon') return {geometry:{type:'MultiPolygon',coordinates:g.arcs.map(function(p){return p.map(st);})}};
      return {geometry:null};
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    requestAnimationFrame(function () { waitForThree(init); });
  });

  /* Allow Barba transitions to re-init globe if needed */
  window.colabGlobeInit = function () {
    if (window.colabGlobe && window.colabGlobe.isInit) {
      window.colabGlobe.resume();
      return;
    }
    waitForThree(init);
  };
}());
