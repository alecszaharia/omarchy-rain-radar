// cavekit-map-rendering.md R4 — rain/snow parity and unknown amounts (T-047).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { rainResponse, snowResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const layer = readRepoFile('PrecipitationLayer.qml');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';

test('R4: rain and snow of the same amount produce identical models', () => {
  const rain = plain(M.buildGridModel(rainResponse(3.0), FETCHED_AT));
  const snow = plain(M.buildGridModel(snowResponse(3.0), FETCHED_AT));
  assert.deepEqual(rain, snow);
});

test('R4: rain and snow of the same amount render identically', () => {
  const rain = plain(M.buildGridModel(rainResponse(3.0), FETCHED_AT));
  const snow = plain(M.buildGridModel(snowResponse(3.0), FETCHED_AT));
  for (const [u, v] of [[0.1, 0.1], [0.5, 0.5], [0.9, 0.4], [0.3, 0.8]]) {
    const a = plain(M.precipitationBand(M.samplePrecipitationField(rain.cells, u, v)));
    const b = plain(M.precipitationBand(M.samplePrecipitationField(snow.cells, u, v)));
    assert.deepEqual(a, b, `bands differ at ${u},${v}`);
  }
});

test('R4: the model carries no way to tell rain from snow', () => {
  // Structural parity: the breakdown is never requested and never modelled, so
  // there is nothing for the renderer to diverge on.
  const rain = plain(M.buildGridModel(rainResponse(3.0), FETCHED_AT));
  for (const cell of rain.cells.slice(0, 5)) {
    assert.deepEqual(Object.keys(cell).sort(),
      ['cloudCoverPercent', 'lat', 'lon', 'precipitationMm']);
  }
  assert.ok(!M.requestUrl().includes('snowfall'));
  assert.ok(!M.requestUrl().includes('rain'));
});

test('R4: a cell with no precipitation reading draws no marking', () => {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const unknown = col === 5 && row === 4;
      cells.push({
        cloudCoverPercent: 60,
        precipitationMm: unknown ? M.UNAVAILABLE : 8.0
      });
    }
  }
  const p = plain(M.gridPointFraction(5, 4));
  assert.equal(M.isPrecipitationUnavailableAt(cells, p.u, p.v), true);

  // Just inside that cell, away from its centre, the drenched neighbours do
  // carry weight — so without the guard their amount would bleed in and paint
  // heavy rain over a cell that reported none.
  const inside = { u: p.u + 0.2 / M.GRID_COLUMNS, v: p.v + 0.2 / M.GRID_ROWS };
  const bleed = M.samplePrecipitationField(cells, inside.u, inside.v);
  assert.ok(bleed > 0, 'the fixture must have interpolable neighbours');
  assert.equal(M.isPrecipitationUnavailableAt(cells, inside.u, inside.v), true,
    'that point still belongs to the cell with no reading');

  // The guard is what stops it.
  assert.match(layer, /if \(!Model\.isPrecipitationUnavailableAt\(cells, u, v\)\)/);
  assert.match(layer, /var opacity = 0/);
});

test('R4: that cell still draws its cloud cover normally', () => {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      const unknown = col === 5 && row === 4;
      cells.push({
        cloudCoverPercent: 60,
        precipitationMm: unknown ? M.UNAVAILABLE : 0
      });
    }
  }
  const p = plain(M.gridPointFraction(5, 4));
  // The R3 hatch keys on cloud cover alone, so a missing amount does not
  // trigger it.
  assert.equal(M.isUnavailableAt(cells, p.u, p.v), false);
  assert.ok(Math.abs(M.sampleCloudField(cells, p.u, p.v) - 60) < 1e-9);
});

test('R4: the R3 hatch applies only when the cloud cover itself is unknown', () => {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      cells.push({
        cloudCoverPercent: (col === 5 && row === 4) ? M.UNAVAILABLE : 60,
        precipitationMm: 2.0
      });
    }
  }
  const p = plain(M.gridPointFraction(5, 4));
  assert.equal(M.isUnavailableAt(cells, p.u, p.v), true);
  // And a known amount on that same cell is still precipitation.
  assert.equal(M.isPrecipitationUnavailableAt(cells, p.u, p.v), false);
});

test('R4: the two unknowns are independent', () => {
  const both = [{ cloudCoverPercent: M.UNAVAILABLE, precipitationMm: M.UNAVAILABLE }];
  const cells = [];
  for (let i = 0; i < M.GRID_CELL_COUNT; i++) cells.push({ ...both[0] });
  assert.equal(M.isUnavailableAt(cells, 0.5, 0.5), true);
  assert.equal(M.isPrecipitationUnavailableAt(cells, 0.5, 0.5), true);
});
