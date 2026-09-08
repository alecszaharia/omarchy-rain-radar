// cavekit-weather-data.md R1 — grid constants module (T-002).
// Point generation itself is T-006; this covers only the published constants
// and the "readable without triggering a fetch" criterion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile, plain } from './qml-js.mjs';

const grid = loadQmlJs('Grid.js');

test('R1: bounds are the published extent', () => {
  assert.deepEqual(plain(grid.BOUNDS), {
    minLon: 19.86,
    maxLon: 37.86,
    minLat: 41.0,
    maxLat: 53.0
  });
});

test('R1: the grid is 12 columns by 9 rows', () => {
  assert.equal(grid.COLUMNS, 12);
  assert.equal(grid.ROWS, 9);
});

test('R1: spacing divides the bounds into equal cells', () => {
  assert.ok(Math.abs(grid.SPACING.lon - 1.5) < 0.001, `lon spacing ${grid.SPACING.lon}`);
  assert.ok(Math.abs(grid.SPACING.lat - 12.0 / 9) < 0.001, `lat spacing ${grid.SPACING.lat}`);
});

test('R1: spacing spans the bounds exactly', () => {
  const { minLon, maxLon, minLat, maxLat } = grid.BOUNDS;
  assert.ok(Math.abs(grid.SPACING.lon * grid.COLUMNS - (maxLon - minLon)) < 1e-9);
  assert.ok(Math.abs(grid.SPACING.lat * grid.ROWS - (maxLat - minLat)) < 1e-9);
});

test('R1: centre is the exact Chisinau coordinate', () => {
  assert.deepEqual(plain(grid.CENTER), { lat: 47.01, lon: 28.86 });
});

test('R1: centre lies strictly inside the bounds', () => {
  const { minLon, maxLon, minLat, maxLat } = grid.BOUNDS;
  assert.ok(grid.CENTER.lon > minLon && grid.CENTER.lon < maxLon);
  assert.ok(grid.CENTER.lat > minLat && grid.CENTER.lat < maxLat);
});

test('R1: cell centres derived from the constants stay inside the bounds', () => {
  // Consumers derive column and row centres from these constants alone; the
  // first and last must fall strictly inside, never on, the bounds.
  const firstLon = grid.BOUNDS.minLon + grid.SPACING.lon / 2;
  const lastLon = firstLon + (grid.COLUMNS - 1) * grid.SPACING.lon;
  const firstLat = grid.BOUNDS.minLat + grid.SPACING.lat / 2;
  const lastLat = firstLat + (grid.ROWS - 1) * grid.SPACING.lat;

  assert.ok(Math.abs(firstLon - 20.61) < 0.001, `first column centre ${firstLon}`);
  assert.ok(Math.abs(lastLon - 37.11) < 0.001, `last column centre ${lastLon}`);
  assert.ok(Math.abs(firstLat - 41.667) < 0.001, `first row centre ${firstLat}`);
  assert.ok(Math.abs(lastLat - 52.333) < 0.001, `last row centre ${lastLat}`);

  assert.ok(firstLon > grid.BOUNDS.minLon && lastLon < grid.BOUNDS.maxLon);
  assert.ok(firstLat > grid.BOUNDS.minLat && lastLat < grid.BOUNDS.maxLat);
});

test('R1: constants are frozen against consumer mutation', () => {
  assert.throws(() => { 'use strict'; grid.BOUNDS.minLon = 0; }, TypeError);
  assert.throws(() => { 'use strict'; grid.CENTER.lat = 0; }, TypeError);
  assert.throws(() => { 'use strict'; grid.SPACING.lon = 0; }, TypeError);
});

test('R1: reading the constants triggers no fetch', () => {
  // The module loads in a context with no network primitives at all, so a
  // read path that fetched would have thrown above. Guard the source too.
  const source = readRepoFile('Grid.js');
  for (const forbidden of ['fetch', 'XMLHttpRequest', 'Qt.createQmlObject', 'Network']) {
    assert.ok(!source.includes(forbidden), `Grid.js must not reference ${forbidden}`);
  }
});
