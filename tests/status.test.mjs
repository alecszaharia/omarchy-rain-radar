// cavekit-weather-data.md R6 — status enum and observable store (T-003).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const storeSource = readRepoFile('WeatherStatus.qml');

test('R6: the status vocabulary is exactly loading, ready, stale, error', () => {
  assert.deepEqual(plain(M.STATUS), {
    loading: 'loading', ready: 'ready', stale: 'stale', error: 'error'
  });
  assert.deepEqual(plain(M.STATUS_VALUES), ['loading', 'ready', 'stale', 'error']);
});

test('R6: isStatus accepts every enum value', () => {
  for (const value of ['loading', 'ready', 'stale', 'error']) {
    assert.equal(M.isStatus(value), true, `${value} must be a valid status`);
  }
});

test('R6: isStatus rejects anything outside the enum', () => {
  for (const value of [null, undefined, '', 'READY', 'Ready', 'unknown', 0, 'loading ']) {
    assert.equal(M.isStatus(value), false, `${JSON.stringify(value)} must not be a valid status`);
  }
});

test('R6: the store holds exactly one status, defaulting to loading', () => {
  // A single scalar property cannot hold two values at once; what has to be
  // true is that its declared type is the scalar and its initial value is in
  // the enum, so there is never an instant with no current status.
  assert.match(storeSource, /property string status: Model\.STATUS\.loading/);
  assert.equal(M.isStatus('loading'), true);
});

test('R6: writes are routed through the enum validator', () => {
  assert.match(storeSource, /function set\(next\)/);
  assert.match(storeSource, /if \(!Model\.isStatus\(next\)\)/);
  // The guard must return before assigning, or an invalid value would land.
  const guard = storeSource.slice(storeSource.indexOf('function set(next)'));
  assert.ok(guard.indexOf('return false') < guard.indexOf('root.status = next'),
    'the invalid-value guard must return before the assignment');
});

test('R6: status changes notify consumers', () => {
  // `status` is a QML property, so QML emits statusChanged on every write —
  // that signal is the change notification. Its companions travel the same way.
  for (const prop of ['status', 'lastSuccessAt', 'lastAttemptAt', 'lastErrorText']) {
    assert.match(storeSource, new RegExp(`property \\w+ ${prop}`),
      `${prop} must be a QML property so consumers are notified on change`);
  }
});
