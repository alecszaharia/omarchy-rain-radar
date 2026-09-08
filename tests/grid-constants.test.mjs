// cavekit-weather-data.md R1 — published grid constants (T-002).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');

test('R1: bounds, column count and row count are readable without a fetch', () => {
  assert.deepEqual(plain(M.GRID_BOUNDS), { minLon: 19.86, maxLon: 37.86, minLat: 41.0, maxLat: 53.0 });
  assert.equal(M.GRID_COLUMNS, 12);
  assert.equal(M.GRID_ROWS, 9);
});

test('R1: point spacing is readable and derived from the bounds', () => {
  assert.equal(M.GRID_LON_STEP, 1.5);
  assert.ok(Math.abs(M.GRID_LAT_STEP - 12.0 / 9.0) < 1e-12);
});

test('R1: the center coordinate is Chisinau', () => {
  assert.deepEqual(plain(M.GRID_CENTER), { lat: 47.01, lon: 28.86 });
});

test('R1: reading the constants cannot trigger a fetch', () => {
  // Model.js is loaded into a context with no I/O capability whatsoever — no
  // XMLHttpRequest, no Process, no fetch, no Qt. If reading the constants
  // needed any of them, loading or reading would throw here.
  const isolated = loadQmlJs('Model.js');
  assert.equal(isolated.XMLHttpRequest, undefined);
  assert.equal(isolated.Process, undefined);
  assert.equal(isolated.fetch, undefined);
  assert.equal(isolated.Qt, undefined);
  assert.equal(plain(isolated.GRID_BOUNDS).minLon, 19.86);
  assert.equal(isolated.GRID_COLUMNS, 12);

  // Model.js may describe a request but must never perform one: the fetch
  // command is data the caller runs, not something this file executes.
  const source = readRepoFile('Model.js');
  for (const forbidden of ['XMLHttpRequest', 'Qt.', '.exec(', 'spawn(', 'running = true']) {
    assert.ok(!source.includes(forbidden), `Model.js must not reference ${forbidden}`);
  }
  assert.ok(Array.isArray(plain(isolated.fetchCommand())),
    'fetchCommand must return argv rather than run anything');
});
