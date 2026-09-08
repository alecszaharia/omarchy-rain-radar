// cavekit-map-rendering.md R5 — the popup legends (T-033).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const panel = readRepoFile('Panel.qml');
const bands = plain(M.PRECIPITATION_BANDS);

test('R5: the cloud legend shows both ends of the scale', () => {
  assert.match(panel, /text: "0%"/);
  assert.match(panel, /text: "100% cloud"/);
});

test('R5: the cloud legend is the scale it describes', () => {
  // The scale is opacity of one colour, so the legend ramps that same colour
  // from transparent to full rather than inventing a separate key.
  assert.match(panel, /GradientStop \{ position: 0\.0; color: "transparent" \}/);
  assert.match(panel, /GradientStop \{ position: 1\.0; color: Model\.CLOUD_COLOR \}/);
  assert.match(panel, /orientation: Gradient\.Horizontal/);
});

test('R5: the precipitation legend has one entry per band', () => {
  assert.match(panel, /Repeater \{\s*model: Model\.PRECIPITATION_BANDS/);
  assert.equal(bands.length, 4);
});

test('R5: each band entry is labelled with its threshold', () => {
  assert.match(panel, /Model\.precipitationBandName\(modelData\) \+ " " \+ Model\.precipitationBandLabel\(modelData\)/);
  assert.equal(M.precipitationBandLabel(bands[0]), '< 0.1 mm');
  assert.equal(M.precipitationBandLabel(bands[1]), '0.1-2.5 mm');
  assert.equal(M.precipitationBandLabel(bands[2]), '2.5-7.6 mm');
  assert.equal(M.precipitationBandLabel(bands[3]), '7.6+ mm');
});

test('R5: the labels name the bands', () => {
  assert.deepEqual(bands.map((b) => M.precipitationBandName(b)),
    ['None', 'Light', 'Moderate', 'Heavy']);
  assert.equal(M.precipitationBandName(null), '');
  assert.equal(M.precipitationBandLabel(null), '');
});

test('R5: every threshold in the legend matches the documented band', () => {
  for (const band of bands) {
    const label = M.precipitationBandLabel(band);
    if (band.maxMm === Infinity) {
      assert.ok(label.includes(String(band.minMm)), `${band.id} must show its lower bound`);
    } else {
      assert.ok(label.includes(String(band.maxMm)), `${band.id} must show its upper bound`);
    }
  }
});

test('R5: each swatch is drawn at its own band opacity', () => {
  assert.match(panel, /color: Model\.PRECIPITATION_COLOR/);
  assert.match(panel, /opacity: modelData\.opacity/);
  // The none band is invisible by definition, so it gets an outline instead of
  // being an empty gap in the legend.
  assert.match(panel, /border\.width: modelData\.opacity === 0 \? 1 : 0/);
});

test('R5: the legends follow the bar theme like the rest of the popup', () => {
  const legendStart = panel.indexOf('// ---- Legends (R5)');
  const legendEnd = panel.indexOf('// Observation time');
  const legends = panel.slice(legendStart, legendEnd);
  const texts = legends.split(/\bText\s*\{/).slice(1);
  assert.ok(texts.length >= 3, 'expected the scale ends and the band labels');
  for (const block of texts) {
    const body = block.slice(0, block.indexOf('}'));
    assert.match(body, /color: root\.foregroundColor/);
    assert.match(body, /font\.family: root\.themeFontFamily/);
  }
});
