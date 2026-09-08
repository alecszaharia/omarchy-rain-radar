// cavekit-weather-data.md R2 — the Open-Meteo request (T-012).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const url = M.requestUrl();
const query = new URLSearchParams(url.slice(url.indexOf('?') + 1));

test('R2: the request carries all 109 sampling points', () => {
  const lats = query.get('latitude').split(',');
  const lons = query.get('longitude').split(',');
  assert.equal(lats.length, 109);
  assert.equal(lons.length, 109);
});

test('R2: the coordinate lists follow the grid point order exactly', () => {
  const points = plain(M.gridPoints());
  const lats = query.get('latitude').split(',').map(Number);
  const lons = query.get('longitude').split(',').map(Number);
  for (let i = 0; i < points.length; i++) {
    assert.ok(Math.abs(lats[i] - points[i].lat) < 1e-4, `latitude ${i} out of order`);
    assert.ok(Math.abs(lons[i] - points[i].lon) < 1e-4, `longitude ${i} out of order`);
  }
  // The response is mapped back positionally, so the centre must stay last.
  assert.equal(lats[M.GRID_CENTER_INDEX], 47.01);
  assert.equal(lons[M.GRID_CENTER_INDEX], 28.86);
});

test('R2: only current total cloud cover and precipitation are requested', () => {
  assert.equal(query.get('current'), 'cloud_cover,precipitation');
  for (const banned of ['hourly', 'daily', 'minutely_15', 'forecast_days', 'past_days']) {
    assert.equal(query.get(banned), null, `${banned} must not be requested`);
  }
  assert.ok(!url.includes('cloud_cover_low'));
  assert.ok(!url.includes('cloud_cover_mid'));
  assert.ok(!url.includes('cloud_cover_high'));
});

test('R2: the request carries no API key or other credential', () => {
  for (const key of ['apikey', 'api_key', 'key', 'token', 'access_token', 'appid']) {
    assert.equal(query.get(key), null, `${key} must not appear in the request`);
  }
  assert.ok(!/[?&](apikey|api_key|key|token)=/i.test(url));
  assert.ok(url.startsWith('https://api.open-meteo.com/v1/forecast?'), 'must use the keyless public endpoint over TLS');
});

test('R2: the request is deterministic', () => {
  assert.equal(M.requestUrl(), url);
});
