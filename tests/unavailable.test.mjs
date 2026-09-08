// cavekit-weather-data.md R3 — unavailable-value normalization (T-019).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';
const UNAVAILABLE = 'unavailable';

function modelWith(mutate) {
  const response = completeResponse();
  mutate(response);
  return plain(M.buildGridModel(response, FETCHED_AT));
}

function assertOthersNumeric(model, exceptIndex) {
  for (let i = 0; i < model.cells.length; i++) {
    if (i === exceptIndex) continue;
    assert.equal(typeof model.cells[i].cloudCoverPercent, 'number', `cell ${i} cloud went unavailable`);
    assert.equal(typeof model.cells[i].precipitationMm, 'number', `cell ${i} precipitation went unavailable`);
  }
}

test('R3: a dropped location leaves that cell unavailable and the rest numeric', () => {
  const model = modelWith((r) => { r[40].current = null; });
  assert.equal(model.cells[40].cloudCoverPercent, UNAVAILABLE);
  assert.equal(model.cells[40].precipitationMm, UNAVAILABLE);
  assertOthersNumeric(model, 40);
  // The gap must not shift the cells after it onto their neighbour's reading.
  const intact = plain(M.buildGridModel(completeResponse(), FETCHED_AT));
  assert.equal(model.cells[41].cloudCoverPercent, intact.cells[41].cloudCoverPercent);
});

test('R3: a null cloud cover becomes unavailable, not 0', () => {
  const model = modelWith((r) => { r[7].current.cloud_cover = null; });
  assert.equal(model.cells[7].cloudCoverPercent, UNAVAILABLE);
  assert.notEqual(model.cells[7].cloudCoverPercent, 0);
  // Its precipitation is unaffected: the two measurements fail independently.
  assert.equal(typeof model.cells[7].precipitationMm, 'number');
});

test('R3: a null precipitation becomes unavailable, not 0', () => {
  const model = modelWith((r) => { r[9].current.precipitation = null; });
  assert.equal(model.cells[9].precipitationMm, UNAVAILABLE);
  assert.notEqual(model.cells[9].precipitationMm, 0);
  assert.equal(typeof model.cells[9].cloudCoverPercent, 'number');
});

test('R3: an out-of-range cloud cover becomes unavailable', () => {
  for (const [index, value] of [[3, -1], [4, 101], [5, -0.5], [6, 1000]]) {
    const model = modelWith((r) => { r[index].current.cloud_cover = value; });
    assert.equal(model.cells[index].cloudCoverPercent, UNAVAILABLE, `${value} must be unavailable`);
  }
});

test('R3: the ends of the valid cloud range are kept', () => {
  const model = modelWith((r) => {
    r[1].current.cloud_cover = 0;
    r[2].current.cloud_cover = 100;
  });
  assert.equal(model.cells[1].cloudCoverPercent, 0);
  assert.equal(model.cells[2].cloudCoverPercent, 100);
});

test('R3: a non-numeric measurement is unavailable rather than coerced', () => {
  for (const value of ['50', true, {}, [], NaN, Infinity, undefined]) {
    const model = modelWith((r) => { r[11].current.cloud_cover = value; });
    assert.equal(model.cells[11].cloudCoverPercent, UNAVAILABLE,
      `${JSON.stringify(String(value))} must not be coerced into a reading`);
  }
});

test('R3: a negative precipitation is unavailable, and zero is a real reading', () => {
  assert.equal(modelWith((r) => { r[12].current.precipitation = -0.2; }).cells[12].precipitationMm, UNAVAILABLE);
  assert.equal(modelWith((r) => { r[12].current.precipitation = 0; }).cells[12].precipitationMm, 0);
});

test('R3: the center sample follows the same rules', () => {
  const model = modelWith((r) => { r[M.GRID_CENTER_INDEX].current.cloud_cover = null; });
  assert.equal(model.center.cloudCoverPercent, UNAVAILABLE);
  assert.equal(typeof model.center.precipitationMm, 'number');
});
