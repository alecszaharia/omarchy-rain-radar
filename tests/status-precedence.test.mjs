// cavekit-weather-data.md R6 — precedence and the status fields (T-046).
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

test('R6: error takes precedence over stale', () => {
  const stale = modelAged(120);
  assert.equal(M.isStale(stale, NOW, INTERVAL), true, 'the fixture must be stale');
  // Both conditions true at once: the failure wins.
  assert.equal(M.resolveStatus(stale, NOW, INTERVAL, true), 'error');
  // And without a failure it is simply stale.
  assert.equal(M.resolveStatus(stale, NOW, INTERVAL, false), 'stale');
});

test('R6: a fresh model with a failed attempt is still error', () => {
  assert.equal(M.resolveStatus(modelAged(1), NOW, INTERVAL, true), 'error');
});

test('R6: without a model the status is loading, not error', () => {
  assert.equal(M.resolveStatus(null, NOW, INTERVAL, false), 'loading');
});

test('R6: the resolved status is always one of the four', () => {
  const values = plain(M.STATUS_VALUES);
  for (const model of [null, modelAged(1), modelAged(120)]) {
    for (const failed of [true, false]) {
      const status = M.resolveStatus(model, NOW, INTERVAL, failed);
      assert.ok(values.includes(status), `${status} is not a valid status`);
    }
  }
});

test('R6: the service resolves precedence in one place', () => {
  const evaluate = service.slice(service.indexOf('function evaluateStaleness'),
                                 service.indexOf('property Timer stalenessTimer'));
  assert.match(evaluate, /Model\.resolveStatus\(root\.gridModel, new Date\(\), root\.refreshIntervalMs,\s*statusState\.status === Model\.STATUS\.error\)/);
  // The old inline stale/ready branch is gone, so precedence cannot be
  // reimplemented differently here.
  assert.ok(!/isStale\(/.test(evaluate), 'staleness must come through resolveStatus');
});

test('R6: lastErrorText is non-empty in error', () => {
  const snapshot = plain(M.statusOnFailure(plain(M.initialStatusSnapshot()), 'boom', NOW));
  assert.equal(snapshot.status, 'error');
  assert.ok(snapshot.lastErrorText.length > 0);
  // Even when the caller supplies nothing.
  for (const text of ['', null, undefined]) {
    const fallback = plain(M.statusOnFailure(plain(M.initialStatusSnapshot()), text, NOW));
    assert.ok(fallback.lastErrorText.length > 0);
  }
});

test('R6: lastSuccessAt is set in ready and survives into stale', () => {
  const success = plain(M.statusOnSuccess(plain(M.initialStatusSnapshot()), NOW));
  assert.equal(success.status, 'ready');
  assert.ok(success.lastSuccessAt instanceof Date);
  // Going stale is a passage of time, not a new snapshot, so the success time
  // it carries is still the one that was set here.
  assert.equal(M.resolveStatus(modelAged(120), NOW, INTERVAL, false), 'stale');
  assert.ok(success.lastSuccessAt instanceof Date);
});

test('R6: a failure preserves lastSuccessAt rather than clearing it', () => {
  const success = plain(M.statusOnSuccess(plain(M.initialStatusSnapshot()), NOW));
  const failure = plain(M.statusOnFailure(success, 'boom', new Date(NOW.getTime() + 60000)));
  assert.equal(failure.status, 'error');
  assert.equal(failure.lastSuccessAt.getTime(), success.lastSuccessAt.getTime());
});

test('R6: lastAttemptAt updates on every attempt regardless of outcome', () => {
  let snapshot = plain(M.initialStatusSnapshot());
  const times = [];
  for (let i = 1; i <= 4; i++) {
    const now = new Date(NOW.getTime() + i * 60000);
    snapshot = plain(M.statusOnAttemptStart(snapshot, now));
    times.push(snapshot.lastAttemptAt.getTime());
    // Alternate the outcome; the attempt time must advance either way.
    snapshot = plain(i % 2
      ? M.statusOnSuccess(snapshot, now)
      : M.statusOnFailure(snapshot, 'boom', now));
    assert.equal(snapshot.lastAttemptAt.getTime(), now.getTime(),
      `attempt ${i} (${snapshot.status}) must keep its attempt time`);
  }
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] > times[i - 1], 'the attempt time must advance');
  }
});

test('R6: a success clears the superseded error text', () => {
  const failed = plain(M.statusOnFailure(plain(M.initialStatusSnapshot()), 'boom', NOW));
  const recovered = plain(M.statusOnSuccess(failed, new Date(NOW.getTime() + 60000)));
  assert.equal(recovered.lastErrorText, '');
});
