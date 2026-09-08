// cavekit-weather-data.md R4 — manual refresh and single flight (T-037).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile } from './qml-js.mjs';

const service = readRepoFile('WeatherData.qml');

// Mirrors the guard in WeatherData.refresh(): a request starts only when the
// process is not already running, and the process runs until it exits.
function makeService() {
  let running = false;
  let requests = 0;
  let maxConcurrent = 0;
  return {
    refresh() {
      if (running) return false;
      running = true;
      requests += 1;
      maxConcurrent = Math.max(maxConcurrent, 1);
      return true;
    },
    finish() { running = false; },
    get requests() { return requests; },
    get maxConcurrent() { return maxConcurrent; },
    get running() { return running; }
  };
}

test('R4: a manual refresh starts a fetch when none is in flight', () => {
  const service = makeService();
  assert.equal(service.refresh(), true);
  assert.equal(service.requests, 1);
});

test('R4: two manual refreshes during one fetch issue exactly one request', () => {
  const service = makeService();
  service.refresh();
  assert.equal(service.refresh(), false, 'the second press must not start a request');
  assert.equal(service.refresh(), false, 'nor the third');
  assert.equal(service.requests, 1);
});

test('R4: a manual refresh works again once the fetch has finished', () => {
  const service = makeService();
  service.refresh();
  service.finish();
  assert.equal(service.refresh(), true);
  assert.equal(service.requests, 2);
});

test('R4: two fetches are never in flight at once', () => {
  const service = makeService();
  // Manual presses and scheduled ticks interleaved arbitrarily.
  const script = ['manual', 'manual', 'tick', 'finish', 'tick', 'manual', 'manual', 'finish', 'manual'];
  for (const step of script) {
    if (step === 'finish') service.finish();
    else service.refresh();
    assert.ok(!service.running || service.maxConcurrent === 1);
  }
  assert.equal(service.maxConcurrent, 1);
  assert.equal(service.requests, 3, 'only the presses that found a free line should have fetched');
});

test('R4: the manual path is the same guard as the scheduled path', () => {
  // A second entry point that skipped the guard could put two on the wire.
  assert.match(service, /function requestManualRefresh\(\) \{\s*return root\.refresh\(\)\s*\}/);
  assert.match(service, /function refresh\(\) \{\s*if \(fetchProcess\.running\) return false/);
  // Only one place may start the process.
  assert.equal((service.match(/fetchProcess\.running = true/g) || []).length, 1);
});

test('R4: the scheduled and startup paths go through the same guard too', () => {
  assert.match(service, /onTriggered: root\.refresh\(\)/);
  assert.match(service, /if \(decision\.fetchNow\) root\.refresh\(\)/);
});
