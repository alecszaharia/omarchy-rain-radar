// cavekit-plugin-packaging.md R2 — lint, symlinks and dev-only fields (T-050).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readdirSync, lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readRepoJson } from './qml-js.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = readRepoJson('manifest.json');
const OMARCHY_PATH = process.env.OMARCHY_PATH || '/usr/share/omarchy';

function qmlFiles() {
  return readdirSync(repoRoot).filter((f) => f.endsWith('.qml'));
}

test('R2: qmllint reports no errors for the bar-widget entry point', () => {
  const entry = manifest.entryPoints.barWidget;
  const output = execFileSync('qmllint', ['-I', join(OMARCHY_PATH, 'shell'), join(repoRoot, entry)],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(output.trim(), '', `qmllint reported: ${output}`);
});

test('R2: qmllint is clean for every QML file, not just the entry point', () => {
  const files = qmlFiles().map((f) => join(repoRoot, f));
  assert.ok(files.length > 0, 'expected QML files');
  const output = execFileSync('qmllint', ['-I', join(OMARCHY_PATH, 'shell'), ...files],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  assert.equal(output.trim(), '', `qmllint reported: ${output}`);
});

test('R2: the package contains no symlinks', () => {
  const found = [];
  const walk = (dir, relative = '') => {
    for (const name of readdirSync(dir)) {
      if (name === '.git') continue;
      const full = join(dir, name);
      const rel = relative ? `${relative}/${name}` : name;
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) found.push(rel);
      else if (stat.isDirectory()) walk(full, rel);
    }
  };
  walk(repoRoot);
  assert.deepEqual(found, [], `symlinks present: ${found.join(', ')}`);
});

test('R2: no development-only manifest fields remain', () => {
  // `omarchy.clonedFrom` is written by `omarchy plugin clone --edit` and must
  // be gone before publishing.
  assert.equal(manifest['omarchy.clonedFrom'], undefined);
  assert.equal(manifest.omarchy?.clonedFrom, undefined);
  const serialized = JSON.stringify(manifest);
  for (const marker of ['clonedFrom', 'devOnly', 'TODO', 'FIXME', 'localhost', '127.0.0.1']) {
    assert.ok(!serialized.includes(marker), `the manifest still carries ${marker}`);
  }
});

test('R2: no QML file carries a development-only escape hatch', () => {
  for (const file of qmlFiles()) {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    for (const marker of ['localhost', '127.0.0.1', 'file:///tmp', 'FIXME']) {
      assert.ok(!source.includes(marker), `${file} carries ${marker}`);
    }
  }
});
