// cavekit-weather-data.md R3 — grid model normalization, happy path (T-011).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain } from './qml-js.mjs';
import { completeResponse, DATA_TIME } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';
const model = plain(M.buildGridModel(completeResponse(), FETCHED_AT));

test('R3: a complete fixture produces 108 cells plus the center sample', () => {
  assert.equal(model.cells.length, 108);
  assert.ok(model.center, 'the model must carry a center sample');
  assert.equal(typeof model.center.cloudCoverPercent, 'number');
});

test('R3: the model republishes the grid shape and bounds constants', () => {
  assert.equal(model.columns, 12);
  assert.equal(model.rows, 9);
  assert.deepEqual(model.bounds, plain(M.GRID_BOUNDS));
});

test('R3: cell coordinates match the R1 grid points, in order', () => {
  const points = plain(M.gridPoints()).slice(0, 108);
  for (let i = 0; i < points.length; i++) {
    assert.equal(model.cells[i].lat, points[i].lat, `cell ${i} latitude`);
    assert.equal(model.cells[i].lon, points[i].lon, `cell ${i} longitude`);
  }
});

test('R3: measurements are taken positionally from the response', () => {
  const response = completeResponse();
  for (let i = 0; i < 108; i++) {
    assert.equal(model.cells[i].cloudCoverPercent, response[i].current.cloud_cover, `cell ${i} cloud`);
    assert.equal(model.cells[i].precipitationMm, response[i].current.precipitation, `cell ${i} precipitation`);
  }
  const center = response[M.GRID_CENTER_INDEX].current;
  assert.equal(model.center.cloudCoverPercent, center.cloud_cover);
  assert.equal(model.center.precipitationMm, center.precipitation);
});

test('R3: dataTime comes from the source and fetchedAt from the caller', () => {
  assert.equal(model.dataTime, DATA_TIME);
  assert.equal(model.fetchedAt, FETCHED_AT);
});

test('R3: a response with too few locations produces no model', () => {
  assert.equal(M.buildGridModel(completeResponse().slice(0, 50), FETCHED_AT), null);
  assert.equal(M.buildGridModel([], FETCHED_AT), null);
  assert.equal(M.buildGridModel(null, FETCHED_AT), null);
});

test('R3: the center sample is separate from the 108 cells', () => {
  // The centre is an extra point, so it must not be appended to cells[] or the
  // grid would render 109 tiles.
  assert.equal(model.cells.length, M.GRID_CELL_COUNT);
  assert.equal(model.cells.length, 108);
});

test('R3: cell coordinates ignore the coordinates echoed by the source', () => {
  // Open-Meteo answers with its own model-grid coordinates, which are snapped
  // away from the requested ones. Trusting them would move every cell.
  const response = completeResponse();
  for (const entry of response) {
    entry.latitude = 0;
    entry.longitude = 0;
  }
  const snapped = plain(M.buildGridModel(response, FETCHED_AT));
  const points = plain(M.gridPoints()).slice(0, 108);
  for (let i = 0; i < points.length; i++) {
    assert.equal(snapped.cells[i].lat, points[i].lat, `cell ${i} must keep its grid latitude`);
    assert.equal(snapped.cells[i].lon, points[i].lon, `cell ${i} must keep its grid longitude`);
  }
});
