// cavekit-plugin-packaging.md R5 — user documentation (T-056).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, readRepoFile, readRepoJson } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const readmeRaw = readRepoFile('README.md');
// Line wrapping is a formatting choice, not content, so phrases are matched
// against a whitespace-normalised copy.
const readme = readmeRaw.replace(/\s+/g, ' ');
const manifest = readRepoJson('manifest.json');
const schema = manifest.barWidget.schema[0];

const REPO_URL = 'https://github.com/alecszaharia/omarchy-rain-radar';

test('R5: the README documents installation with the standard command', () => {
  assert.match(readme, /omarchy plugin add /);
  // The repository the plugin is actually published from, which is not the
  // same string as the plugin id.
  assert.ok(readme.includes(REPO_URL), `the install command must name ${REPO_URL}`);
});

test('R5: the README documents placing it next to the weather widget', () => {
  assert.match(readme, /## Placing it next to the weather widget/);
  assert.ok(readme.includes('omarchy.weather'), 'it must name the built-in widget');
  assert.ok(readme.includes('shell.json'), 'it must say where the bar layout lives');
  assert.ok(readme.includes(manifest.id), 'it must name this widget too');
});

test('R5: the README documents refreshMinutes with its range and default', () => {
  assert.ok(readme.includes('refreshMinutes'));
  assert.ok(readme.includes(`${schema.min}–${schema.max}`) || readme.includes(`${schema.min}-${schema.max}`),
    'the range must be documented');
  assert.ok(new RegExp(`\\b${schema.defaultValue}\\b`).test(readme), 'the default must be documented');
});

test('R5: the documented range matches the manifest and the code', () => {
  assert.equal(schema.min, M.REFRESH_MINUTES_MIN);
  assert.equal(schema.max, M.REFRESH_MINUTES_MAX);
  assert.equal(schema.defaultValue, M.REFRESH_MINUTES_DEFAULT);
});

test('R5: the README states the dependency budget', () => {
  assert.match(readme, /## Requirements/);
  assert.ok(readme.includes('no additional packages'));
  assert.ok(readme.includes('without elevated privileges'));
});

test('R5: the README credits Open-Meteo verbatim', () => {
  assert.ok(readme.includes(M.OPEN_METEO_ATTRIBUTION),
    `the README must carry "${M.OPEN_METEO_ATTRIBUTION}"`);
});
