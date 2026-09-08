// cavekit-weather-data.md R5/R6 — the staleness rule (T-039).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const docs = readRepoFile('docs/data.md');

const INTERVAL = 20 * 60 * 1000;
const NOW = new Date(Date.UTC(2026, 8, 8, 12, 0, 0));

function modelAged(minutes) {
  const fetchedAt = new Date(NOW.getTime() - minutes * 60 * 1000).toISOString();
  return plain(M.buildGridModel(completeResponse(), fetchedAt));
}

test('R5: stale means older than twice the configured interval', () => {
  assert.equal(M.STALE_INTERVAL_MULTIPLIER, 2);
  assert.equal(M.staleAfterMs(INTERVAL), 40 * 60 * 1000);
  assert.match(docs, /older than twice the configured interval/);
});

test('R5: a restored model older than twice the interval is stale', () => {
  for (const minutes of [41, 60, 600]) {
    assert.equal(M.isStale(modelAged(minutes), NOW, INTERVAL), true, `${minutes} minutes old`);
  }
});

test('R5: a newer restored model is not stale', () => {
  for (const minutes of [0, 20, 39, 40]) {
    assert.equal(M.isStale(modelAged(minutes), NOW, INTERVAL), false, `${minutes} minutes old`);
  }
});

test('R5: the boundary belongs to the fresh side', () => {
  // Exactly twice the interval is not yet stale; a moment later it is.
  const exact = new Date(NOW.getTime() - 40 * 60 * 1000).toISOString();
  const model = plain(M.buildGridModel(completeResponse(), exact));
  assert.equal(M.isStale(model, NOW, INTERVAL), false);
  assert.equal(M.isStale(model, new Date(NOW.getTime() + 1), INTERVAL), true);
});

test('R5: staleness follows the configured interval', () => {
  const model = modelAged(50);
  assert.equal(M.isStale(model, NOW, 20 * 60 * 1000), true);
  assert.equal(M.isStale(model, NOW, 60 * 60 * 1000), false);
});

test('R5: an undatable model is not called stale', () => {
  const model = modelAged(100);
  model.fetchedAt = 'nonsense';
  assert.equal(M.isStale(model, NOW, INTERVAL), false);
  assert.equal(M.isStale(null, NOW, INTERVAL), false);
});

test('R6: the status is re-evaluated on a tick, not only after a fetch', () => {
  // A model goes stale by the passage of time, so an event-only check would
  // leave the widget claiming ready indefinitely.
  assert.match(service, /property Timer stalenessTimer[\s\S]*?repeat: true[\s\S]*?onTriggered: root\.evaluateStaleness\(\)/);
  assert.match(service, /readonly property int staleAfterMs: Model\.staleAfterMs\(root\.refreshIntervalMs\)/);
});

test('R6: staleness is also evaluated after a success and after a restore', () => {
  const restore = service.slice(service.indexOf('function restoreFromCache'));
  assert.match(restore, /root\.evaluateStaleness\(\)/);
  const apply = service.slice(service.indexOf('function applyResponse'), service.indexOf('property Process'));
  assert.match(apply, /root\.evaluateStaleness\(\)/);
});

test('R6: a fetch in progress or a failed attempt keeps the status', () => {
  const evaluate = service.slice(service.indexOf('function evaluateStaleness'),
                                 service.indexOf('property Timer stalenessTimer'));
  // A fetch in progress owns the status outright.
  assert.match(evaluate, /if \(statusState\.status === Model\.STATUS\.loading\) return/);
  // A failed attempt keeps error through the precedence rule (T-046) rather
  // than a separate early return here.
  assert.match(evaluate, /Model\.resolveStatus\([\s\S]*?statusState\.status === Model\.STATUS\.error\)/);
  assert.equal(M.resolveStatus(modelAged(120), NOW, INTERVAL, true), 'error');
  assert.equal(M.resolveStatus(modelAged(120), NOW, INTERVAL, false), 'stale');
  assert.equal(M.resolveStatus(modelAged(1), NOW, INTERVAL, false), 'ready');
});
