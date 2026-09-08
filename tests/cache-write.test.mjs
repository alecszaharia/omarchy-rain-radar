// cavekit-weather-data.md R5 — persisting the last successful model (T-022).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';
const model = plain(M.buildGridModel(completeResponse(), FETCHED_AT));

test('R5: the cached payload carries a model equivalent to the published one', () => {
  const written = JSON.parse(M.serializeCache(model));
  assert.deepEqual(written.model, model);
  assert.equal(written.model.cells.length, 108);
  assert.equal(written.model.dataTime, model.dataTime);
  assert.equal(written.model.fetchedAt, FETCHED_AT);
});

test('R5: the payload is versioned so a future shape change is detectable', () => {
  const written = JSON.parse(M.serializeCache(model));
  assert.equal(written.version, M.CACHE_VERSION);
  assert.equal(typeof M.CACHE_VERSION, 'number');
});

test('R5: the cache lives under the user state directory', () => {
  assert.equal(M.CACHE_RELATIVE_PATH, 'omarchy/cloud-radar/model.json');
  assert.ok(!M.CACHE_RELATIVE_PATH.startsWith('/'), 'the path must be relative to the state root');
  // Resolved from XDG_STATE_HOME with the same fallback Omarchy's own plugins use.
  assert.match(service, /Quickshell\.env\("XDG_STATE_HOME"\) \|\| \(Quickshell\.env\("HOME"\) \+ "\/\.local\/state"\)/);
  assert.match(service, /readonly property string cachePath: stateRoot \+ "\/" \+ Model\.CACHE_RELATIVE_PATH/);
});

test('R5: the model is published before it is persisted', () => {
  // The screen must not wait on the disk.
  const publishAt = service.indexOf('statusState.set(Model.STATUS.ready)');
  const writeAt = service.indexOf('root.writeCache(parsed.model)');
  assert.ok(publishAt > 0 && writeAt > publishAt, 'the cache write must follow publication');
});

test('R5: a write failure is logged and non-fatal', () => {
  // Both paths are covered: a throwing setText and the asynchronous save
  // failure the file view reports later.
  assert.match(service, /try \{\s*cacheFile\.setText\(Model\.serializeCache\(model\)\)/);
  assert.match(service, /catch \(e\) \{\s*console\.warn\("cloud-radar: could not write the cache at"/);
  assert.match(service, /onSaveFailed: function\(error\) \{[\s\S]*?console\.warn/);
  // Failure must not touch the published model or the status.
  const writeFn = service.slice(service.indexOf('function writeCache'), service.indexOf('property FileView cacheFile'));
  assert.ok(!/gridModel\s*=/.test(writeFn), 'a cache write must never change the published model');
  assert.ok(!/statusState\.set/.test(writeFn), 'a cache write must never change the status');
});

test('R5: writes are atomic so a torn file cannot be left behind', () => {
  assert.match(service, /atomicWrites: true/);
});

test('R5: nothing is written when there is no model', () => {
  assert.match(service, /function writeCache\(model\) \{\s*if \(!model\) return false/);
});
