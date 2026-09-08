// cavekit-map-rendering.md R7 — stale, error and unknown appearances (T-041).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const widget = readRepoFile('BarWidget.qml');
const docs = readRepoFile('docs/rendering.md');

const center = (cloud, precip = 0) => ({ cloudCoverPercent: cloud, precipitationMm: precip });
const look = (c, status) => plain(M.barAppearance(c, status));
const key = (a) => `${a.glyph}@${a.opacity}`;

test('R7: an unavailable centre cloud never resolves to a condition glyph', () => {
  const glyphs = Object.values(plain(M.BAR_GLYPHS));
  for (const status of ['ready', 'stale', 'error', 'loading']) {
    const appearance = look(center(M.UNAVAILABLE), status);
    assert.ok(!glyphs.includes(appearance.glyph),
      `unknown data must not read as weather in ${status}`);
    assert.equal(appearance.glyph, M.BAR_UNKNOWN_GLYPH);
  }
});

test('R7: a failed refresh keeps reporting the reading it still has', () => {
  // The glyph answers what the weather is; the opacity answers how much to
  // trust it. A failed refresh must not make the bar claim ignorance while the
  // popup is still showing a map.
  const glyphs = plain(M.BAR_GLYPHS);
  assert.equal(look(center(7), 'error').glyph, glyphs.clear);
  assert.equal(look(center(50, 4), 'error').glyph, glyphs.precipitating);
  assert.notEqual(look(center(7), 'error').glyph, M.BAR_UNKNOWN_GLYPH);
});

test('R7: the unknown glyph is reserved for having no reading at all', () => {
  assert.equal(look(center(M.UNAVAILABLE), 'ready').glyph, M.BAR_UNKNOWN_GLYPH);
  assert.equal(look(null, 'ready').glyph, M.BAR_UNKNOWN_GLYPH);
  // And never appears while a usable reading exists, whatever the status.
  for (const status of ['ready', 'stale', 'error', 'loading']) {
    assert.notEqual(look(center(7), status).glyph, M.BAR_UNKNOWN_GLYPH,
      `a usable reading must survive ${status}`);
  }
});

test('R7: stale is distinct from ready', () => {
  const ready = look(center(50), 'ready');
  const stale = look(center(50), 'stale');
  assert.notEqual(key(ready), key(stale));
  // The condition is still reported, just dimmed.
  assert.equal(stale.glyph, ready.glyph);
  assert.ok(stale.opacity < ready.opacity);
});

test('R7: error is distinct from both ready and stale', () => {
  const ready = look(center(50), 'ready');
  const stale = look(center(50), 'stale');
  const error = look(center(50), 'error');
  assert.notEqual(key(error), key(ready));
  assert.notEqual(key(error), key(stale));
  assert.equal(error.glyph, ready.glyph, 'the reading itself is unchanged');
  assert.ok(error.opacity < stale.opacity, 'error dims further than stale');
});

test('R7: an unknown centre reads as unknown whatever the status', () => {
  // With no reading there is nothing for the status to qualify, so every
  // status presents identically: the entry never implies a reading it lacks.
  const unknown = look(center(M.UNAVAILABLE), 'error');
  for (const status of ['ready', 'stale', 'error', 'loading']) {
    assert.deepEqual(look(center(M.UNAVAILABLE), status), unknown,
      `an unknown centre must look the same in ${status}`);
  }
});

test('R7: every status pair is distinguishable for a known centre', () => {
  const seen = new Map();
  for (const status of ['ready', 'stale', 'error']) {
    const appearance = look(center(50), status);
    assert.ok(!seen.has(key(appearance)), `${status} collides with ${seen.get(key(appearance))}`);
    seen.set(key(appearance), status);
  }
});

test('R7: the unknown glyph is a real glyph, distinct from the four conditions', () => {
  assert.equal(M.BAR_UNKNOWN_GLYPH.codePointAt(0), 0xe374);
  assert.equal([...M.BAR_UNKNOWN_GLYPH].length, 1);
  for (const glyph of Object.values(plain(M.BAR_GLYPHS))) {
    assert.notEqual(glyph, M.BAR_UNKNOWN_GLYPH);
  }
});

test('R7: the appearances are documented', () => {
  assert.match(docs, /## Bar appearance by status/);
  assert.match(docs, /U\+E374/);
  for (const value of [M.BAR_READY_OPACITY, M.BAR_STALE_OPACITY, M.BAR_ERROR_OPACITY]) {
    assert.ok(docs.includes(String(value)), `opacity ${value} must be documented`);
  }
});

test('R7: the bar entry renders the appearance and reacts to the status', () => {
  assert.match(widget, /readonly property var appearance: Model\.barAppearance\(\s*weather\.gridModel \? weather\.gridModel\.center : null, weather\.status\)/);
  assert.match(widget, /text: root\.appearance\.glyph/);
  assert.match(widget, /opacity: root\.appearance\.opacity/);
});
