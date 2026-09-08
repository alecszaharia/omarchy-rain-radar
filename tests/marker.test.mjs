// cavekit-map-rendering.md R2 — the Chisinau marker and a label-free map (T-023).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const basemap = readRepoFile('Basemap.qml');
const panel = readRepoFile('Panel.qml');

test('R2: the marker is drawn at the projected centre coordinate', () => {
  assert.match(basemap, /Model\.projectPoint\(Model\.GRID_CENTER\.lon, Model\.GRID_CENTER\.lat,\s*root\.width, root\.height\)/);
  const c = plain(M.GRID_CENTER);
  assert.equal(c.lat, 47.01);
  assert.equal(c.lon, 28.86);
});

test('R2: the marker lands at the centre of the map area', () => {
  const W = 480, H = W / M.MAP_ASPECT;
  const c = plain(M.GRID_CENTER);
  const p = plain(M.projectPoint(c.lon, c.lat, W, H));
  assert.ok(Math.abs(p.x - W / 2) <= 0.01 * W);
  assert.ok(Math.abs(p.y - H / 2) <= 0.01 * H);
});

test('R2: the marker is drawn above every outline', () => {
  const markerCall = basemap.indexOf('drawCenterMarker(ctx)');
  const outlineLoop = basemap.indexOf('for (var pass = 0');
  assert.ok(outlineLoop > 0 && markerCall > outlineLoop, 'the marker must be drawn last');
});

test('R2: the marker is visible geometry, not a hairline', () => {
  assert.ok(M.MARKER_DOT_RADIUS > 0);
  assert.ok(M.MARKER_RING_RADIUS > M.MARKER_DOT_RADIUS, 'the ring must sit outside the dot');
  assert.ok(M.MARKER_RING_WIDTH > 0);
});

test('R2: no place-name or city labels appear on the map', () => {
  // The map layer draws no text at all: no canvas text calls and no Text items.
  for (const call of ['fillText', 'strokeText', 'measureText']) {
    assert.ok(!basemap.includes(call), `the map must not draw text (${call})`);
  }
  assert.ok(!/\bText\s*\{/.test(basemap), 'the map must contain no Text elements');
});

test('R2: the map area itself carries no text overlay', () => {
  // Text elsewhere in the popup is chrome; inside the map area there is none.
  const start = panel.indexOf('id: mapArea');
  assert.ok(start > 0, 'expected the map area');
  const region = panel.slice(start, panel.indexOf('\n        }', start));
  assert.ok(!/\bText\s*\{/.test(region), 'the map area must not host text labels');
});

test('R2: the marker uses the theme colour like the outlines', () => {
  assert.match(basemap, /ctx\.fillStyle = root\.strokeColor/);
  assert.deepEqual(basemap.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});
