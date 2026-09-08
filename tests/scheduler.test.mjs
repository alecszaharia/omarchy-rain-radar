// cavekit-weather-data.md R4 — the refresh schedule (T-028).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');

test('R4: the scheduled interval equals the refreshMinutes setting', () => {
  for (const minutes of [10, 20, 45, 120]) {
    assert.equal(M.refreshIntervalMs(minutes), minutes * 60 * 1000);
  }
  assert.match(service, /readonly property int refreshIntervalMs: Model\.refreshIntervalMs\(root\.refreshMinutesSetting\)/);
  assert.match(service, /interval: root\.refreshIntervalMs/);
});

test('R4: the effective interval is the clamped value', () => {
  assert.equal(M.refreshIntervalMs(5), 10 * 60 * 1000);
  assert.equal(M.refreshIntervalMs(500), 120 * 60 * 1000);
  assert.equal(M.refreshIntervalMs('nonsense'), 20 * 60 * 1000);
});

test('R4: changing the setting changes the next fetch without a restart', () => {
  // The interval is a binding on the setting rather than a value copied at
  // construction, so a settings edit re-evaluates it and the timer restarts on
  // the new period.
  const timerBlock = service.slice(service.indexOf('property Timer refreshTimer'));
  assert.match(timerBlock, /interval: root\.refreshIntervalMs/);
  assert.ok(!/interval:\s*\d/.test(timerBlock), 'the interval must not be a fixed literal');
  assert.ok(!/refreshIntervalMs\s*=/.test(service), 'the interval must be derived, not assigned');
});

test('R4: the schedule repeats and drives a refresh', () => {
  const timerBlock = service.slice(service.indexOf('property Timer refreshTimer'));
  assert.match(timerBlock, /repeat: true/);
  assert.match(timerBlock, /running: true/);
  // Through the due check, so a monitor whose peer already refreshed stands
  // down instead of fetching the same points again.
  assert.match(timerBlock, /onTriggered: root\.refreshIfDue\(\)/);
});

test('R4: a scheduled tick cannot stack a second request', () => {
  // refresh() is the single-flight guard, so a tick during a slow fetch is a
  // no-op rather than a second request on the wire.
  assert.match(service, /function refresh\(\) \{\s*if \(fetchProcess\.running\) return false/);
});

test('R4: the timer does not fire its own first shot', () => {
  // The load-time decision in T-036 owns whether the first fetch happens.
  assert.match(service, /triggeredOnStart: false/);
});
