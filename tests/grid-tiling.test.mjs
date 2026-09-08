// cavekit-weather-data.md R1 — bounds containment and exact cell tiling (T-010).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const B = plain(M.GRID_BOUNDS);
const points = plain(M.gridPoints());
const cells = points.slice(0, M.GRID_CELL_COUNT);
const EPS = 1e-9;

test('R1: all grid points lie strictly inside the bounds', () => {
  for (const [i, p] of cells.entries()) {
    assert.ok(p.lon > B.minLon + EPS && p.lon < B.maxLon - EPS,
      `cell ${i} longitude ${p.lon} is not strictly inside ${B.minLon}..${B.maxLon}`);
    assert.ok(p.lat > B.minLat + EPS && p.lat < B.maxLat - EPS,
      `cell ${i} latitude ${p.lat} is not strictly inside ${B.minLat}..${B.maxLat}`);
  }
});

test('R1: every grid point is the centre of exactly one cell', () => {
  // Reconstruct each cell from its point and check the point sits dead centre.
  for (const [i, p] of cells.entries()) {
    const col = Math.round((p.lon - B.minLon) / M.GRID_LON_STEP - 0.5);
    const row = Math.round((B.maxLat - p.lat) / M.GRID_LAT_STEP - 0.5);
    assert.ok(col >= 0 && col < M.GRID_COLUMNS, `cell ${i} maps to column ${col}`);
    assert.ok(row >= 0 && row < M.GRID_ROWS, `cell ${i} maps to row ${row}`);
    const west = B.minLon + M.GRID_LON_STEP * col;
    const north = B.maxLat - M.GRID_LAT_STEP * row;
    assert.ok(Math.abs(p.lon - (west + M.GRID_LON_STEP / 2)) < 1e-9, `cell ${i} not horizontally centred`);
    assert.ok(Math.abs(p.lat - (north - M.GRID_LAT_STEP / 2)) < 1e-9, `cell ${i} not vertically centred`);
  }
});

test('R1: each cell is claimed by exactly one point', () => {
  const claimed = new Map();
  for (const p of cells) {
    const col = Math.round((p.lon - B.minLon) / M.GRID_LON_STEP - 0.5);
    const row = Math.round((B.maxLat - p.lat) / M.GRID_LAT_STEP - 0.5);
    const key = `${row},${col}`;
    assert.ok(!claimed.has(key), `cell ${key} claimed twice`);
    claimed.set(key, p);
  }
  assert.equal(claimed.size, M.GRID_COLUMNS * M.GRID_ROWS);
});

test('R1: the 108 cells tile the bounds with no gaps and no overlaps', () => {
  // Total area of the cells must equal the area of the bounds exactly, and the
  // cell edges must partition each axis without leaving a seam.
  const cellArea = M.GRID_LON_STEP * M.GRID_LAT_STEP;
  const boundsArea = (B.maxLon - B.minLon) * (B.maxLat - B.minLat);
  assert.ok(Math.abs(cells.length * cellArea - boundsArea) < 1e-9,
    'summed cell area must equal the bounds area');

  const lonEdges = [];
  for (let c = 0; c <= M.GRID_COLUMNS; c++) lonEdges.push(B.minLon + M.GRID_LON_STEP * c);
  assert.ok(Math.abs(lonEdges[0] - B.minLon) < 1e-9);
  assert.ok(Math.abs(lonEdges[lonEdges.length - 1] - B.maxLon) < 1e-9);

  const latEdges = [];
  for (let r = 0; r <= M.GRID_ROWS; r++) latEdges.push(B.maxLat - M.GRID_LAT_STEP * r);
  assert.ok(Math.abs(latEdges[0] - B.maxLat) < 1e-9);
  assert.ok(Math.abs(latEdges[latEdges.length - 1] - B.minLat) < 1e-9);
});

test('R1: the centre sample is not one of the 108 cell centres', () => {
  // It is an extra 109th point, so it must not collide with a cell centre and
  // silently turn the grid into 107 cells plus a duplicate.
  const center = points[M.GRID_CENTER_INDEX];
  for (const p of cells) {
    assert.ok(!(Math.abs(p.lat - center.lat) < 1e-9 && Math.abs(p.lon - center.lon) < 1e-9),
      'the centre sample coincides with a cell centre');
  }
});
