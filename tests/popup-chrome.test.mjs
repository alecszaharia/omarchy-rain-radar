// cavekit-map-rendering.md R6 — popup open/close/toggle and Escape (T-009).
//
// These are structural assertions over the QML sources. qmltestrunner is
// unusable in this environment (see context/impl/dead-ends.md), so the wiring
// is verified by shape here and exercised live in the shell at T-051.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRepoFile } from './qml-js.mjs';

const widget = readRepoFile('BarWidget.qml');
const panel = readRepoFile('Panel.qml');
const shellPanelBase = readFileSync('/usr/share/omarchy/shell/Ui/Panel.qml', 'utf8');

test('R6: the popup is a Panel loaded beneath the bar widget', () => {
  assert.match(panel, /^Panel \{/m, 'Panel.qml root type must be Panel');
  assert.match(widget, /source: Qt\.resolvedUrl\("Panel\.qml"\)/);
  assert.match(widget, /if \("hostWidget" in target\) target\.hostWidget = root/,
    'the panel must be told which item the bar identifies it by');
});

test('R6: activating the bar entry toggles the popup', () => {
  assert.match(widget, /onPressed: function\(b\) \{ root\.togglePanel\(\) \}/);
  assert.match(widget, /function togglePanel\(\)[\s\S]*panelLoader\.item\.toggle\(\)/);
});

test('R6: toggle opens when closed and closes when open', () => {
  // Panel.qml does not override toggle, so the base's implementation stands.
  assert.ok(!/function toggle\(/.test(panel), 'Panel.qml must not override toggle()');
  assert.match(shellPanelBase, /function toggle\(\) \{ opened \? close\(\) : open\(\) \}/,
    'the shell Panel base must still implement toggle as open-when-closed, close-when-open');
});

test('R6: Escape closes the open popup', () => {
  assert.match(panel, /PanelKeyCatcher \{/);
  assert.match(panel, /onCloseRequested: root\.close\(\)/);
  // PanelKeyCatcher is what turns the Escape key press into closeRequested.
  const catcher = readFileSync('/usr/share/omarchy/shell/Ui/PanelKeyCatcher.qml', 'utf8');
  assert.match(catcher, /Key_Escape/);
  assert.match(catcher, /closeRequested\(\)/);
});

test('R6: only one IPC handler owns the plugin target', () => {
  // The base installs an IpcHandler when manageIpc is true; the bar routes
  // summon/hide through the bar-widget root instead (T-016), so two handlers
  // on one target would collide.
  assert.match(panel, /manageIpc: false/);
});
