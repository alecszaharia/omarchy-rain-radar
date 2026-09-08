// cavekit-map-rendering.md R6 — popup theming follows the bar (T-018).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRepoFile } from './qml-js.mjs';

const panel = readRepoFile('Panel.qml');
const widget = readRepoFile('BarWidget.qml');
const panelBase = readFileSync('/usr/share/omarchy/shell/Ui/Panel.qml', 'utf8');

test('R6: the popup takes its foreground colour from the bar', () => {
  assert.match(panel, /readonly property color foregroundColor: root\.barForeground/);
  // barForeground is a live binding on the Panel base, so a bar theme change
  // propagates without a reload.
  assert.match(panelBase, /readonly property color barForeground: bar \? bar\.barForeground : Color\.foreground/,
    'the shell Panel base no longer derives barForeground from the bar');
});

test('R6: the popup takes its font family from the bar', () => {
  assert.match(panel, /readonly property string themeFontFamily: root\.bar \? root\.bar\.fontFamily : ""/);
});

test('R6: no text in the popup hard-codes a colour or a font', () => {
  const textBlocks = panel.split(/\bText\s*\{/).slice(1);
  assert.ok(textBlocks.length > 0, 'expected at least one Text element');
  for (const block of textBlocks) {
    const body = block.slice(0, block.indexOf('}'));
    const color = body.match(/color:\s*(.+)/);
    assert.ok(color, 'every Text must set a colour');
    assert.match(color[1].trim(), /^root\.foregroundColor/, `hard-coded text colour: ${color[1].trim()}`);
    const font = body.match(/font\.family:\s*(.+)/);
    assert.ok(font, 'every Text must set a font family');
    assert.match(font[1].trim(), /^root\.themeFontFamily/, `hard-coded font family: ${font[1].trim()}`);
  }
});

test('R6: no QML file hard-codes a hex colour', () => {
  // Data-layer colours (cloud, precipitation) are documented constants in
  // Model.js, not literals scattered through the QML.
  for (const [name, source] of [['Panel.qml', panel], ['BarWidget.qml', widget]]) {
    const literals = source.match(/"#[0-9a-fA-F]{3,8}"/g) || [];
    assert.deepEqual(literals, [], `${name} hard-codes colours: ${literals.join(', ')}`);
  }
});

test('R6: the bar entry uses the bar foreground rather than its own colour', () => {
  // BarIconButton takes its colour from the bar it is handed.
  assert.match(widget, /bar: root\.bar/);
});
