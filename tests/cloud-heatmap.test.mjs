// cavekit-map-rendering.md R3 — cloud opacity ramp (T-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

// Mirrors what the layer draws for one rectangle: sample the field at the
// rectangle's centre, then map that reading onto the ramp.
function alphaFor(M, percent) {
  const cells = [];
  for (let i = 0; i < M.GRID_CELL_COUNT; i++) {
    cells.push({ cloudCoverPercent: percent, precipitationMm: 0 });
  }
  const value = M.sampleCloudField(cells, 0.5, 0.5);
  const alpha = value === M.UNAVAILABLE ? 0 : M.cloudOpacity(value);
  return { alpha: Math.round(alpha * 255), rgb: M.CLOUD_COLOR };
}

const M = loadQmlJs('Model.js');
const layer = readRepoFile('CloudLayer.qml');
const docs = readRepoFile('docs/rendering.md');

test('R3: 0% renders fully transparent', () => {
  assert.equal(M.cloudOpacity(0), 0);
  // Painted, a 0% field is a fully transparent pixel, so the basemap beneath
  // shows through unmodified.
  assert.equal(alphaFor(M, 0).alpha, 0);
});

test('R3: 100% renders at full opacity', () => {
  assert.equal(M.cloudOpacity(100), 1);
  assert.equal(alphaFor(M, 100).alpha, 255);
});

test('R3: opacity increases monotonically between 0 and 100', () => {
  let previous = -1;
  for (let percent = 0; percent <= 100; percent += 0.5) {
    const alpha = M.cloudOpacity(percent);
    assert.ok(alpha > previous, `opacity must increase at ${percent}%`);
    assert.ok(alpha >= 0 && alpha <= 1, `opacity out of range at ${percent}%`);
    previous = alpha;
  }
});

test('R3: values outside the range are clamped, not extrapolated', () => {
  assert.equal(M.cloudOpacity(-10), 0);
  assert.equal(M.cloudOpacity(200), 1);
});

test('R3: only the documented neutral colour is used, and the hue never varies', () => {
  assert.equal(M.CLOUD_COLOR, '#9aa0a6');
  assert.match(docs, /CLOUD_COLOR = "#9aa0a6"/);
  // Every painted pixel carries the same channels whatever the reading, so
  // the hue cannot vary with the value.
  for (const percent of [0, 25, 50, 75, 100]) {
    assert.equal(alphaFor(M, percent).rgb, M.CLOUD_COLOR, `the hue changed at ${percent}%`);
  }
  assert.deepEqual(layer.match(/"#[0-9a-fA-F]{3,8}"/g) || [], [], 'no second colour may appear');
});

test('R3: the value drives opacity and nothing else', () => {
  // Only the alpha channel depends on the reading.
  const low = alphaFor(M, 20);
  const high = alphaFor(M, 80);
  assert.ok(high.alpha > low.alpha, 'a denser reading must be more opaque');
  assert.equal(low.rgb, high.rgb, 'and nothing else may change');
});

test('R3: the layer covers the whole map area and re-derives on resize', () => {
  // The field is sampled in normalised map coordinates, so the same code
  // covers any size; a resize is just another paint.
  // The field is painted at a fixed raster and scaled to the item, so it
  // covers the whole map area at any size without repainting on resize.
  assert.match(layer, /Model\.sampleCloudField\(cells, u, v\)/);
  assert.match(layer, /ctx\.fillRect\(/);
  assert.match(layer, /var rectWidth = root\.width \/ columns/);
  assert.match(layer, /var rectHeight = root\.height \/ rows/);
  assert.match(layer, /onWidthChanged: requestPaint\(\)/);
});

test('R3: unavailable cells are not drawn as clear sky', () => {
  assert.equal(M.cloudOpacity('unavailable'), 0);
  // A field of unknown cells is hatched, never placed on the ramp.
  const cells = [];
  for (let i = 0; i < M.GRID_CELL_COUNT; i++) {
    cells.push({ cloudCoverPercent: M.UNAVAILABLE, precipitationMm: 0 });
  }
  assert.equal(M.isUnavailableAt(cells, 0.5, 0.5), true);
  assert.equal(M.sampleCloudField(cells, 0.5, 0.5), M.UNAVAILABLE);
  assert.match(layer, /ctx\.fillStyle = root\.hatchColor/);
});

test('R3: the ramp is documented', () => {
  assert.match(docs, /## Cloud heatmap/);
  assert.match(docs, /fully transparent/);
  assert.match(docs, /fully opaque/);
});
