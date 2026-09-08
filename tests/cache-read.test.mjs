// cavekit-weather-data.md R5 — restoring the cache at startup (T-029).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const FETCHED_AT = '2026-09-08T06:05:12.000Z';
const model = plain(M.buildGridModel(completeResponse(), FETCHED_AT));

test('R5: a written cache round-trips back into the same model', () => {
  const restored = plain(M.deserializeCache(M.serializeCache(model)));
  assert.deepEqual(restored, model);
  assert.equal(restored.cells.length, 108);
});

test('R5: a restored model keeps its original dataTime and fetchedAt', () => {
  const restored = plain(M.deserializeCache(M.serializeCache(model)));
  assert.equal(restored.dataTime, model.dataTime);
  assert.equal(restored.fetchedAt, FETCHED_AT);
  // Not refreshed to "now" on restore — the model is as old as it says it is.
  assert.notEqual(restored.fetchedAt, new Date().toISOString());
});

test('R5: the cached model is published before any network result', () => {
  // The file view publishes on load, and the fetch cannot have completed yet.
  assert.match(service, /onLoaded: root\.restoreFromCache\(text\(\)\)/);
  const restore = service.slice(service.indexOf('function restoreFromCache'));
  assert.match(restore, /root\.gridModel = restored/);
  // A network result that already landed wins over the cache.
  assert.match(restore, /if \(root\.gridModel\) return false/);
});

test('R5: a corrupt or unreadable cache is ignored', () => {
  const garbage = ['', '   ', 'not json', '{', '{"version":1}', 'null', '[]', '42'];
  for (const raw of garbage) {
    assert.equal(M.deserializeCache(raw), null, `${JSON.stringify(raw)} must be ignored`);
  }
  assert.match(service, /onLoadFailed: root\.noteCacheUnreadable\(\)/);
});

test('R5: a cache from a different payload version is ignored', () => {
  const payload = JSON.parse(M.serializeCache(model));
  payload.version = M.CACHE_VERSION + 1;
  assert.equal(M.deserializeCache(JSON.stringify(payload)), null);
  payload.version = M.CACHE_VERSION - 1;
  assert.equal(M.deserializeCache(JSON.stringify(payload)), null);
});

test('R5: a cache whose model does not match the grid is ignored', () => {
  const mutations = [
    (p) => { p.model.cells = p.model.cells.slice(0, 50); },
    (p) => { p.model.columns = 10; },
    (p) => { p.model.rows = 8; },
    (p) => { p.model.bounds.minLon = 0; },
    (p) => { delete p.model.center; },
    (p) => { p.model.cells = 'not an array'; },
    (p) => { delete p.model; }
  ];
  for (const [i, mutate] of mutations.entries()) {
    const payload = JSON.parse(M.serializeCache(model));
    mutate(payload);
    assert.equal(M.deserializeCache(JSON.stringify(payload)), null, `mutation ${i} must be rejected`);
  }
});

test('R5: the cache read alone never produces an error status', () => {
  // Nothing has been fetched yet, so there is no fetch to have failed.
  // Scoped to the two cache functions themselves: a later guard elsewhere may
  // read the error status, but nothing on this path may set it.
  const restore = service.slice(service.indexOf('function noteCacheUnreadable'),
                                service.indexOf('// ---- Staleness'));
  assert.ok(!/set\(Model\.STATUS\.error\)/.test(restore), 'the cache path must not set the error status');
  assert.ok(!/statusOnFailure/.test(restore), 'the cache path must not report a failure');
  assert.match(service, /function noteCacheUnreadable\(\)[\s\S]*?root\.cacheChecked = true/);
});
