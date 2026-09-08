// cavekit-plugin-packaging.md R2 — validator cleanliness (T-049).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, isAbsolute, normalize } from 'node:path';
import { readRepoJson } from './qml-js.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readRepoJson('manifest.json');

test('R2: the Omarchy plugin validator reports no errors', () => {
  const output = execFileSync('omarchy', ['plugin', 'validate', repoRoot], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.ok(!/error/i.test(output), `validator reported: ${output}`);
});

test('R2: the manifest is well-formed and declares the required fields', () => {
  for (const field of ['schemaVersion', 'id', 'name', 'version', 'author', 'license',
                       'description', 'kinds', 'entryPoints']) {
    assert.ok(manifest[field] !== undefined, `manifest is missing ${field}`);
  }
  assert.equal(manifest.schemaVersion, 1);
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/, 'version must be semver');
});

test('R2: the declared kinds and entry points are consistent', () => {
  const KIND_TO_ENTRY = {
    'bar-widget': 'barWidget', panel: 'panel', overlay: 'overlay',
    menu: 'menu', service: 'service', bar: 'bar'
  };
  for (const kind of manifest.kinds) {
    const key = KIND_TO_ENTRY[kind];
    assert.ok(key, `unknown kind: ${kind}`);
    assert.ok(manifest.entryPoints[key], `kind ${kind} declares no ${key} entry point`);
  }
  // And nothing is declared that no kind asked for.
  for (const key of Object.keys(manifest.entryPoints)) {
    assert.ok(manifest.kinds.some((kind) => KIND_TO_ENTRY[kind] === key),
      `entry point ${key} has no matching kind`);
  }
});

test('R2: every declared entry path is relative, safe and exists', () => {
  for (const [key, entry] of Object.entries(manifest.entryPoints)) {
    assert.ok(!isAbsolute(entry), `${key} must be a relative path`);
    assert.ok(!normalize(entry).startsWith('..'), `${key} must not escape the package`);
    assert.ok(!entry.includes('\0'), `${key} contains a null byte`);
    const resolved = join(repoRoot, entry);
    assert.ok(existsSync(resolved), `${key} points at a missing file: ${entry}`);
    assert.ok(statSync(resolved).isFile(), `${key} must point at a file`);
  }
});

test('R2: the plugin id does not use the reserved omarchy. prefix', () => {
  assert.ok(!manifest.id.startsWith('omarchy.'));
  assert.match(manifest.id, /^[a-z0-9]+(\.[a-z0-9-]+)+$/, 'the id must be a namespaced identifier');
});

test('R2: no second user-configurable setting exists anywhere', () => {
  assert.equal(manifest.barWidget.schema.length, 1);
  assert.equal(manifest.barWidget.schema[0].key, 'refreshMinutes');
  assert.deepEqual(Object.keys(manifest.barWidget.defaults), ['refreshMinutes']);
  // No other manifest section may declare settings either.
  for (const [key, value] of Object.entries(manifest)) {
    if (key === 'barWidget') continue;
    assert.ok(!JSON.stringify(value ?? null).includes('schema'),
      `${key} must not declare a settings schema`);
  }
  // QML files are swept for setting() reads of any other key by the T-004 suite.
});
