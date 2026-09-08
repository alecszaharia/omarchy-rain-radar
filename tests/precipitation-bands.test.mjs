// cavekit-map-rendering.md R4 — precipitation band thresholds (T-025).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const bands = plain(M.PRECIPITATION_BANDS);
const docs = readRepoFile('docs/rendering.md');

test('R4: exactly four bands exist, named none, light, moderate and heavy', () => {
  assert.equal(bands.length, 4);
  assert.deepEqual(bands.map((b) => b.id), ['none', 'light', 'moderate', 'heavy']);
});

test('R4: the thresholds are documented in the project documentation', () => {
  assert.match(docs, /## Precipitation bands/);
  for (const fragment of ['0 <= mm < 0.1', '0.1 <= mm < 2.5', '2.5 <= mm < 7.6', 'mm >= 7.6']) {
    assert.ok(docs.includes(fragment), `missing documented threshold: ${fragment}`);
  }
});

test('R4: the documented thresholds match the code', () => {
  assert.equal(bands[0].minMm, 0);
  assert.equal(bands[0].maxMm, 0.1);
  assert.equal(bands[1].maxMm, 2.5);
  assert.equal(bands[2].maxMm, 7.6);
  assert.equal(bands[3].minMm, 7.6);
});

test('R4: the bands abut exactly, leaving no gap and no overlap', () => {
  assert.equal(bands[0].minMm, 0, 'the first band must start at zero');
  for (let i = 1; i < bands.length; i++) {
    assert.equal(bands[i].minMm, bands[i - 1].maxMm,
      `band ${bands[i].id} must start where ${bands[i - 1].id} ends`);
  }
  assert.equal(bands[bands.length - 1].maxMm, Infinity, 'the last band must be unbounded');
});

test('R4: every value from 0 upwards maps to exactly one band', () => {
  const values = [0, 0.0001, 0.099, 0.1, 0.5, 2.49, 2.5, 5, 7.59, 7.6, 20, 1000, 1e9];
  for (const mm of values) {
    const matching = bands.filter((b) => mm >= b.minMm && mm < b.maxMm);
    assert.equal(matching.length, 1, `${mm} mm matched ${matching.length} bands`);
    assert.equal(plain(M.precipitationBand(mm)).id, matching[0].id, `${mm} mm resolved wrongly`);
  }
});

test('R4: the boundaries belong to the upper band', () => {
  assert.equal(plain(M.precipitationBand(0.1)).id, 'light');
  assert.equal(plain(M.precipitationBand(2.5)).id, 'moderate');
  assert.equal(plain(M.precipitationBand(7.6)).id, 'heavy');
  assert.equal(plain(M.precipitationBand(0.09999)).id, 'none');
});

test('R4: the mapping is deterministic', () => {
  for (const mm of [0, 0.4, 3, 9]) {
    assert.equal(plain(M.precipitationBand(mm)).id, plain(M.precipitationBand(mm)).id);
  }
});

test('R4: an unusable reading falls in the none band', () => {
  for (const value of [M.UNAVAILABLE, null, undefined, NaN, Infinity, -1, '2.0', {}]) {
    assert.equal(plain(M.precipitationBand(value)).id, 'none',
      `${JSON.stringify(String(value))} must not invent an intensity`);
  }
});

test('R4: the none band draws nothing and intensity rises with the band', () => {
  assert.equal(bands[0].opacity, 0);
  for (let i = 1; i < bands.length; i++) {
    assert.ok(bands[i].opacity > bands[i - 1].opacity,
      `${bands[i].id} must be stronger than ${bands[i - 1].id}`);
  }
});
