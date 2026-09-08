// cavekit-map-rendering.md R1 — equirectangular projection (T-007).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const B = plain(M.GRID_BOUNDS);
const W = 480;
const H = W / M.MAP_ASPECT;

test('R1: the four corners of the bounds map to the four corners of the map area', () => {
  const corners = [
    [B.minLon, B.maxLat, 0, 0],
    [B.maxLon, B.maxLat, W, 0],
    [B.minLon, B.minLat, 0, H],
    [B.maxLon, B.minLat, W, H]
  ];
  for (const [lon, lat, x, y] of corners) {
    const p = plain(M.projectPoint(lon, lat, W, H));
    assert.ok(Math.abs(p.x - x) < 1e-9, `lon ${lon} -> x ${p.x}, expected ${x}`);
    assert.ok(Math.abs(p.y - y) < 1e-9, `lat ${lat} -> y ${p.y}, expected ${y}`);
  }
});

test('R1: the center coordinate maps to the map-area centre within 1%', () => {
  const c = plain(M.GRID_CENTER);
  const p = plain(M.projectPoint(c.lon, c.lat, W, H));
  assert.ok(Math.abs(p.x - W / 2) <= 0.01 * W, `x off by ${Math.abs(p.x - W / 2) / W}`);
  assert.ok(Math.abs(p.y - H / 2) <= 0.01 * H, `y off by ${Math.abs(p.y - H / 2) / H}`);
});

test('R1: longitude increases x and latitude decreases y, monotonically', () => {
  let prevX = -Infinity;
  for (let lon = B.minLon; lon <= B.maxLon; lon += 0.25) {
    const { x } = plain(M.projectPoint(lon, B.minLat, W, H));
    assert.ok(x > prevX, `x must strictly increase with longitude at ${lon}`);
    prevX = x;
  }
  let prevY = Infinity;
  for (let lat = B.minLat; lat <= B.maxLat; lat += 0.25) {
    const { y } = plain(M.projectPoint(B.minLon, lat, W, H));
    assert.ok(y < prevY, `y must strictly decrease with latitude at ${lat}`);
    prevY = y;
  }
});

test('R1: units per degree are constant across the map area', () => {
  // Sampling the local scale everywhere must give the same numbers as the
  // global scale — that is the absence of differential stretching.
  const scale = plain(M.projectionScale(W, H));
  const d = 0.5;
  for (let lon = B.minLon; lon + d <= B.maxLon; lon += 1.5) {
    for (let lat = B.minLat; lat + d <= B.maxLat; lat += 1.5) {
      const a = plain(M.projectPoint(lon, lat, W, H));
      const b = plain(M.projectPoint(lon + d, lat + d, W, H));
      assert.ok(Math.abs((b.x - a.x) / d - scale.xPerLon) < 1e-9, `x scale drifts at ${lon},${lat}`);
      assert.ok(Math.abs((a.y - b.y) / d - scale.yPerLat) < 1e-9, `y scale drifts at ${lon},${lat}`);
    }
  }
});

test('R1: at MAP_ASPECT the horizontal and vertical scales are equal', () => {
  assert.equal(M.MAP_ASPECT, 1.5);
  const scale = plain(M.projectionScale(W, W / M.MAP_ASPECT));
  assert.ok(Math.abs(scale.xPerLon - scale.yPerLat) < 1e-9,
    'laying the map area out at MAP_ASPECT must preserve the aspect ratio of the bounds');
});

test('R1: the projection is resolution-independent', () => {
  // Same fractions at any size — this is what lets T-014 re-derive on resize.
  for (const [w, h] of [[300, 200], [900, 600], [1200, 800]]) {
    const c = plain(M.GRID_CENTER);
    const p = plain(M.projectPoint(c.lon, c.lat, w, h));
    assert.ok(Math.abs(p.x / w - M.projectLonFraction(c.lon)) < 1e-12);
    assert.ok(Math.abs(p.y / h - M.projectLatFraction(c.lat)) < 1e-12);
  }
});
