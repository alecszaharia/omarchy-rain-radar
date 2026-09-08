// cavekit-weather-data.md R4 — refreshMinutes reading and clamping (T-013).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoJson } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const schema = readRepoJson('manifest.json').barWidget.schema[0];

test('R4: an in-range value is used as-is', () => {
  for (const value of [10, 20, 45, 119, 120]) {
    assert.equal(M.effectiveRefreshMinutes(value), value);
  }
});

test('R4: a value below 10 clamps to 10 and above 120 clamps to 120', () => {
  for (const value of [9, 1, 0, -5, -1000]) {
    assert.equal(M.effectiveRefreshMinutes(value), 10, `${value} must clamp to 10`);
  }
  for (const value of [121, 500, 100000]) {
    assert.equal(M.effectiveRefreshMinutes(value), 120, `${value} must clamp to 120`);
  }
});

test('R4: a missing setting yields the default of 20', () => {
  assert.equal(M.effectiveRefreshMinutes(undefined), 20);
  assert.equal(M.effectiveRefreshMinutes(null), 20);
});

test('R4: a non-numeric setting yields the default of 20', () => {
  for (const value of ['', '   ', 'abc', '15min', 'NaN', true, false, {}, [], [30], () => 30, NaN, Infinity, -Infinity]) {
    assert.equal(M.effectiveRefreshMinutes(value), 20, `${JSON.stringify(String(value))} must fall back to 20`);
  }
});

test('R4: a numeric string is accepted and clamped like a number', () => {
  assert.equal(M.effectiveRefreshMinutes('30'), 30);
  assert.equal(M.effectiveRefreshMinutes(' 45 '), 45);
  assert.equal(M.effectiveRefreshMinutes('5'), 10);
  assert.equal(M.effectiveRefreshMinutes('999'), 120);
});

test('R4: a fractional value becomes a whole number of minutes', () => {
  assert.equal(M.effectiveRefreshMinutes(20.4), 20);
  assert.equal(M.effectiveRefreshMinutes(20.6), 21);
  assert.equal(M.effectiveRefreshMinutes(9.6), 10);
});

test('R4: the bounds and default match the declared manifest schema', () => {
  assert.equal(M.REFRESH_MINUTES_MIN, schema.min);
  assert.equal(M.REFRESH_MINUTES_MAX, schema.max);
  assert.equal(M.REFRESH_MINUTES_DEFAULT, schema.defaultValue);
});

test('R4: the interval is exposed in milliseconds for the scheduler', () => {
  assert.equal(M.refreshIntervalMs(20), 20 * 60 * 1000);
  assert.equal(M.refreshIntervalMs(undefined), 20 * 60 * 1000);
  assert.equal(M.refreshIntervalMs(5), 10 * 60 * 1000);
});
