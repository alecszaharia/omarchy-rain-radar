// cavekit-map-rendering.md R1 — cell rectangles and resize (T-014).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';
import { FULL_VIEW, cellRects } from './geo.mjs';

const M = loadQmlJs('Model.js');
const SIZES = [[480, 320], [300, 200], [960, 640], [1200, 800], [481, 321]];

function rectsAt(w, h) { return cellRects(w, h); }

test('R1: each of the 108 cells maps to a rectangle', () => {
  for (const [w, h] of SIZES) {
    const rects = rectsAt(w, h);
    assert.equal(rects.length, 108, `at ${w}x${h}`);
  }
});

test('R1: the rectangles tile the map area with no gaps and no overlaps', () => {
  for (const [w, h] of SIZES) {
    const rects = rectsAt(w, h);
    const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    assert.ok(Math.abs(area - w * h) < 1e-6, `summed area at ${w}x${h}`);

    // Neighbours must share an edge exactly: the right edge of one column is
    // the left edge of the next, and likewise for rows.
    for (let row = 0; row < M.GRID_ROWS; row++) {
      for (let col = 0; col < M.GRID_COLUMNS - 1; col++) {
        const a = rects[row * M.GRID_COLUMNS + col];
        const b = rects[row * M.GRID_COLUMNS + col + 1];
        assert.ok(Math.abs((a.x + a.width) - b.x) < 1e-9, `column seam at ${row},${col} (${w}x${h})`);
      }
    }
    for (let row = 0; row < M.GRID_ROWS - 1; row++) {
      for (let col = 0; col < M.GRID_COLUMNS; col++) {
        const a = rects[row * M.GRID_COLUMNS + col];
        const b = rects[(row + 1) * M.GRID_COLUMNS + col];
        assert.ok(Math.abs((a.y + a.height) - b.y) < 1e-9, `row seam at ${row},${col} (${w}x${h})`);
      }
    }
    const first = rects[0];
    const last = rects[rects.length - 1];
    assert.ok(Math.abs(first.x) < 1e-9 && Math.abs(first.y) < 1e-9, 'tiling must start at the origin');
    assert.ok(Math.abs(last.x + last.width - w) < 1e-9, 'tiling must reach the right edge');
    assert.ok(Math.abs(last.y + last.height - h) < 1e-9, 'tiling must reach the bottom edge');
  }
});

test('R1: each grid point projects to the centre of its rectangle', () => {
  const points = plain(M.gridPoints()).slice(0, 108);
  for (const [w, h] of SIZES) {
    const rects = rectsAt(w, h);
    for (let i = 0; i < points.length; i++) {
      const p = plain(M.projectPoint(points[i].lon, points[i].lat, w, h, FULL_VIEW));
      const r = rects[i];
      assert.ok(Math.abs(p.x - (r.x + r.width / 2)) < 1e-9, `cell ${i} x at ${w}x${h}`);
      assert.ok(Math.abs(p.y - (r.y + r.height / 2)) < 1e-9, `cell ${i} y at ${w}x${h}`);
    }
  }
});

test('R1: resizing re-derives the tiling rather than scaling a stale one', () => {
  // Same relative geometry at every size is what makes a resize a plain
  // recomputation: no cached pixel values survive it.
  const base = rectsAt(480, 320);
  const bigger = rectsAt(960, 640);
  for (let i = 0; i < base.length; i++) {
    assert.ok(Math.abs(bigger[i].x - base[i].x * 2) < 1e-9, `cell ${i} x did not re-derive`);
    assert.ok(Math.abs(bigger[i].height - base[i].height * 2) < 1e-9, `cell ${i} height did not re-derive`);
  }
});
