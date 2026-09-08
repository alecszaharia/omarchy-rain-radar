// cavekit-map-rendering.md R4 — the precipitation overlay (T-032).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { FULL_VIEW, gridPointFraction } from './geo.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('PrecipitationLayer.qml');
const cloud = readRepoFile('CloudLayer.qml');
const panel = readRepoFile('Panel.qml');

function field(mmAt) {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      cells.push({ cloudCoverPercent: 50, precipitationMm: mmAt(col, row) });
    }
  }
  return cells;
}

test('R4: the overlay is composited above the cloud heatmap', () => {
  const cloudAt = panel.indexOf('CloudLayer {');
  const precipAt = panel.indexOf('PrecipitationLayer {');
  assert.ok(cloudAt > 0 && precipAt > cloudAt,
    'the precipitation layer must be stacked after the cloud layer');
  // Both fill the same map area, so wherever both have something to say they
  // overlap and the precipitation is the one on top.
  const blockAt = (marker) => {
    const start = panel.indexOf(marker);
    return panel.slice(start, panel.indexOf('}', start));
  };
  assert.match(blockAt('CloudLayer {'), /anchors\.fill: parent/);
  assert.match(blockAt('PrecipitationLayer {'), /anchors\.fill: parent/);
  assert.match(cloud, /onPaint/);
  assert.match(layer, /onPaint/);
});

test('R4: the layer uses blue only', () => {
  assert.equal(M.PRECIPITATION_COLOR, '#4a90d9');
  assert.deepEqual(plain(M.PRECIPITATION_RGB), { r: 0x4a, g: 0x90, b: 0xd9 });
  const { r, g, b } = plain(M.PRECIPITATION_RGB);
  assert.ok(b > g && g > r, 'the colour must actually be blue');
  // The channels are read once and never recomputed, so no other hue can appear.
  const loop = layer.slice(layer.indexOf('for (var y = 0'));
  assert.ok(!/PRECIPITATION_RGB/.test(loop), 'the hue must not vary per pixel');
  assert.deepEqual(layer.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});

test('R4: intensity is carried by opacity, not by hue', () => {
  // A heavier band is more opaque while the colour stays put.
  const light = plain(M.precipitationBand(M.samplePrecipitationField(field(() => 1.0), 0.5, 0.5)));
  const heavy = plain(M.precipitationBand(M.samplePrecipitationField(field(() => 20.0), 0.5, 0.5)));
  assert.ok(heavy.opacity > light.opacity, 'a heavier band must be more opaque');
  assert.match(layer, /ctx\.fillStyle = Model\.PRECIPITATION_COLOR/);
  assert.match(layer, /ctx\.globalAlpha = band\.opacity/);
});

test('R4: a value in the none band renders no marking', () => {
  assert.equal(plain(M.precipitationBand(0)).opacity, 0);
  assert.equal(plain(M.precipitationBand(0.05)).opacity, 0);
  assert.equal(Math.round(plain(M.precipitationBand(0)).opacity * 255), 0,
    'the none band must be fully transparent');
});

test('R4: an unavailable amount draws nothing', () => {
  assert.equal(plain(M.precipitationBand(M.UNAVAILABLE)).opacity, 0);
  assert.equal(plain(M.precipitationBand(M.sampleField([], 0.5, 0.5, 'precipitationMm'))).opacity, 0);
});

test('R4: the amount is interpolated before it is banded', () => {
  // Banding first would step at cell edges; interpolating first makes the band
  // boundary follow the data.
  assert.match(layer, /Model\.precipitationBand\(Model\.samplePrecipitationField\(cells, gu, gv\)\)/);
  const cells = field((col) => (col === 3 ? 0 : (col === 4 ? 8 : 0)));
  const a = (gridPointFraction(3, 4));
  const b = (gridPointFraction(4, 4));
  const mid = M.samplePrecipitationField(cells, (a.u + b.u) / 2, a.v);
  assert.ok(mid > 0 && mid < 8, `midpoint ${mid} must lie between the readings`);
  // Which means the intermediate bands are actually reachable across a ramp.
  const bands = new Set();
  for (let t = 0; t <= 1; t += 0.02) {
    bands.add(plain(M.precipitationBand(M.samplePrecipitationField(cells, a.u + (b.u - a.u) * t, a.v))).id);
  }
  assert.ok(bands.has('light') && bands.has('moderate'),
    `a ramp from 0 to 8 mm must pass through the middle bands; saw ${[...bands]}`);
});

test('R4: every band is reachable and stronger than the one below', () => {
  const bands = plain(M.PRECIPITATION_BANDS);
  for (const band of bands) {
    const probe = band.maxMm === Infinity ? band.minMm + 10 : (band.minMm + band.maxMm) / 2;
    assert.equal(plain(M.precipitationBand(probe)).id, band.id);
  }
  for (let i = 1; i < bands.length; i++) {
    assert.ok(bands[i].opacity > bands[i - 1].opacity);
  }
});

test('R4: the overlay re-derives on resize like the cloud field', () => {
  // Rect size is derived from the item size on every paint, so a resize is
  // just another paint.
  assert.match(layer, /edgeX\[ex\] = Math\.round\(ex \* root\.width \/ columns\)/);
  assert.match(layer, /edgeY\[ey\] = Math\.round\(ey \* root\.height \/ rows\)/);
  assert.match(layer, /onWidthChanged: requestPaint\(\)/);
});
