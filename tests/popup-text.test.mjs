// cavekit-map-rendering.md R5 — updated line and attribution (T-027).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const panel = readRepoFile('Panel.qml');

test("R5: the observation time is read as GMT, not as local time", () => {
  // Open-Meteo omits the zone suffix when the request asks for GMT. Letting
  // the runtime guess would shift the reading by the user's offset.
  const parsed = M.parseDataTime('2026-09-08T06:00');
  assert.equal(parsed.getTime(), Date.UTC(2026, 8, 8, 6, 0));
  // An explicit zone is respected rather than overridden.
  assert.equal(M.parseDataTime('2026-09-08T06:00Z').getTime(), Date.UTC(2026, 8, 8, 6, 0));
  assert.equal(M.parseDataTime('2026-09-08T09:00+03:00').getTime(), Date.UTC(2026, 8, 8, 6, 0));
});

test('R5: the clock is the local wall clock, zero-padded', () => {
  // Built from local components so the assertion holds in any timezone.
  assert.equal(M.formatClock(new Date(2026, 8, 8, 6, 5)), '06:05');
  assert.equal(M.formatClock(new Date(2026, 8, 8, 0, 0)), '00:00');
  assert.equal(M.formatClock(new Date(2026, 8, 8, 23, 59)), '23:59');
  assert.equal(M.formatClock(new Date(2026, 8, 8, 14, 30)), '14:30');
});

test('R5: the popup shows "Updated HH:MM" from the model dataTime', () => {
  const label = M.updatedLabel('2026-09-08T06:00');
  assert.match(label, /^Updated \d{2}:\d{2}$/);
  // The minutes come from the observation, whatever the reader's zone.
  assert.ok(label.endsWith(M.formatClock(M.parseDataTime('2026-09-08T06:00'))));
  assert.match(panel, /Model\.updatedLabel\(root\.gridModel \? root\.gridModel\.dataTime : ""\)/);
});

test('R5: no clock is shown when there is no usable observation time', () => {
  for (const value of ['', '   ', 'not a time', null, undefined, 42, {}]) {
    assert.equal(M.updatedLabel(value), '', `${JSON.stringify(String(value))} must not produce a clock`);
  }
  // A placeholder clock would be worse than none.
  assert.match(panel, /visible: text !== ""/);
});

test('R5: the Open-Meteo attribution is visible in the popup, verbatim', () => {
  assert.equal(M.OPEN_METEO_ATTRIBUTION, 'Weather data by Open-Meteo.com');
  assert.match(panel, /text: Model\.OPEN_METEO_ATTRIBUTION/);
  // It carries no visibility condition, so it is shown in every state.
  const block = panel.slice(panel.indexOf('text: Model.OPEN_METEO_ATTRIBUTION'));
  const body = block.slice(0, block.indexOf('}'));
  assert.ok(!/visible:/.test(body), 'the attribution must always be visible');
});
