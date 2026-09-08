// cavekit-map-rendering.md R7 — centre condition to glyph mapping (T-026).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const glyphs = plain(M.BAR_GLYPHS);
const docs = readRepoFile('docs/rendering.md');

const center = (cloud, precip = 0) => ({ cloudCoverPercent: cloud, precipitationMm: precip });

test('R7: exactly four glyphs are defined, one per condition', () => {
  assert.deepEqual(Object.keys(glyphs).sort(),
    ['clear', 'overcast', 'partlyCloudy', 'precipitating']);
  assert.equal(new Set(Object.values(glyphs)).size, 4, 'the glyphs must be distinguishable');
  for (const glyph of Object.values(glyphs)) {
    assert.equal([...glyph].length, 1, 'each condition must be a single glyph');
  }
});

test('R7: the thresholds are documented', () => {
  assert.match(docs, /## Bar glyph/);
  for (const fragment of ['0 <= cc < 25', '25 <= cc < 75', '75 <= cc <= 100']) {
    assert.ok(docs.includes(fragment), `missing documented threshold: ${fragment}`);
  }
  for (const codepoint of ['U+E318', 'U+E30D', 'U+E302', 'U+E33D']) {
    assert.ok(docs.includes(codepoint), `missing documented glyph: ${codepoint}`);
  }
});

test('R7: the documented codepoints match the code', () => {
  assert.equal(glyphs.clear.codePointAt(0), 0xe30d);
  assert.equal(glyphs.partlyCloudy.codePointAt(0), 0xe302);
  assert.equal(glyphs.overcast.codePointAt(0), 0xe33d);
  assert.equal(glyphs.precipitating.codePointAt(0), 0xe318);
});

test('R7: cloud cover selects the condition when nothing is falling', () => {
  assert.equal(M.barCondition(center(0)), 'clear');
  assert.equal(M.barCondition(center(24.9)), 'clear');
  assert.equal(M.barCondition(center(25)), 'partlyCloudy');
  assert.equal(M.barCondition(center(74.9)), 'partlyCloudy');
  assert.equal(M.barCondition(center(75)), 'overcast');
  assert.equal(M.barCondition(center(100)), 'overcast');
});

test('R7: precipitation wins over cloud cover', () => {
  for (const cloud of [0, 25, 50, 75, 100]) {
    assert.equal(M.barCondition(center(cloud, 0.5)), 'precipitating', `at ${cloud}% cloud`);
    assert.equal(M.barCondition(center(cloud, 50)), 'precipitating', `at ${cloud}% cloud`);
  }
  // Below the none threshold is not precipitation.
  assert.equal(M.barCondition(center(10, 0.05)), 'clear');
});

test('R7: the mapping is total and unambiguous over every valid pair', () => {
  const conditions = new Set();
  for (let cloud = 0; cloud <= 100; cloud += 0.5) {
    for (const precip of [0, 0.05, 0.1, 1, 3, 8, 100]) {
      const condition = M.barCondition(center(cloud, precip));
      assert.ok(condition, `no condition for cloud ${cloud}, precip ${precip}`);
      assert.ok(condition in glyphs, `unknown condition ${condition}`);
      conditions.add(condition);
    }
  }
  assert.equal(conditions.size, 4, 'every condition must be reachable');
});

test('R7: an unavailable centre precipitation counts as no precipitation', () => {
  assert.equal(M.barCondition(center(10, M.UNAVAILABLE)), 'clear');
  assert.equal(M.barCondition(center(50, M.UNAVAILABLE)), 'partlyCloudy');
  assert.equal(M.barCondition(center(90, M.UNAVAILABLE)), 'overcast');
});

test('R7: an unavailable centre cloud cover resolves to no condition', () => {
  // Never a condition glyph: unknown data must not read as clear weather.
  for (const cloud of [M.UNAVAILABLE, null, undefined, NaN, -1, 101, '50']) {
    assert.equal(M.barCondition(center(cloud)), null, `${String(cloud)} must not resolve`);
    assert.equal(M.barGlyph(center(cloud)), '', 'no glyph may be produced');
  }
  assert.equal(M.barCondition(null), null);
});

test('R7: barGlyph returns the documented glyph for each condition', () => {
  assert.equal(M.barGlyph(center(5)), glyphs.clear);
  assert.equal(M.barGlyph(center(50)), glyphs.partlyCloudy);
  assert.equal(M.barGlyph(center(90)), glyphs.overcast);
  assert.equal(M.barGlyph(center(50, 5)), glyphs.precipitating);
});
