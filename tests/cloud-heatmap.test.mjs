// cavekit-map-rendering.md R3 — cloud opacity ramp (T-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

// Paints a uniform field and returns the alpha of a middle pixel, which is how
// the ramp is actually applied on screen.
function alphaFor(M, percent) {
  const cells = [];
  for (let i = 0; i < M.GRID_CELL_COUNT; i++) {
    cells.push({ cloudCoverPercent: percent, precipitationMm: 0 });
  }
  const w = 24, h = 18;
  const data = new Array(w * h * 4).fill(0);
  M.paintCloudField(cells, w, h, data, plain(M.CLOUD_RGB), { r: 0, g: 0, b: 0 });
  const mid = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  return { alpha: data[mid + 3], rgb: [data[mid], data[mid + 1], data[mid + 2]] };
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
    assert.deepEqual(alphaFor(M, percent).rgb, [M.CLOUD_RGB.r, M.CLOUD_RGB.g, M.CLOUD_RGB.b],
      `the hue changed at ${percent}%`);
  }
  assert.deepEqual(layer.match(/"#[0-9a-fA-F]{3,8}"/g) || [], [], 'no second colour may appear');
});

test('R3: the value drives opacity and nothing else', () => {
  // Only the alpha channel depends on the reading.
  const low = alphaFor(M, 20);
  const high = alphaFor(M, 80);
  assert.ok(high.alpha > low.alpha, 'a denser reading must be more opaque');
  assert.deepEqual(low.rgb, high.rgb, 'and nothing else may change');
});

test('R3: the layer covers the whole map area and re-derives on resize', () => {
  // The field is sampled in normalised map coordinates, so the same code
  // covers any size; a resize is just another paint.
  assert.match(layer, /var w = Math\.floor\(root\.width\)/);
  assert.match(layer, /var h = Math\.floor\(root\.height\)/);
  assert.match(layer, /Model\.paintCloudField\(/);
  assert.match(layer, /onWidthChanged: requestPaint\(\)/);
  assert.match(layer, /onHeightChanged: requestPaint\(\)/);
});

test('R3: unavailable cells are not drawn as clear sky', () => {
  assert.equal(M.cloudOpacity('unavailable'), 0);
  // A field of unknown cells paints the hatch colour, never the cloud ramp.
  const cells = [];
  for (let i = 0; i < M.GRID_CELL_COUNT; i++) {
    cells.push({ cloudCoverPercent: M.UNAVAILABLE, precipitationMm: 0 });
  }
  const w = 24, h = 18;
  const data = new Array(w * h * 4).fill(0);
  M.paintCloudField(cells, w, h, data, plain(M.CLOUD_RGB), { r: 1, g: 2, b: 3 });
  const mid = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4;
  assert.deepEqual([data[mid], data[mid + 1], data[mid + 2]], [1, 2, 3]);
});

test('R3: the ramp is documented', () => {
  assert.match(docs, /## Cloud heatmap/);
  assert.match(docs, /fully transparent/);
  assert.match(docs, /fully opaque/);
});
