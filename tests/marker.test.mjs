// cavekit-map-rendering.md R2 — the Chisinau marker and a label-free map (T-023).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { FULL_VIEW, gridPointFraction } from './geo.mjs';

const M = loadQmlJs('Model.js');
const marker = readRepoFile('CenterMarker.qml');
const basemap = readRepoFile('Basemap.qml');
const panel = readRepoFile('Panel.qml');

test('R2: the marker is drawn at the projected centre coordinate', () => {
  assert.match(marker, /Model\.projectPoint\(Model\.GRID_CENTER\.lon, Model\.GRID_CENTER\.lat,\s*root\.width, root\.height, root\.viewport\)/);
  const c = plain(M.GRID_CENTER);
  assert.equal(c.lat, 47.01);
  assert.equal(c.lon, 28.86);
});

test('R2: the marker lands at the centre of the map area', () => {
  const W = 480, H = W / M.MAP_ASPECT;
  const c = plain(M.GRID_CENTER);
  const p = plain(M.projectPoint(c.lon, c.lat, W, H, FULL_VIEW));
  assert.ok(Math.abs(p.x - W / 2) <= 0.01 * W);
  assert.ok(Math.abs(p.y - H / 2) <= 0.01 * H);
});

test('R2: the marker is drawn above the outlines and the cloud field', () => {
  // Its own layer, stacked last in the map area, so an opaque cloud cell at
  // 100% cover cannot hide it.
  const panelSource = readRepoFile('Panel.qml');
  const basemapAt = panelSource.indexOf('Basemap {');
  const cloudAt = panelSource.indexOf('CloudLayer {');
  const markerAt = panelSource.indexOf('CenterMarker {');
  assert.ok(basemapAt > 0 && cloudAt > basemapAt, 'the cloud field must sit above the outlines');
  assert.ok(markerAt > cloudAt, 'the marker must sit above the cloud field');
});

test('R2: the marker is visible geometry, not a hairline', () => {
  assert.ok(M.MARKER_DOT_RADIUS > 0);
  assert.ok(M.MARKER_RING_RADIUS > M.MARKER_DOT_RADIUS, 'the ring must sit outside the dot');
  assert.ok(M.MARKER_RING_WIDTH > 0);
});

test('R2: no place-name or city labels appear on the map', () => {
  // The map layer draws no text at all: no canvas text calls and no Text items.
  for (const source of [basemap, marker, readRepoFile('CloudLayer.qml')]) {
    for (const call of ['fillText', 'strokeText', 'measureText']) {
      assert.ok(!source.includes(call), `the map must not draw text (${call})`);
    }
    assert.ok(!/\bText\s*\{/.test(source), 'the map must contain no Text elements');
  }
});

test('R2: the map area itself carries no text overlay', () => {
  // Text elsewhere in the popup is chrome; inside the map area there is none.
  const start = panel.indexOf('id: mapArea');
  assert.ok(start > 0, 'expected the map area');
  const region = panel.slice(start, panel.indexOf('\n        }', start));
  assert.ok(!/\bText\s*\{/.test(region), 'the map area must not host text labels');
});

test('R2: the marker uses the theme colour like the outlines', () => {
  assert.match(marker, /ctx\.fillStyle = root\.markerColor/);
  assert.deepEqual(marker.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
  assert.deepEqual(basemap.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});
