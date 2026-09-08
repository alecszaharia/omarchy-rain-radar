// cavekit-map-rendering.md R3 — cloud opacity ramp (T-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('CloudLayer.qml');
const docs = readRepoFile('docs/rendering.md');

test('R3: 0% renders fully transparent', () => {
  assert.equal(M.cloudOpacity(0), 0);
  // A zero-opacity cell is skipped entirely, so the basemap beneath is
  // untouched rather than composited against transparent paint.
  assert.match(layer, /if \(alpha <= 0\) continue/);
});

test('R3: 100% renders at full opacity', () => {
  assert.equal(M.cloudOpacity(100), 1);
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
  // The fill colour is set once, outside the per-cell loop, so it cannot vary
  // with the value.
  const colorAt = layer.indexOf('ctx.fillStyle = Model.CLOUD_COLOR');
  const loopAt = layer.indexOf('for (var i = 0');
  assert.ok(colorAt > 0 && loopAt > colorAt, 'the colour must be set before the loop, not per cell');
  const loop = layer.slice(loopAt);
  assert.ok(!/fillStyle/.test(loop), 'the hue must not vary with the value');
  assert.deepEqual(layer.match(/"#[0-9a-fA-F]{3,8}"/g) || [], [], 'no second colour may appear');
});

test('R3: the value drives opacity and nothing else', () => {
  assert.match(layer, /var alpha = Model\.cloudOpacity\(value\)/);
  assert.match(layer, /ctx\.globalAlpha = alpha/);
});

test('R3: the layer draws on the projection rectangles', () => {
  assert.match(layer, /Model\.cellRects\(root\.width, root\.height\)/);
  // Re-derived per paint, so a resize needs nothing else.
  assert.match(layer, /onWidthChanged: requestPaint\(\)/);
});

test('R3: unavailable cells are not drawn as clear sky', () => {
  assert.match(layer, /if \(value === Model\.UNAVAILABLE\) continue/);
  assert.equal(M.cloudOpacity('unavailable'), 0);
});

test('R3: the ramp is documented', () => {
  assert.match(docs, /## Cloud heatmap/);
  assert.match(docs, /fully transparent/);
  assert.match(docs, /fully opaque/);
});
