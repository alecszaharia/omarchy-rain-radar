// cavekit-plugin-packaging.md R1 — the single refreshMinutes setting (T-004).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readRepoJson } from './qml-js.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readRepoJson('manifest.json');
const schema = manifest.barWidget.schema;

test('R1: the settings schema contains exactly one entry', () => {
  assert.equal(schema.length, 1);
});

test('R1: that entry is refreshMinutes, integer, 10-120, default 20', () => {
  const entry = schema[0];
  assert.equal(entry.key, 'refreshMinutes');
  assert.equal(entry.type, 'integer');
  assert.equal(entry.min, 10);
  assert.equal(entry.max, 120);
  assert.equal(entry.defaultValue, 20);
});

test('R1: the declared default matches the schema default', () => {
  assert.deepEqual(manifest.barWidget.defaults, { refreshMinutes: 20 });
});

test('R1: the step keeps the default reachable and stays inside the range', () => {
  const { min, max, step, defaultValue } = schema[0];
  assert.ok(Number.isInteger(step) && step > 0);
  assert.equal((defaultValue - min) % step, 0, 'default must land on the step grid');
  assert.ok(max >= min);
});

test('R1: no other user-configurable setting is exposed anywhere in the plugin', () => {
  // The manifest is the only place a setting can be declared to the shell, and
  // the only key the code may read back is refreshMinutes.
  assert.deepEqual(schema.map((e) => e.key), ['refreshMinutes']);
  const qmlFiles = readdirSync(repoRoot).filter((f) => f.endsWith('.qml'));
  for (const file of qmlFiles) {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    for (const [, key] of source.matchAll(/\bsetting\(\s*"([^"]+)"/g)) {
      assert.equal(key, 'refreshMinutes', `${file} reads an undeclared setting: ${key}`);
    }
  }
});
