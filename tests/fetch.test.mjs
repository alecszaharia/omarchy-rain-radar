// cavekit-weather-data.md R2 — the fetch executor (T-021).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const command = plain(M.fetchCommand());

test('R2: a refresh runs exactly one outbound command', () => {
  assert.equal(command[0], 'curl');
  const urls = command.filter((arg) => /^https?:/.test(arg));
  assert.equal(urls.length, 1, 'exactly one URL may be requested');
  assert.equal(urls[0], M.requestUrl());
  // Nothing in the command may chain a second call.
  for (const arg of command) {
    assert.ok(!/[;&|]/.test(arg) || /^https?:/.test(arg), `suspicious argument: ${arg}`);
  }
});

test('R2: the request is bounded by a fixed timeout constant', () => {
  const index = command.indexOf('--max-time');
  assert.ok(index > 0, 'the command must carry --max-time');
  assert.equal(command[index + 1], String(M.FETCH_TIMEOUT_SECONDS));
  assert.equal(typeof M.FETCH_TIMEOUT_SECONDS, 'number');
  assert.ok(M.FETCH_TIMEOUT_SECONDS > 0);
});

test('R2: the timeout is a constant, not a user setting', () => {
  // The only declared setting is refreshMinutes; the timeout must not be
  // reachable from settings at all.
  assert.ok(!/FETCH_TIMEOUT_SECONDS\s*=\s*.*setting/i.test(readRepoFile('Model.js')));
  assert.ok(!/setting\(\s*"[^"]*timeout/i.test(service));
});

test('R2: the timeout stays well inside the shortest refresh interval', () => {
  // Otherwise a slow request could still be running when the next one is due.
  assert.ok(M.FETCH_TIMEOUT_SECONDS < M.REFRESH_MINUTES_MIN * 60,
    'a request may not outlive its own refresh interval');
});

test('R2: a timeout produces the error status rather than a hang', () => {
  // curl exit 28 is its operation timeout.
  assert.match(M.fetchFailureText(28), /timed out/i);
  assert.ok(M.fetchFailureText(28).includes(String(M.FETCH_TIMEOUT_SECONDS)));
  assert.ok(M.fetchFailureText(7).length > 0, 'every failure must explain itself');
  // The process exit path is what turns that into the status.
  assert.match(service, /onExited: function\(exitCode, exitStatus\) \{\s*if \(exitCode !== 0\) root\.applyFailure/);
  assert.match(service, /function applyFailure\(text\)[\s\S]*Model\.statusOnFailure\(/);
});

test('R2: two callers cannot put two requests on the wire', () => {
  assert.match(service, /function refresh\(\) \{\s*if \(fetchProcess\.running\) return false/);
});

test('R2: a refresh starts from the loading status', () => {
  // The reducer owns the transition; starting an attempt yields loading and
  // advances the attempt time together.
  assert.match(service, /Model\.statusOnAttemptStart\(statusState\.snapshot\(\), new Date\(\)\)/);
  assert.equal(M.statusOnAttemptStart(M.initialStatusSnapshot(), new Date()).status, 'loading');
});

test('R2: a successful response publishes and a failed one preserves', () => {
  assert.match(service, /root\.gridModel = Model\.nextPublishedModel\(root\.gridModel, parsed\)/);
  assert.match(service, /Model\.statusOnSuccess\(statusState\.snapshot\(\), completedAt\)/);
  assert.equal(M.statusOnSuccess(M.initialStatusSnapshot(), new Date()).status, 'ready');
});
