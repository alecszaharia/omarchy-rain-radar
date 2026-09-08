// cavekit-map-rendering.md R6 — shell summon/hide routing (T-016).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readRepoFile, readRepoJson } from './qml-js.mjs';

const widget = readRepoFile('BarWidget.qml');
const panel = readRepoFile('Panel.qml');
const manifest = readRepoJson('manifest.json');
const bar = readFileSync('/usr/share/omarchy/shell/plugins/bar/Bar.qml', 'utf8');

test('R6: the bar widget carries the shape summon/hide routing requires', () => {
  // Bar.findPanelWidget skips any slot item missing these three.
  assert.match(bar, /typeof item\.open !== "function" \|\| typeof item\.close !== "function" \|\| item\.opened === undefined/,
    'the shell routing contract changed — re-check this wiring');
  assert.match(widget, /readonly property bool opened:/);
  assert.match(widget, /function open\(\)/);
  assert.match(widget, /function close\(\)/);
});

test('R6: summon opens the popup and hide closes it', () => {
  assert.match(bar, /function summonBarWidget\(pluginId\)[\s\S]*?item\.open\(\)/);
  assert.match(bar, /function hideBarWidget\(pluginId\)[\s\S]*?item\.close\(\)/);
  // The widget forwards both straight to the panel that owns the lifecycle.
  assert.match(widget, /function open\(\)\s*\{\s*if \(panelLoader\.item && panelLoader\.item\.open\) panelLoader\.item\.open\(\)/);
  assert.match(widget, /function close\(\)\s*\{\s*if \(panelLoader\.item && panelLoader\.item\.close\) panelLoader\.item\.close\(\)/);
});

test('R6: routing is keyed on the plugin id the manifest declares', () => {
  // findPanelWidget matches slot.moduleName against the requested plugin id.
  assert.match(bar, /if \(slot\.moduleName !== id\) continue/);
  const id = manifest.id;
  assert.ok(widget.includes(`moduleName: "${id}"`), 'the bar widget must claim the manifest id');
  assert.ok(panel.includes(`moduleName: "${id}"`), 'the panel must claim the manifest id');
});

test('R6: popout hand-off is forwarded so the bar can switch panels', () => {
  assert.match(widget, /readonly property bool popoutSwitchClosing:/);
  assert.match(widget, /function closeForPopoutSwitch\(\)/);
});

test('R6: exactly one IPC owner for the plugin target', () => {
  // The panel's own IpcHandler stays off; routing goes through the bar.
  assert.match(panel, /manageIpc: false/);
});
