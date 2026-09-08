// cavekit-weather-data.md R4 — the load-time refresh decision (T-036).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');

const INTERVAL = 20 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 8, 8, 12, 0, 0));

function modelAged(minutes) {
  const fetchedAt = new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();
  return plain(M.buildGridModel(completeResponse(), fetchedAt));
}

const decide = (model) => plain(M.loadTimeDecision(model, NOW, INTERVAL));

test('R4: with no cached model a fetch starts on load', () => {
  assert.equal(decide(null).fetchNow, true);
});

test('R4: with an undatable cached model a fetch starts on load', () => {
  const model = modelAged(5);
  model.fetchedAt = 'not a time';
  assert.equal(decide(model).fetchNow, true);
});

test('R4: a cache younger than one interval starts no fetch', () => {
  for (const minutes of [0, 1, 10, 19.9]) {
    assert.equal(decide(modelAged(minutes)).fetchNow, false, `${minutes} minutes old`);
  }
});

test('R4: the next fetch is due one interval after the cached fetch, not after load', () => {
  // A restart 15 minutes into a 20-minute interval leaves 5 minutes, not 20.
  const decision = decide(modelAged(15));
  assert.equal(decision.fetchNow, false);
  assert.equal(decision.nextFetchDelayMs, 5 * 60 * 1000);

  const older = decide(modelAged(19));
  assert.equal(older.nextFetchDelayMs, 1 * 60 * 1000);
});

test('R4: a cache older than one interval is shown and a fetch starts', () => {
  for (const minutes of [20, 25, 39]) {
    const decision = decide(modelAged(minutes));
    assert.equal(decision.fetchNow, true, `${minutes} minutes old must refresh`);
  }
  // The model itself is untouched by the decision, so it stays on screen.
  const model = modelAged(25);
  const before = plain(model);
  decide(model);
  assert.deepEqual(plain(model), before);
});

test('R4: freshness follows the configured interval, not a fixed number', () => {
  const model = modelAged(30);
  assert.equal(plain(M.loadTimeDecision(model, NOW, 20 * 60 * 1000)).fetchNow, true);
  assert.equal(plain(M.loadTimeDecision(model, NOW, 60 * 60 * 1000)).fetchNow, false);
});

test('R4: a fetch time in the future is not treated as fresh', () => {
  // A clock change must not park the widget indefinitely.
  const model = modelAged(-60);
  assert.equal(M.modelAgeMs(model, NOW), null);
  assert.equal(decide(model).fetchNow, true);
});

test('R4: the decision runs once, after the cache read has answered', () => {
  assert.match(service, /onCacheCheckedChanged: root\.handleStartup\(\)/);
  assert.match(service, /if \(root\.startupHandled \|\| !root\.cacheChecked\) return/);
  assert.match(service, /root\.startupHandled = true/);
});

test('R4: the decision drives the fetch and the catch-up timer', () => {
  assert.match(service, /var decision = Model\.loadTimeDecision\(root\.gridModel, new Date\(\), root\.refreshIntervalMs\)/);
  assert.match(service, /resumeTimer\.interval = Math\.max\(1, decision\.nextFetchDelayMs\)/);
  assert.match(service, /resumeTimer\.running = !decision\.fetchNow/);
  assert.match(service, /if \(decision\.fetchNow\) root\.refresh\(\)/);
});
