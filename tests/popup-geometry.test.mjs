// cavekit-map-rendering.md R6 — documented width and free-screen-area fit (T-017).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadQmlJs, readRepoFile } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const panel = readRepoFile('Panel.qml');
const docs = readRepoFile('docs/rendering.md');
const weatherPanel = readFileSync(
  '/usr/share/omarchy/shell/plugins/panels/weather/Panel.qml', 'utf8');

test('R6: the popup width is a documented constant', () => {
  assert.equal(M.POPUP_CONTENT_WIDTH, 480);
  assert.match(docs, /POPUP_CONTENT_WIDTH` *= *480|POPUP_CONTENT_WIDTH = 480/);
  assert.match(panel, /Style\.space\(Model\.POPUP_CONTENT_WIDTH\)/,
    'the panel must use the constant, not a literal');
});

test('R6: the width matches the built-in weather popup', () => {
  const match = weatherPanel.match(/fittedContentWidth\(Style\.space\((\d+)\)\)/);
  assert.ok(match, 'could not read the built-in weather popup width');
  assert.equal(Number(match[1]), M.POPUP_CONTENT_WIDTH,
    'Cloud Radar must match the width of the widget it sits beside');
});

test('R6: both dimensions are clamped to the free screen area', () => {
  assert.match(panel, /contentWidth: panel\.fittedContentWidth\(/);
  assert.match(panel, /contentHeight: panel\.fittedContentHeight\(/);
  // The fitters are what enforce the clamp, so a raw assignment would silently
  // drop the guarantee.
  assert.ok(!/contentWidth: *Style\.space\(\d/.test(panel), 'width must not bypass the fitter');
  assert.ok(!/contentHeight: *content\./.test(panel), 'height must not bypass the fitter');
});

test('R6: the requested geometry fits inside 1280x720', () => {
  // Mirrors KeyboardPanel's own formula for a top bar at the smallest
  // supported screen, using the shell's default gapsOut of 5.
  const margin = 5, gap = 5, barHeight = 40;
  const availableWidth = Math.max(120, 1280 - margin * 2);
  const availableHeight = Math.max(120, 720 - (barHeight + gap + margin));

  const width = M.POPUP_CONTENT_WIDTH;
  const mapHeight = width / M.MAP_ASPECT;
  // Title, map, and headroom for the controls, timestamp and status block.
  const contentHeight = 24 + mapHeight + 120;
  const verticalInset = 14 * 2 + 2;

  assert.ok(width <= availableWidth, `width ${width} exceeds ${availableWidth}`);
  assert.ok(contentHeight + verticalInset <= availableHeight,
    `height ${contentHeight + verticalInset} exceeds ${availableHeight}`);
});

test('R6: the map area is laid out at the projection aspect ratio', () => {
  assert.match(panel, /Model\.MAP_ASPECT/);
});
