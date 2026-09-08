// cavekit-weather-data.md R2/R4 — one fetch per interval across all monitors.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const service = readRepoFile('WeatherData.qml');
const INTERVAL = 20 * 60 * 1000;

function modelAt(iso) {
  return plain(M.buildGridModel(completeResponse(), iso));
}

test('R2: a bar exists per monitor, so the service must not fetch per monitor', () => {
  // Each instance defers to a model that is already fresh, by the same rule the
  // load-time decision uses.
  assert.match(service, /function refreshIfDue\(\)/);
  assert.match(service, /Model\.loadTimeDecision\(root\.gridModel, new Date\(\), root\.refreshIntervalMs\)\.fetchNow/);
  assert.match(service, /onTriggered: root\.refreshIfDue\(\)/);
});

test('R4: a tick on a model younger than the interval does not fetch', () => {
  const now = new Date(Date.UTC(2026, 8, 8, 12, 0, 0));
  const fresh = modelAt(new Date(now.getTime() - 5 * 60 * 1000).toISOString());
  assert.equal(plain(M.loadTimeDecision(fresh, now, INTERVAL)).fetchNow, false);

  const due = modelAt(new Date(now.getTime() - 25 * 60 * 1000).toISOString());
  assert.equal(plain(M.loadTimeDecision(due, now, INTERVAL)).fetchNow, true);
});

test('R2: three instances sharing a cache issue one fetch per interval', () => {
  // Models the real arrangement: three services, staggered ticks, all reading
  // and writing the one cache file.
  const now = { t: Date.UTC(2026, 8, 8, 12, 0, 0) };
  let cache = modelAt(new Date(now.t - 30 * 60 * 1000).toISOString());
  let fetches = 0;

  const instances = [0, 15000, 30000].map((offset) => ({ offset, model: cache }));

  for (let cycle = 0; cycle < 3; cycle++) {
    for (const instance of instances) {
      now.t += instance.offset;
      // A watched cache means every instance sees the newest published model.
      if (M.parseDataTime(cache.fetchedAt).getTime() > M.parseDataTime(instance.model.fetchedAt).getTime()) {
        instance.model = cache;
      }
      if (plain(M.loadTimeDecision(instance.model, new Date(now.t), INTERVAL)).fetchNow) {
        fetches += 1;
        cache = modelAt(new Date(now.t).toISOString());
        instance.model = cache;
      }
    }
    now.t += INTERVAL;
  }

  assert.equal(fetches, 3, `expected one fetch per cycle across all monitors, got ${fetches}`);
});

test('R5: peers converge through the cache, newest wins', () => {
  assert.match(service, /watchChanges: true/);
  assert.match(service, /onFileChanged: reload\(\)/);
  // A cached model is adopted only when it is newer than what is on screen.
  const restore = service.slice(service.indexOf('function restoreFromCache'));
  assert.match(restore, /candidate\.getTime\(\) <= current\.getTime\(\)\)\) return false/);
});

test('R4: instances are offset so their ticks do not land together', () => {
  assert.match(service, /readonly property int scheduleOffsetMs: Math\.round\(Math\.random\(\) \* 45000\)/);
  assert.match(service, /interval: root\.refreshIntervalMs \+ root\.scheduleOffsetMs/);
});

test('R4: a manual refresh still bypasses the due check', () => {
  // Pressing Refresh must fetch even when the model is young.
  assert.match(service, /function requestManualRefresh\(\) \{\s*return root\.refresh\(\)\s*\}/);
  const manual = service.slice(service.indexOf('function requestManualRefresh'),
                               service.indexOf('function applyFailure'));
  assert.ok(!/refreshIfDue/.test(manual), 'the manual path must not defer to the schedule');
});

test('the documented request budget reflects one fetch per interval', () => {
  const readme = readRepoFile('README.md').replace(/\s+/g, ' ');
  assert.ok(readme.includes('regardless of how many monitors'),
    'the README must state that the budget does not multiply per monitor');
});
