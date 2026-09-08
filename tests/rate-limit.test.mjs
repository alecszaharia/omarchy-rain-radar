// cavekit-weather-data.md R4 — rate-limit backoff (T-045).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const docs = readRepoFile('docs/data.md');

const INTERVAL = 20 * 60 * 1000;
const withStatus = (body, code) => `${body}${M.FETCH_STATUS_SEPARATOR}${code}`;

test('R4: the HTTP status is carried back alongside the body', () => {
  const body = JSON.stringify(completeResponse());
  const parsed = plain(M.parseFetchOutput(withStatus(body, 200)));
  assert.equal(parsed.httpCode, 200);
  assert.equal(parsed.body, body);
  // And the body still parses into a model, so nothing was corrupted.
  assert.ok(plain(M.parseGridModel(parsed.body, new Date())).model);
});

test('R4: a rate-limit rejection is recognised', () => {
  assert.equal(M.RATE_LIMIT_STATUS, 429);
  assert.equal(M.isRateLimited(plain(M.parseFetchOutput(withStatus('', 429))).httpCode), true);
  for (const code of [200, 404, 500, 503, 0]) {
    assert.equal(M.isRateLimited(code), false, `${code} is not a rate limit`);
  }
});

test('R4: the next attempt is no earlier than twice the configured interval', () => {
  assert.equal(M.RATE_LIMIT_BACKOFF_MULTIPLIER, 2);
  assert.equal(M.rateLimitBackoffMs(INTERVAL), 2 * INTERVAL);
  assert.ok(M.rateLimitBackoffMs(INTERVAL) >= 2 * INTERVAL);
  // It follows the configured interval rather than a fixed delay.
  assert.equal(M.rateLimitBackoffMs(10 * 60 * 1000), 20 * 60 * 1000);
  assert.equal(M.rateLimitBackoffMs(120 * 60 * 1000), 240 * 60 * 1000);
});

test('R4: the backoff is longer than an ordinary retry, by a wide margin', () => {
  // Retrying into the same window would make the limit worse.
  assert.ok(M.rateLimitBackoffMs(INTERVAL) > M.FETCH_RETRY_DELAY_MS * (1 + M.FETCH_RETRY_LIMIT));
});

test('R4: a rate limit abandons the ordinary retry burst', () => {
  const applyRateLimit = service.slice(service.indexOf('function applyRateLimit'),
                                       service.indexOf('property Timer backoffTimer'));
  assert.match(applyRateLimit, /root\.failedAttempts = 0/);
  assert.match(applyRateLimit, /retryTimer\.running = false/);
  assert.match(applyRateLimit, /backoffTimer\.interval = root\.rateLimitBackoffMs/);
  assert.match(applyRateLimit, /backoffTimer\.running = true/);
});

test('R4: the backoff is observable', () => {
  // The wait is a readable property derived from the interval, so a test or a
  // reader can see exactly how long the widget will stay quiet.
  assert.match(service, /readonly property int rateLimitBackoffMs: Model\.rateLimitBackoffMs\(root\.refreshIntervalMs\)/);
  assert.match(service, /if \(Model\.isRateLimited\(response\.httpCode\)\) \{\s*root\.applyRateLimit\(\)/);
});

test('R4: a rate limit reports itself in the status', () => {
  assert.match(M.httpFailureText(429), /rate limit/i);
  assert.match(M.httpFailureText(429), /429/);
  assert.match(service, /statusOnFailure\(statusState\.snapshot\(\),\s*Model\.httpFailureText\(Model\.RATE_LIMIT_STATUS\)/);
});

test('R4: other HTTP failures are ordinary failures, not backoffs', () => {
  for (const code of [500, 503, 404]) {
    assert.equal(M.isRateLimited(code), false);
    assert.ok(M.httpFailureText(code).includes(String(code)));
  }
  assert.match(service, /if \(!Model\.isSuccessStatus\(response\.httpCode\)\) \{\s*root\.applyFailure/);
});

test('R4: a missing status line is unknown rather than a success', () => {
  const parsed = plain(M.parseFetchOutput('just a body'));
  assert.equal(parsed.httpCode, 0);
  assert.equal(M.isSuccessStatus(0), false);
  assert.equal(M.isRateLimited(0), false);
  assert.match(M.httpFailureText(0), /No response/);
});

test('R4: a success cancels a pending backoff', () => {
  assert.match(service, /retryTimer\.running = false\s*\n\s*backoffTimer\.running = false/);
});

test('R4: the backoff is documented', () => {
  assert.match(docs, /Rate-limit backoff/);
});
