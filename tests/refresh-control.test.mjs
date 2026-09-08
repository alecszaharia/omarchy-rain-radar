// cavekit-map-rendering.md R6 — the popup refresh control (T-048).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './qml-js.mjs';

const panel = readRepoFile('Panel.qml');
const service = readRepoFile('WeatherData.qml');

const control = (() => {
  const start = panel.indexOf('// ---- Refresh control (R6)');
  return panel.slice(start, panel.indexOf('// ---- Status (R5)'));
})();

test('R6: the popup contains a refresh control', () => {
  assert.ok(control.length > 0, 'expected a refresh control in the popup');
  assert.match(control, /MouseArea \{/);
  assert.match(control, /onClicked: root\.requestRefresh\(\)/);
  assert.match(control, /text: root\.refreshing \? "Refreshing…" : "Refresh"/);
});

test('R6: the control triggers a manual refresh', () => {
  assert.match(panel, /function requestRefresh\(\)[\s\S]*?return weather\.requestManualRefresh\(\)/);
  assert.match(service, /function requestManualRefresh\(\) \{\s*return root\.refresh\(\)\s*\}/);
});

test('R6: pressing it during a fetch issues no additional request', () => {
  // It goes through the same single-flight guard as every other path, so a
  // press while a fetch is running returns false without touching the wire.
  assert.match(service, /function refresh\(\) \{\s*if \(fetchProcess\.running\) return false/);
  assert.equal((service.match(/fetchProcess\.running = true/g) || []).length, 1,
    'only one place may start a request');
  // And there is no second, guard-free path from the popup.
  assert.ok(!/fetchProcess/.test(panel), 'the popup must not reach the process directly');
  assert.ok(!/\.refresh\(\)/.test(control), 'the control must go through requestRefresh');
});

test('R6: the control shows that a refresh is already running', () => {
  assert.match(panel, /readonly property bool refreshing: weather \? weather\.fetching : false/);
  assert.match(service, /readonly property bool fetching: fetchProcess\.running/);
  assert.match(control, /opacity: root\.refreshing \? 0\.5 : 1\.0/);
});

test('R6: a popup with no service attached does not throw', () => {
  assert.match(panel, /function requestRefresh\(\) \{\s*if \(!weather\) return false/);
});

test('R6: the control follows the bar theme', () => {
  assert.match(control, /color: root\.foregroundColor/);
  assert.match(control, /font\.family: root\.themeFontFamily/);
  assert.match(control, /border\.color: root\.foregroundColor/);
  assert.deepEqual(control.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});
