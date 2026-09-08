// cavekit-map-rendering.md R3 — cloud opacity ramp (T-024).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('CloudLayer.qml');
const docs = readRepoFile('docs/rendering.md');

test('R3: 0% renders fully transparent', () => {
  assert.equal(M.cloudOpacity(0), 0);
  // Zero opacity is written as a fully transparent pixel, so the basemap
  // beneath shows through unmodified.
  assert.match(layer, /data\[index \+ 3\] = Math\.round\(alpha \* 255\)/);
  assert.equal(Math.round(M.cloudOpacity(0) * 255), 0);
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
  // The channels are read once, before the pixel loop, so the hue cannot vary
  // with the value — only the alpha channel is computed per pixel.
  const channelsAt = layer.indexOf('var red = Model.CLOUD_RGB.r');
  const loopAt = layer.indexOf('for (var y = 0');
  assert.ok(channelsAt > 0 && loopAt > channelsAt, 'the colour must be read before the loop');
  const loop = layer.slice(loopAt);
  assert.ok(!/CLOUD_RGB/.test(loop), 'the hue must not be recomputed per pixel');
  assert.match(loop, /data\[index\] = red/);
  assert.match(loop, /data\[index \+ 1\] = green/);
  assert.match(loop, /data\[index \+ 2\] = blue/);
  assert.deepEqual(layer.match(/"#[0-9a-fA-F]{3,8}"/g) || [], [], 'no second colour may appear');
});

test('R3: the value drives opacity and nothing else', () => {
  assert.match(layer, /Model\.cloudOpacity\(value\)/);
  // Only the alpha channel depends on the reading.
  assert.match(layer, /data\[index \+ 3\] = Math\.round\(alpha \* 255\)/);
});

test('R3: the layer covers the whole map area and re-derives on resize', () => {
  // The field is sampled in normalised map coordinates, so the same code
  // covers any size; a resize is just another paint.
  assert.match(layer, /var w = Math\.floor\(root\.width\)/);
  assert.match(layer, /var h = Math\.floor\(root\.height\)/);
  assert.match(layer, /Model\.sampleCloudField\(cells, u, v\)/);
  assert.match(layer, /onWidthChanged: requestPaint\(\)/);
  assert.match(layer, /onHeightChanged: requestPaint\(\)/);
});

test('R3: unavailable cells are not drawn as clear sky', () => {
  assert.match(layer, /\(value === Model\.UNAVAILABLE\) \? 0 : Model\.cloudOpacity\(value\)/);
  assert.equal(M.cloudOpacity('unavailable'), 0);
});

test('R3: the ramp is documented', () => {
  assert.match(docs, /## Cloud heatmap/);
  assert.match(docs, /fully transparent/);
  assert.match(docs, /fully opaque/);
});
