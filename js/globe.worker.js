/**
 * co:lab — Globe Web Worker
 * Runs the expensive land-point rejection sampling off the main thread.
 */

/* ---- Ray casting ---- */
function pointInRing(lng, lat, ring) {
  var inside = false, j = ring.length - 1;
  for (var i = 0; i < ring.length; i++) {
    var xi = ring[i][0], yi = ring[i][1];
    var xj = ring[j][0], yj = ring[j][1];
    if (((yi > lat) !== (yj > lat)) &&
        (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi)) inside = !inside;
    j = i;
  }
  return inside;
}
function pointInPolygon(lng, lat, rings) {
  if (!pointInRing(lng, lat, rings[0])) return false;
  for (var h = 1; h < rings.length; h++) {
    if (pointInRing(lng, lat, rings[h])) return false;
  }
  return true;
}
function isLand(lng, lat, features) {
  for (var f = 0; f < features.length; f++) {
    var geom = features[f].geometry;
    if (!geom) continue;
    if (geom.type === 'Polygon') {
      if (pointInPolygon(lng, lat, geom.coordinates)) return true;
    } else if (geom.type === 'MultiPolygon') {
      for (var p = 0; p < geom.coordinates.length; p++) {
        if (pointInPolygon(lng, lat, geom.coordinates[p])) return true;
      }
    }
  }
  return false;
}

/* ---- Lat/lng → XYZ ---- */
function latLngToXYZ(lat, lng, r) {
  var phi   = (90 - lat)  * (Math.PI / 180);
  var theta = -lng         * (Math.PI / 180);  /* negate lng to fix mirror */
  return [
     r * Math.sin(phi) * Math.sin(theta),
     r * Math.cos(phi),
    -r * Math.sin(phi) * Math.cos(theta)
  ];
}

/* ---- TopoJSON decoder ---- */
function topoToGeo(topo, objectName) {
  var obj = topo.objects[objectName];
  var scale  = topo.transform ? topo.transform.scale     : [1,1];
  var transl = topo.transform ? topo.transform.translate : [0,0];
  var decoded = topo.arcs.map(function(arc) {
    var x = 0, y = 0;
    return arc.map(function(pt) {
      x += pt[0]; y += pt[1];
      return [x * scale[0] + transl[0], y * scale[1] + transl[1]];
    });
  });
  function stitch(indexes) {
    var ring = [];
    indexes.forEach(function(idx) {
      var a = idx < 0 ? decoded[~idx].slice().reverse() : decoded[idx].slice();
      ring = ring.concat(a.slice(0, -1));
    });
    ring.push(ring[0]);
    return ring;
  }
  return obj.geometries.map(function(geom) {
    if (geom.type === 'Polygon')
      return { geometry: { type: 'Polygon',      coordinates: geom.arcs.map(stitch) } };
    if (geom.type === 'MultiPolygon')
      return { geometry: { type: 'MultiPolygon', coordinates: geom.arcs.map(function(p) { return p.map(stitch); }) } };
    return { geometry: null };
  });
}

/* ---- Main worker message handler ---- */
self.onmessage = function(e) {
  var topo         = e.data.topo;
  var LAND_TARGET  = e.data.landTarget;
  var OCEAN_TARGET = e.data.oceanTarget;
  var RADIUS       = 1.0;

  var features = topoToGeo(topo, 'land');

  var positions = [], sizes = [], alphas = [];

  /* Land points */
  var placed = 0, attempts = 0, max = LAND_TARGET * 15;
  while (placed < LAND_TARGET && attempts < max) {
    attempts++;
    var lat = Math.asin(2 * Math.random() - 1) * (180 / Math.PI);
    var lng = Math.random() * 360 - 180;
    if (!isLand(lng, lat, features)) continue;
    var r = RADIUS + (Math.random() - 0.5) * 0.004;
    var p = latLngToXYZ(lat, lng, r);
    positions.push(p[0], p[1], p[2]);
    sizes.push(1.0 + Math.random() * 0.5);
    alphas.push(0.9 + Math.random() * 0.1);
    placed++;
  }

  /* Ocean points */
  var oPlaced = 0, oAttempts = 0;
  while (oPlaced < OCEAN_TARGET && oAttempts < OCEAN_TARGET * 6) {
    oAttempts++;
    var oLat = Math.asin(2 * Math.random() - 1) * (180 / Math.PI);
    var oLng = Math.random() * 360 - 180;
    if (isLand(oLng, oLat, features)) continue;
    var op = latLngToXYZ(oLat, oLng, RADIUS);
    positions.push(op[0], op[1], op[2]);
    sizes.push(0.5 + Math.random() * 0.3);
    alphas.push(0.12 + Math.random() * 0.08);
    oPlaced++;
  }

  /* Transfer as typed arrays for zero-copy transfer */
  var posArr  = new Float32Array(positions);
  var sizeArr = new Float32Array(sizes);
  var alpArr  = new Float32Array(alphas);

  self.postMessage(
    { positions: posArr, sizes: sizeArr, alphas: alpArr },
    [posArr.buffer, sizeArr.buffer, alpArr.buffer]
  );
};
