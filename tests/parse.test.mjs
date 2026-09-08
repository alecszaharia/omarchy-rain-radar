// cavekit-weather-data.md R3 — unparseable responses (T-020).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';

const GARBAGE = [
  '',
  '   ',
  'not json at all',
  '{',
  '<html><body>502 Bad Gateway</body></html>',
  '[{"latitude":1',
  'null',
  'true',
  '42',
  '"a string"',
  '{}',
  '[]',
  '[{"latitude":47,"longitude":28}]'
];

test('R3: a garbage response produces no model', () => {
  for (const raw of GARBAGE) {
    const result = plain(M.parseGridModel(raw, FETCHED_AT));
    assert.equal(result.model, null, `${JSON.stringify(raw)} must not yield a model`);
  }
});

test('R3: a failed parse always carries an error text', () => {
  for (const raw of GARBAGE) {
    const result = plain(M.parseGridModel(raw, FETCHED_AT));
    assert.ok(typeof result.errorText === 'string' && result.errorText.length > 0,
      `${JSON.stringify(raw)} must explain itself`);
  }
});

test("R3: a failed parse leaves the previously published model unchanged", () => {
  const good = plain(M.buildGridModel(completeResponse(), FETCHED_AT));
  for (const raw of GARBAGE) {
    const result = M.parseGridModel(raw, '2026-09-08T07:00:00.000Z');
    const published = plain(M.nextPublishedModel(good, result));
    assert.deepEqual(published, good, `${JSON.stringify(raw)} must not disturb the published model`);
  }
});

test('R3: a failed parse results in the error status', () => {
  for (const raw of GARBAGE) {
    assert.equal(M.statusForParse(M.parseGridModel(raw, FETCHED_AT)), 'error');
  }
});

test("R3: Open-Meteo's own error body is a failure, not a model", () => {
  const raw = JSON.stringify({ error: true, reason: 'Parameter latitude is out of range' });
  const result = plain(M.parseGridModel(raw, FETCHED_AT));
  assert.equal(result.model, null);
  assert.match(result.errorText, /out of range/);
});

test('R3: a good response parses into a model and the ready status', () => {
  const result = M.parseGridModel(JSON.stringify(completeResponse()), FETCHED_AT);
  const model = plain(result).model;
  assert.ok(model, 'a complete response must parse');
  assert.equal(model.cells.length, 108);
  assert.equal(plain(result).errorText, '');
  assert.equal(M.statusForParse(result), 'ready');
  // A good parse replaces whatever was published before.
  assert.deepEqual(plain(M.nextPublishedModel(null, result)), model);
});

test('R3: with nothing published yet, a failure publishes nothing', () => {
  const result = M.parseGridModel('garbage', FETCHED_AT);
  assert.equal(M.nextPublishedModel(null, result), null);
});
