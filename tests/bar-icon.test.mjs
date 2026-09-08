// cavekit-map-rendering.md R7 — the bar icon renderer (T-034).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const widget = readRepoFile('BarWidget.qml');
const glyphs = plain(M.BAR_GLYPHS);

const buttonBlock = (() => {
  const start = widget.indexOf('BarIconButton {');
  return widget.slice(start, widget.indexOf('\n  }', start));
})();

test('R7: the bar entry renders a glyph and nothing else', () => {
  assert.match(buttonBlock, /text: root\.appearance\.glyph/);
  // No percentage, no label, no thumbnail.
  assert.ok(!/%/.test(buttonBlock), 'the bar entry must not show a percentage');
  assert.ok(!/Image\s*\{|Canvas\s*\{/.test(widget), 'the bar entry must not draw a map thumbnail');
  assert.match(buttonBlock, /tooltipText: ""/);
});

test('R7: a fixture for each condition renders its documented glyph', () => {
  const fixtures = [
    ['clear', { cloudCoverPercent: 5, precipitationMm: 0 }, glyphs.clear],
    ['partly cloudy', { cloudCoverPercent: 50, precipitationMm: 0 }, glyphs.partlyCloudy],
    ['overcast', { cloudCoverPercent: 95, precipitationMm: 0 }, glyphs.overcast],
    ['precipitating', { cloudCoverPercent: 80, precipitationMm: 4 }, glyphs.precipitating]
  ];
  for (const [name, center, expected] of fixtures) {
    assert.equal(M.barGlyph(center), expected, `${name} must render its documented glyph`);
  }
  assert.equal(new Set(fixtures.map(([, , g]) => g)).size, 4, 'the four glyphs must differ');
});

test('R7: the glyph comes from the centre sample of the published model', () => {
  // Resolved once on the widget root and rendered by the button, so the glyph
  // and its appearance cannot disagree.
  assert.match(widget, /weather\.gridModel \? weather\.gridModel\.center : null/);
  assert.match(widget, /readonly property var appearance: Model\.barAppearance\(/);
});

test('R7: with no model yet the bar entry shows no glyph', () => {
  assert.equal(M.barGlyph(null), '');
});

test('R7: the bar entry uses the bar foreground, not its own colour', () => {
  // BarIconButton takes its colour from the bar it is handed.
  assert.match(buttonBlock, /bar: root\.bar/);
  assert.ok(!/color:/.test(buttonBlock), 'the bar entry must not set its own colour');
  assert.deepEqual(widget.match(/"#[0-9a-fA-F]{3,8}"/g) || [], []);
});

test('R7: the service lives with the bar entry, not the popup', () => {
  // The glyph must keep reporting even if the popup has never been opened.
  assert.match(widget, /WeatherData \{\s*id: weather/);
  assert.match(widget, /refreshMinutesSetting: root\.setting\("refreshMinutes", undefined\)/);
});

test('R7: the panel receives the service, so its bindings stay live', () => {
  assert.match(widget, /if \("weather" in target\) target\.weather = weather/);
  const panel = readRepoFile('Panel.qml');
  assert.match(panel, /readonly property var gridModel: weather \? weather\.gridModel : null/);
  assert.match(panel, /readonly property string dataStatus: weather \? weather\.status : Model\.STATUS\.loading/);
});
