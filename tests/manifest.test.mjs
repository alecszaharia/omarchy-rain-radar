// cavekit-plugin-packaging.md R1 — manifest identity block (T-001).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readRepoJson } from './qml-js.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readRepoJson('manifest.json');

test('R1: manifest declares the namespaced plugin id', () => {
  assert.equal(manifest.id, 'io.github.alecszaharia.cloud-radar');
});

test('R1: manifest declares the display name "Cloud Radar"', () => {
  assert.equal(manifest.name, 'Cloud Radar');
  assert.equal(manifest.barWidget.displayName, 'Cloud Radar');
});

test('R1: manifest declares kind bar-widget with an entry point that exists', () => {
  assert.deepEqual(manifest.kinds, ['bar-widget']);
  const entry = manifest.entryPoints.barWidget;
  assert.equal(entry, 'BarWidget.qml');
  assert.ok(existsSync(join(repoRoot, entry)), `${entry} must exist in the package`);
});

test('R1: manifest declares category "Info"', () => {
  assert.equal(manifest.barWidget.category, 'Info');
});

test('R1: manifest disallows multiple instances', () => {
  assert.equal(manifest.barWidget.allowMultiple, false);
});

test('R1: manifest declares default section "center"', () => {
  assert.equal(manifest.barWidget.defaultSection, 'center');
});

test('R2: plugin id does not use the reserved omarchy. prefix', () => {
  assert.ok(!manifest.id.startsWith('omarchy.'));
});
