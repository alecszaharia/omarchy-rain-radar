// cavekit-weather-data.md R4 — bounded retries (T-038).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const docs = readRepoFile('docs/data.md');

test('R4: the retry count is a fixed documented constant', () => {
  assert.equal(M.FETCH_RETRY_LIMIT, 2);
  assert.equal(M.FETCH_RETRY_DELAY_MS, 30000);
  assert.match(docs, /`Model\.FETCH_RETRY_LIMIT` \| 2 retries after the initial attempt/);
  assert.match(docs, /at most \*\*three\*\* attempts/);
});

test('R4: the retry count is not a user setting', () => {
  // The manifest declares exactly one setting, and it is not this.
  assert.ok(!/setting\(\s*"[^"]*retr/i.test(service));
  assert.ok(!/FETCH_RETRY_LIMIT\s*=\s*.*setting/i.test(readRepoFile('Model.js')));
});

test('R4: a failing cycle retries exactly the allowed number of times', () => {
  let attempts = 0;
  let failed = 0;
  // The first attempt, then retries for as long as the policy allows.
  attempts += 1;
  failed += 1;
  while (plain(M.retryDecision(failed)).retry) {
    attempts += 1;
    failed += 1;
  }
  assert.equal(attempts, 1 + M.FETCH_RETRY_LIMIT, 'one initial attempt plus the retry allowance');
  assert.equal(attempts, 3);
});

test('R4: after the last retry no further attempt is made', () => {
  assert.equal(plain(M.retryDecision(1 + M.FETCH_RETRY_LIMIT)).retry, false);
  assert.equal(plain(M.retryDecision(99)).retry, false);
  assert.equal(plain(M.retryDecision(1 + M.FETCH_RETRY_LIMIT)).delayMs, 0);
});

test('R4: each retry waits the documented delay', () => {
  for (let failed = 1; failed <= M.FETCH_RETRY_LIMIT; failed++) {
    const decision = plain(M.retryDecision(failed));
    assert.equal(decision.retry, true, `retry ${failed} must be allowed`);
    assert.equal(decision.delayMs, M.FETCH_RETRY_DELAY_MS);
  }
});

test('R4: the whole retry burst fits inside the shortest refresh interval', () => {
  // Otherwise a cycle's retries would still be running when the next is due.
  const burst = M.FETCH_RETRY_LIMIT * M.FETCH_RETRY_DELAY_MS
    + (1 + M.FETCH_RETRY_LIMIT) * M.FETCH_TIMEOUT_SECONDS * 1000;
  assert.ok(burst < M.REFRESH_MINUTES_MIN * 60 * 1000,
    `a failing cycle may take ${burst}ms, which must stay inside the 10-minute minimum`);
});

test('R4: a nonsense counter is treated as no failures yet', () => {
  for (const value of [undefined, null, NaN, 'two', {}]) {
    assert.equal(plain(M.retryDecision(value)).retry, true);
  }
});

test('R4: the service counts failures and stops at the limit', () => {
  assert.match(service, /root\.failedAttempts \+= 1/);
  assert.match(service, /var decision = Model\.retryDecision\(root\.failedAttempts\)/);
  assert.match(service, /if \(decision\.retry\) \{[\s\S]*?retryTimer\.running = true/);
  assert.match(service, /\} else \{[\s\S]*?root\.failedAttempts = 0/);
});

test('R4: a success ends the cycle and cancels any pending retry', () => {
  assert.match(service, /root\.failedAttempts = 0\s*\n\s*retryTimer\.running = false/);
});
