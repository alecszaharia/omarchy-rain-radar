// cavekit-weather-data.md R6 — fetch-lifecycle transitions (T-030).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const store = readRepoFile('WeatherStatus.qml');

const GOOD = JSON.stringify(completeResponse());
const GARBAGE = 'not a response';

// Drives the same reducer the service drives, so the sequence observed here is
// the sequence the widget goes through.
function run(events) {
  let snapshot = plain(M.initialStatusSnapshot());
  const seen = [snapshot.status];
  let clock = Date.UTC(2026, 8, 8, 6, 0, 0);
  for (const event of events) {
    clock += 1000;
    const now = new Date(clock);
    snapshot = plain(M.statusOnAttemptStart(snapshot, now));
    seen.push(snapshot.status);
    const parsed = M.parseGridModel(event, now);
    snapshot = plain(parsed.model
      ? M.statusOnSuccess(snapshot, now)
      : M.statusOnFailure(snapshot, plain(parsed).errorText, now));
    seen.push(snapshot.status);
  }
  return { snapshot, seen };
}

test('R6: a starting fetch transitions to loading', () => {
  const { seen } = run([GOOD]);
  assert.equal(seen[1], 'loading');
  assert.match(service, /statusState\.apply\(Model\.statusOnAttemptStart\(statusState\.snapshot\(\), new Date\(\)\)\)/);
});

test('R6: loading transitions to ready on a successful fetch', () => {
  const { seen, snapshot } = run([GOOD]);
  assert.deepEqual(seen, ['loading', 'loading', 'ready']);
  assert.equal(snapshot.status, 'ready');
});

test('R6: a failed or unparseable fetch transitions to error', () => {
  const { seen, snapshot } = run([GARBAGE]);
  assert.equal(seen[seen.length - 1], 'error');
  assert.ok(snapshot.lastErrorText.length > 0);
});

test('R6: error transitions back to ready after a subsequent success', () => {
  const { seen, snapshot } = run([GARBAGE, GOOD]);
  assert.deepEqual(seen, ['loading', 'loading', 'error', 'loading', 'ready']);
  assert.equal(snapshot.status, 'ready');
  // The superseded error text is cleared on recovery.
  assert.equal(snapshot.lastErrorText, '');
});

test('R6: a failure preserves the last known success time', () => {
  const { snapshot } = run([GOOD, GARBAGE]);
  assert.equal(snapshot.status, 'error');
  assert.ok(snapshot.lastSuccessAt instanceof Date, 'the popup must still be able to date the model');
});

test('R6: the attempt time advances on every attempt, whatever the outcome', () => {
  let snapshot = plain(M.initialStatusSnapshot());
  assert.equal(snapshot.lastAttemptAt, null);
  const first = new Date(Date.UTC(2026, 8, 8, 6, 0, 0));
  snapshot = plain(M.statusOnAttemptStart(snapshot, first));
  assert.equal(snapshot.lastAttemptAt.getTime(), first.getTime());
  snapshot = plain(M.statusOnFailure(snapshot, 'boom', first));
  assert.equal(snapshot.lastAttemptAt.getTime(), first.getTime());
  const second = new Date(Date.UTC(2026, 8, 8, 6, 20, 0));
  snapshot = plain(M.statusOnAttemptStart(snapshot, second));
  assert.equal(snapshot.lastAttemptAt.getTime(), second.getTime());
});

test('R6: a failure always carries an error text', () => {
  for (const text of ['', null, undefined]) {
    const snapshot = plain(M.statusOnFailure(plain(M.initialStatusSnapshot()), text, new Date()));
    assert.ok(snapshot.lastErrorText.length > 0, 'error must never be silent');
  }
});

test('R6: every fetch-driven transition goes through the reducer', () => {
  // Direct field writes would let the snapshot and the status drift apart.
  // Scoped to the fetch paths: the time-driven stale/ready flip changes no
  // timestamps and no error text, so it sets the status on its own.
  const body = service.slice(service.indexOf('function refresh'),
                             service.indexOf('// ---- Staleness'));
  assert.ok(!/statusState\.lastErrorText\s*=/.test(body), 'error text must come from the reducer');
  assert.ok(!/statusState\.lastSuccessAt\s*=/.test(body), 'success time must come from the reducer');
  assert.ok(!/statusState\.set\(/.test(body), 'the status must come from the reducer');
  for (const call of ['statusOnAttemptStart', 'statusOnSuccess', 'statusOnFailure']) {
    assert.ok(body.includes(call), `${call} must drive its transition`);
  }
});

test('R6: applying a snapshot notifies consumers last, with fields already set', () => {
  const apply = store.slice(store.indexOf('function apply(next)'));
  const statusAt = apply.indexOf('root.set(next.status)');
  for (const field of ['lastSuccessAt', 'lastAttemptAt', 'lastErrorText']) {
    assert.ok(apply.indexOf(`root.${field} =`) < statusAt,
      `${field} must be set before statusChanged fires`);
  }
});
