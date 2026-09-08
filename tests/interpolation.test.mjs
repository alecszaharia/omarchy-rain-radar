// cavekit-map-rendering.md R3 — bilinear interpolation of the cloud field (T-031).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('CloudLayer.qml');

// A field built from a per-cell function, so expectations are exact.
function field(valueAt) {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      cells.push({ cloudCoverPercent: valueAt(col, row), precipitationMm: 0 });
    }
  }
  return cells;
}

const at = (col, row) => plain(M.gridPointFraction(col, row));

test('R3: the field reproduces each reading at its own grid point', () => {
  const cells = field((col, row) => (col * 7 + row * 3) % 101);
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const p = at(col, row);
      const sampled = M.sampleCloudField(cells, p.u, p.v);
      assert.ok(Math.abs(sampled - cells[row * M.GRID_COLUMNS + col].cloudCoverPercent) < 1e-9,
        `sample at grid point ${col},${row} drifted`);
    }
  }
});

test('R3: midway between two adjacent points lies strictly between them', () => {
  const cells = field((col) => (col === 3 ? 20 : (col === 4 ? 80 : 50)));
  const a = at(3, 4);
  const b = at(4, 4);
  const mid = M.sampleCloudField(cells, (a.u + b.u) / 2, a.v);
  assert.ok(mid > 20 && mid < 80, `midpoint ${mid} must lie strictly between 20 and 80`);
  assert.ok(Math.abs(mid - 50) < 1e-9, 'a linear blend puts the midpoint halfway');
});

test('R3: the same holds vertically', () => {
  const cells = field((col, row) => (row === 2 ? 10 : (row === 3 ? 90 : 50)));
  const a = at(6, 2);
  const b = at(6, 3);
  const mid = M.sampleCloudField(cells, a.u, (a.v + b.v) / 2);
  assert.ok(mid > 10 && mid < 90, `midpoint ${mid} must lie strictly between 10 and 90`);
});

test('R3: this is interpolation, not a nearest-cell fill', () => {
  // A nearest-cell fill would step: every sample in a cell would equal that
  // cell's reading. Across a row of differing readings the field must change
  // continuously instead.
  const cells = field((col) => col * 8);
  const a = at(2, 4);
  const b = at(3, 4);
  const samples = [];
  for (let t = 0; t <= 1; t += 0.1) {
    samples.push(M.sampleCloudField(cells, a.u + (b.u - a.u) * t, a.v));
  }
  const distinct = new Set(samples.map((s) => s.toFixed(6)));
  assert.ok(distinct.size > 5, `a stepped fill would repeat values; saw ${distinct.size} distinct`);
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i] > samples[i - 1], 'the field must vary monotonically along the ramp');
  }
});

test('R3: beyond the outermost grid points the field is flat, not extrapolated', () => {
  // The sample lattice sits half a cell inside each edge; past it the edge
  // reading holds rather than running off to values the source never reported.
  const cells = field((col) => (col === 0 ? 10 : 90));
  const edge = at(0, 4);
  const corner = M.sampleCloudField(cells, 0, edge.v);
  assert.ok(Math.abs(corner - 10) < 1e-9, `edge sample ${corner} must hold the edge reading`);
  for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const sample = M.sampleCloudField(cells, u, v);
    assert.ok(sample >= 0 && sample <= 100, `corner sample ${sample} out of range`);
  }
});

test('R3: an unavailable corner does not bleed into its neighbours', () => {
  const cells = field(() => 60);
  cells[4 * M.GRID_COLUMNS + 5].cloudCoverPercent = M.UNAVAILABLE;
  // A neighbouring grid point still reports its own reading exactly.
  const p = at(7, 4);
  assert.ok(Math.abs(M.sampleCloudField(cells, p.u, p.v) - 60) < 1e-9);
  // And the reading at the unavailable point's own location comes from the
  // remaining corners rather than vanishing.
  const q = at(5, 4);
  const sampled = M.sampleCloudField(cells, q.u, q.v);
  assert.ok(sampled === M.UNAVAILABLE || (sampled >= 0 && sampled <= 100));
});

test('R3: a field with no usable reading anywhere is unavailable', () => {
  const cells = field(() => M.UNAVAILABLE);
  assert.equal(M.sampleCloudField(cells, 0.5, 0.5), M.UNAVAILABLE);
  assert.equal(M.sampleCloudField(null, 0.5, 0.5), M.UNAVAILABLE);
  assert.equal(M.sampleCloudField([], 0.5, 0.5), M.UNAVAILABLE);
});

test('R3: the layer paints the interpolated field into the canvas buffer', () => {
  // Rectangles sampled at their centres from the interpolated field — not one
  // reading per cell, which would show the 12x9 lattice.
  assert.match(layer, /Model\.sampleCloudField\(cells, u, v\)/);
  assert.match(layer, /var columns = Model\.FIELD_RECT_COLUMNS/);
  assert.ok(M.FIELD_RECT_COLUMNS > M.GRID_COLUMNS, 'the rect grid must be finer than the cells');
});

test('R3: the field still uses one colour, varying only alpha', () => {
  assert.deepEqual(plain(M.CLOUD_RGB), { r: 0x9a, g: 0xa0, b: 0xa6 });
  assert.equal(`#${[M.CLOUD_RGB.r, M.CLOUD_RGB.g, M.CLOUD_RGB.b].map((c) => c.toString(16)).join('')}`,
    M.CLOUD_COLOR);
  // Across a ramp the layer varies only the opacity; the fill colour is the
  // one constant it sets.
  const cells = field((col) => col * 8);
  const alphas = new Set();
  for (let rx = 0; rx < M.FIELD_RECT_COLUMNS; rx++) {
    const u = (rx + 0.5) / M.FIELD_RECT_COLUMNS;
    const value = M.sampleCloudField(cells, u, 0.5);
    alphas.add(M.cloudOpacity(value).toFixed(4));
  }
  assert.ok(alphas.size > 10, 'the ramp must produce many distinct opacities');
  assert.match(readRepoFile('CloudLayer.qml'), /ctx\.fillStyle = Model\.CLOUD_COLOR/);
});
