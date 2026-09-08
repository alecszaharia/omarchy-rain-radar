// Loads a QML .js resource (plain top-level functions, no module system) into
// an isolated context so its pure logic can be unit-tested under node without
// changing the file's QML semantics.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadQmlJs(relativePath) {
  const source = readFileSync(join(repoRoot, relativePath), 'utf8');
  const context = vm.createContext({ Math, JSON, Date, isNaN, isFinite, parseInt, parseFloat, String, Number, Object, Array });
  vm.runInContext(source, context, { filename: relativePath });
  return context;
}

export function readRepoFile(relativePath) {
  return readFileSync(join(repoRoot, relativePath), 'utf8');
}

export function readRepoJson(relativePath) {
  return JSON.parse(readRepoFile(relativePath));
}

// Values built inside the vm realm carry that realm's prototypes, so node's
// strict deep-equality rejects them against host-realm literals even when the
// data is identical. structuredClone rebuilds them in this realm and, unlike a
// JSON round-trip, preserves Infinity and NaN — which matter here, since an
// unbounded band threshold is a real value in the contract.
export function plain(value) {
  return structuredClone(value);
}
