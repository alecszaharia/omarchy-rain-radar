// cavekit-weather-data.md R1 — deterministic point generation (T-006).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const points = plain(M.gridPoints());

test('R1: the point set contains exactly 109 points', () => {
  assert.equal(points.length, 109);
  assert.equal(M.GRID_POINT_COUNT, 109);
});

test('R1: 108 of them are grid points arranged as 12 columns by 9 rows', () => {
  const cells = points.slice(0, M.GRID_CELL_COUNT);
  assert.equal(cells.length, 108);
  assert.equal(new Set(cells.map((p) => p.lon.toFixed(6))).size, 12, 'expected 12 distinct columns');
  assert.equal(new Set(cells.map((p) => p.lat.toFixed(6))).size, 9, 'expected 9 distinct rows');
});

test('R1: the point set contains the exact center sample', () => {
  const center = points[M.GRID_CENTER_INDEX];
  assert.equal(center.lat, 47.01);
  assert.equal(center.lon, 28.86);
});

test('R1: column centres run 20.61 to 37.11 in steps of 1.5', () => {
  const lons = [...new Set(points.slice(0, 108).map((p) => p.lon))].sort((a, b) => a - b);
  assert.equal(lons.length, 12);
  for (let i = 0; i < lons.length; i++) {
    assert.ok(Math.abs(lons[i] - (20.61 + 1.5 * i)) < 0.001, `column ${i} at ${lons[i]}`);
  }
  assert.ok(Math.abs(lons[0] - 20.61) < 0.001);
  assert.ok(Math.abs(lons[11] - 37.11) < 0.001);
});

test('R1: row centres run 41.667 to 52.333 in steps of 12/9', () => {
  const lats = [...new Set(points.slice(0, 108).map((p) => p.lat))].sort((a, b) => a - b);
  assert.equal(lats.length, 9);
  const step = 12.0 / 9.0;
  for (let i = 0; i < lats.length; i++) {
    assert.ok(Math.abs(lats[i] - (41.0 + step * (i + 0.5))) < 0.001, `row ${i} at ${lats[i]}`);
  }
  assert.ok(Math.abs(lats[0] - 41.667) < 0.001);
  assert.ok(Math.abs(lats[8] - 52.333) < 0.001);
});

test('R1: generation is deterministic in value and order', () => {
  assert.deepEqual(plain(M.gridPoints()), plain(M.gridPoints()));
  assert.deepEqual(points, plain(M.gridPoints()));
});

test('R1: cells run row-major from the north-west corner', () => {
  // Order is part of the contract: the grid model indexes cells[] by it.
  assert.ok(points[0].lat > points[12].lat, 'row 0 must be north of row 1');
  assert.ok(points[0].lon < points[1].lon, 'columns must run west to east');
});
