// cavekit-plugin-packaging.md R5 — license file matches the manifest (T-005).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRepoFile, readRepoJson } from './qml-js.mjs';

const manifest = readRepoJson('manifest.json');
const license = readRepoFile('LICENSE');

test('R5: a license file exists for the plugin itself', () => {
  assert.ok(license.trim().length > 0);
});

test("R5: the manifest's declared license matches the license file", () => {
  assert.equal(manifest.license, 'MIT');
  assert.match(license, /^MIT License/);
  assert.match(license, /Permission is hereby granted, free of charge/);
});
