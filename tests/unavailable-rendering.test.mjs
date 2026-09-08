// cavekit-map-rendering.md R3 — distinct treatment for unavailable cells (T-040).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('CloudLayer.qml');
const panel = readRepoFile('Panel.qml');
const docs = readRepoFile('docs/rendering.md');

// One unavailable cell in a field that is otherwise a uniform reading.
function fixture(unavailableCol, unavailableRow) {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const unavailable = col === unavailableCol && row === unavailableRow;
      cells.push({
        cloudCoverPercent: unavailable ? M.UNAVAILABLE : 60,
        precipitationMm: 0
      });
    }
  }
  return cells;
}

const COL = 5, ROW = 4;
const cells = fixture(COL, ROW);
const at = (col, row) => plain(M.gridPointFraction(col, row));

test('R3: the unavailable cell renders with the distinct treatment', () => {
  const p = at(COL, ROW);
  assert.equal(M.isUnavailableAt(cells, p.u, p.v), true);
});

test('R3: the treatment is a texture, which no percentage can produce', () => {
  // Alternating alpha along a line is a pattern; a numeric value is a uniform
  // fill, so the two can never be confused.
  const alphas = [];
  for (let x = 0; x < M.UNAVAILABLE_HATCH_PERIOD * 2; x++) alphas.push(M.hatchAlphaAt(x, 0));
  assert.ok(alphas.includes(M.UNAVAILABLE_HATCH_ALPHA), 'the hatch must have stripes');
  assert.ok(alphas.includes(0), 'the hatch must have gaps');
  assert.equal(new Set(alphas).size, 2, 'the hatch alternates between exactly two levels');
  // It repeats on the documented period.
  for (let x = 0; x < 20; x++) {
    assert.equal(M.hatchAlphaAt(x, 0), M.hatchAlphaAt(x + M.UNAVAILABLE_HATCH_PERIOD, 0));
  }
});

test('R3: the treatment differs in colour from the cloud ramp too', () => {
  // Hatched in the theme foreground, not the neutral cloud grey.
  assert.match(layer, /property color hatchColor/);
  assert.match(layer, /data\[index\] = hatchRed/);
  assert.match(panel, /hatchColor: root\.foregroundColor/);
});

test('R3: cells adjacent to the unavailable one render from their own values', () => {
  const neighbours = [[COL - 1, ROW], [COL + 1, ROW], [COL, ROW - 1], [COL, ROW + 1]];
  for (const [col, row] of neighbours) {
    const p = at(col, row);
    assert.equal(M.isUnavailableAt(cells, p.u, p.v), false, `neighbour ${col},${row} must not be hatched`);
    const sampled = M.sampleCloudField(cells, p.u, p.v);
    assert.ok(Math.abs(sampled - 60) < 1e-9,
      `neighbour ${col},${row} must keep its own reading, got ${sampled}`);
  }
});

test('R3: the hatched region is the unavailable cell, not the whole map', () => {
  let hatched = 0;
  let total = 0;
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const p = at(col, row);
      total += 1;
      if (M.isUnavailableAt(cells, p.u, p.v)) hatched += 1;
    }
  }
  assert.equal(hatched, 1, `exactly one cell region may be hatched, saw ${hatched} of ${total}`);
});

test('R3: nearest-cell attribution covers the whole map exactly once', () => {
  const seen = new Set();
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const p = at(col, row);
      const index = M.nearestCellIndex(p.u, p.v);
      assert.equal(index, row * M.GRID_COLUMNS + col, `grid point ${col},${row} must map to its own cell`);
      seen.add(index);
    }
  }
  assert.equal(seen.size, M.GRID_CELL_COUNT);
  // Edges and corners clamp inside rather than running off the array.
  for (const [u, v] of [[0, 0], [1, 1], [-0.5, 0.5], [1.5, 0.5]]) {
    const index = M.nearestCellIndex(u, v);
    assert.ok(index >= 0 && index < M.GRID_CELL_COUNT, `${u},${v} mapped outside the grid`);
  }
});

test('R3: the layer checks availability before placing a pixel on the ramp', () => {
  const unavailableAt = layer.indexOf('Model.isUnavailableAt(cells, u, v)');
  const rampAt = layer.indexOf('Model.sampleCloudField(cells, u, v)');
  assert.ok(unavailableAt > 0 && rampAt > unavailableAt,
    'the unavailable check must come first');
  assert.match(layer, /Model\.hatchAlphaAt\(x, y\)/);
});

test('R3: the treatment is documented', () => {
  assert.match(docs, /### Cells with no reading/);
  assert.match(docs, /period 8 px, 2 px wide, at alpha 0\.5/);
});
