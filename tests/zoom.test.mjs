// cavekit-map-rendering.md R8 — zoom.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile, readRepoJson } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const panel = readRepoFile('Panel.qml');
const docs = readRepoFile('docs/rendering.md');
const B = plain(M.GRID_BOUNDS);

const levels = () => {
  const out = [];
  for (let z = M.ZOOM_MIN; z <= M.ZOOM_MAX + 1e-9; z += M.ZOOM_STEP) out.push(Number(z.toFixed(3)));
  return out;
};

test('R8: the zoom range and step are documented constants', () => {
  assert.equal(M.ZOOM_MIN, 1.0);
  assert.equal(M.ZOOM_MAX, 4.0);
  assert.ok(M.ZOOM_STEP > 0 && M.ZOOM_STEP <= 1);
  assert.match(docs, /## Zoom/);
  assert.ok(docs.includes(String(M.ZOOM_MAX)), 'the maximum must be documented');
});

test('R8: at minimum zoom the window is exactly the sampled bounds', () => {
  assert.deepEqual(plain(M.viewportFor(M.ZOOM_MIN)), B);
});

test('R8: zooming in shows a strictly smaller window', () => {
  let previous = plain(M.viewportFor(M.ZOOM_MIN));
  for (const level of levels().slice(1)) {
    const view = plain(M.viewportFor(level));
    assert.ok(view.maxLon - view.minLon < previous.maxLon - previous.minLon,
      `longitude span did not shrink at ${level}`);
    assert.ok(view.maxLat - view.minLat < previous.maxLat - previous.minLat,
      `latitude span did not shrink at ${level}`);
    previous = view;
  }
});

test('R8: the window never extends outside the sampled bounds', () => {
  // The map may only show ground the source actually reported on.
  for (const level of levels()) {
    const view = plain(M.viewportFor(level));
    assert.ok(view.minLon >= B.minLon - 1e-9 && view.maxLon <= B.maxLon + 1e-9, `longitude at ${level}`);
    assert.ok(view.minLat >= B.minLat - 1e-9 && view.maxLat <= B.maxLat + 1e-9, `latitude at ${level}`);
  }
});

test('R8: every level keeps the aspect ratio the projection depends on', () => {
  for (const level of levels()) {
    const view = plain(M.viewportFor(level));
    const aspect = (view.maxLon - view.minLon) / (view.maxLat - view.minLat);
    assert.ok(Math.abs(aspect - M.MAP_ASPECT) < 1e-9,
      `aspect ${aspect} at zoom ${level} does not match ${M.MAP_ASPECT}`);
  }
});

test('R8: the window is clamped by shifting, so the span is never shrunk', () => {
  // Chisinau sits slightly north of the bounds' centre, so an unshifted window
  // at minimum zoom would run past the northern edge.
  const view = plain(M.viewportFor(M.ZOOM_MIN));
  assert.equal(view.maxLat - view.minLat, B.maxLat - B.minLat);
  assert.ok(M.GRID_CENTER.lat + (B.maxLat - B.minLat) / 2 > B.maxLat,
    'the fixture for this rule must actually overhang');
});

test('R8: zoom is clamped to the documented range', () => {
  assert.equal(M.clampZoom(0), M.ZOOM_MIN);
  assert.equal(M.clampZoom(-5), M.ZOOM_MIN);
  assert.equal(M.clampZoom(99), M.ZOOM_MAX);
  assert.equal(M.clampZoom(2.5), 2.5);
  for (const value of [undefined, null, NaN, Infinity, 'two', {}]) {
    assert.equal(M.clampZoom(value), M.ZOOM_MIN, `${String(value)} must fall back to the minimum`);
  }
});

test('R8: the centre stays on screen at every level', () => {
  for (const level of levels()) {
    const view = plain(M.viewportFor(level));
    const p = plain(M.projectPoint(M.GRID_CENTER.lon, M.GRID_CENTER.lat, 100, 100, view));
    assert.ok(p.x >= 0 && p.x <= 100, `centre off screen horizontally at ${level}`);
    assert.ok(p.y >= 0 && p.y <= 100, `centre off screen vertically at ${level}`);
  }
});

test('R8: the field is sampled through the window, not the full extent', () => {
  // A point at the left edge of a zoomed window must map to the grid position
  // of that longitude, not to the grid's own left edge.
  const view = plain(M.viewportFor(4));
  assert.ok(Math.abs(M.viewToGridU(0, view) - (view.minLon - B.minLon) / (B.maxLon - B.minLon)) < 1e-12);
  assert.ok(Math.abs(M.viewToGridV(0, view) - (B.maxLat - view.maxLat) / (B.maxLat - B.minLat)) < 1e-12);
  // At full extent the mapping is the identity.
  const full = plain(M.viewportFor(M.ZOOM_MIN));
  for (const t of [0, 0.25, 0.5, 1]) {
    assert.ok(Math.abs(M.viewToGridU(t, full) - t) < 1e-12, `u identity at ${t}`);
    assert.ok(Math.abs(M.viewToGridV(t, full) - t) < 1e-12, `v identity at ${t}`);
  }
});

test('R8: zooming asks the source for nothing', () => {
  // The window is derived from constants alone; no fetch, no new request.
  const before = M.requestUrl();
  M.viewportFor(M.ZOOM_MAX);
  assert.equal(M.requestUrl(), before);
  assert.ok(!/viewport|zoom/i.test(readRepoFile('WeatherData.qml')),
    'the data service must know nothing about zoom');
});

test('R8: zoom is view state, not a user setting', () => {
  // The plugin still declares exactly one setting.
  const schema = readRepoJson('manifest.json').barWidget.schema;
  assert.equal(schema.length, 1);
  assert.equal(schema[0].key, 'refreshMinutes');
  assert.match(panel, /property real zoom: Model\.ZOOM_MIN/);
  assert.ok(!/setting\(\s*"[^"]*zoom/i.test(panel), 'zoom must not be read from settings');
});

test('R8: the popup offers zoom in and out, disabled at the limits', () => {
  assert.match(panel, /readonly property bool canZoomIn: root\.zoom < Model\.ZOOM_MAX/);
  assert.match(panel, /readonly property bool canZoomOut: root\.zoom > Model\.ZOOM_MIN/);
  assert.match(panel, /actionable: root\.canZoomOut/);
  assert.match(panel, /actionable: root\.canZoomIn/);
  assert.match(panel, /onActivated: root\.zoomBy\(-1\)/);
  assert.match(panel, /onActivated: root\.zoomBy\(1\)/);
});

test('R8: the map also zooms on the wheel without swallowing clicks', () => {
  assert.match(panel, /WheelHandler \{/);
  assert.match(panel, /root\.zoomBy\(event\.angleDelta\.y > 0 \? 1 : -1\)/);
  // A MouseArea over the map would take the presses the popup needs.
  const mapStart = panel.indexOf('id: mapArea');
  const mapEnd = panel.indexOf('// ---- Controls (R6, R8)');
  assert.ok(!/MouseArea \{/.test(panel.slice(mapStart, mapEnd)), 'the map must not host a MouseArea');
});

test('R8: every layer draws through the same window', () => {
  for (const layer of ['Basemap', 'CloudLayer', 'PrecipitationLayer', 'CenterMarker']) {
    const start = panel.indexOf(`${layer} {`);
    assert.ok(start > 0, `${layer} must be in the map area`);
    assert.match(panel.slice(start, panel.indexOf('}', start)), /viewport: root\.viewport/,
      `${layer} must be given the viewport`);
    assert.match(readRepoFile(`${layer}.qml`), /property var viewport/,
      `${layer}.qml must accept a viewport`);
  }
});
