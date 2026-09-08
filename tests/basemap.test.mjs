// cavekit-map-rendering.md R2 — basemap rendering and the emphasis rule (T-015).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const outlines = plain(loadQmlJs('data/Outlines.js').OUTLINES);
const basemap = readRepoFile('Basemap.qml');
const docs = readRepoFile('docs/rendering.md');

const moldova = outlines.regions.find((r) => r.id === 'moldova');
const neighbour = outlines.regions.find((r) => r.id === 'romania');
const water = outlines.regions.find((r) => r.id === 'black-sea');

test('R2: Moldova differs from its neighbours in stroke weight and opacity', () => {
  const emphasized = plain(M.basemapStyle(moldova));
  const plainStyle = plain(M.basemapStyle(neighbour));
  assert.ok(emphasized.lineWidth > plainStyle.lineWidth,
    'the emphasized outline must be heavier');
  assert.ok(emphasized.opacity > plainStyle.opacity,
    'the emphasized outline must be stronger');
  assert.equal(emphasized.lineWidth, plainStyle.lineWidth * M.BASEMAP_EMPHASIS_STROKE_MULTIPLIER);
});

test('R2: the emphasis rule applies to Moldova alone', () => {
  const emphasized = outlines.regions
    .filter((r) => plain(M.basemapStyle(r)).opacity === M.BASEMAP_EMPHASIS_OPACITY && r.kind !== 'water')
    .map((r) => r.id);
  assert.deepEqual(emphasized, ['moldova']);
});

test('R2: water is filled and the countries are not', () => {
  assert.equal(plain(M.basemapStyle(water)).filled, true);
  assert.equal(plain(M.basemapStyle(moldova)).filled, false);
  assert.equal(plain(M.basemapStyle(neighbour)).filled, false);
});

test('R2: the emphasis rule is documented', () => {
  assert.match(docs, /## Basemap emphasis rule/);
  assert.match(docs, /BASEMAP_STROKE_WIDTH \* 2/);
  assert.match(docs, /0\.45/);
});

test('R2: the renderer applies the rule rather than restating it', () => {
  assert.match(basemap, /Model\.basemapStyle\(region\)/);
  // Scoped to the outline loop, ending at its opacity reset: that is where
  // basemapStyle is the sole source of truth.
  const loopStart = basemap.indexOf('for (var pass = 0');
  const loopEnd = basemap.lastIndexOf('ctx.globalAlpha = 1.0');
  assert.ok(loopStart > 0 && loopEnd > loopStart, 'expected the outline loop and its opacity reset');
  const loop = basemap.slice(loopStart, loopEnd);
  assert.ok(!/lineWidth = [\d.]+/.test(loop), 'stroke width must come from the rule');
  assert.ok(!/globalAlpha = [\d.]+/.test(loop), 'opacity must come from the rule');
  assert.match(loop, /ctx\.globalAlpha = style\.opacity/);
  assert.match(loop, /ctx\.lineWidth = style\.lineWidth/);
});

test('R2: Moldova is drawn last so a shared border cannot overdraw it', () => {
  assert.match(basemap, /var order = \["water", "neighbour", "emphasis"\]/);
});

test('R2: outlines are stroked in the bar foreground, not a fixed palette', () => {
  assert.match(basemap, /property color strokeColor/);
  assert.match(basemap, /ctx\.strokeStyle = root\.strokeColor/);
  assert.deepEqual(basemap.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});

test('R2: the projection is re-derived on every paint', () => {
  // No cached pixel geometry, so a resize is just another paint.
  assert.match(basemap, /Model\.projectPoint\(ring\[i\], ring\[i \+ 1\], root\.width, root\.height\)/);
  assert.match(basemap, /onWidthChanged: requestPaint\(\)/);
  assert.match(basemap, /onHeightChanged: requestPaint\(\)/);
});
