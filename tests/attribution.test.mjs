// cavekit-plugin-packaging.md R5 / map-rendering R2 — attribution block (T-058).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile, readRepoJson } from './qml-js.mjs';

const M = loadQmlJs('Model.js');
const outlines = plain(loadQmlJs('data/Outlines.js').OUTLINES);
const readme = readRepoFile('README.md').replace(/\s+/g, ' ');
const manifest = readRepoJson('manifest.json');

test('R5: the README credits Open-Meteo verbatim', () => {
  assert.ok(readme.includes(M.OPEN_METEO_ATTRIBUTION));
});

test('R5: the README credits the bundled outline source', () => {
  assert.ok(readme.includes(outlines.attribution.source),
    `the README must name ${outlines.attribution.source}`);
  assert.ok(readme.includes(outlines.attribution.url));
});

test('R5: the README states the outline licence and that it permits redistribution', () => {
  assert.ok(readme.toLowerCase().includes('public domain'));
  assert.ok(readme.includes(outlines.attribution.licenseUrl));
  assert.ok(readme.includes('permits redistribution'),
    'the redistribution right must be stated, not implied');
  assert.equal(outlines.attribution.redistributionPermitted, true);
});

test('R5: the credited datasets are the ones actually bundled', () => {
  for (const dataset of outlines.attribution.dataset.split(', ')) {
    assert.ok(readme.includes(dataset), `the README must name the dataset ${dataset}`);
  }
});

test('R5: the README states the plugin licence and it matches the manifest', () => {
  assert.ok(readme.includes(manifest.license), `the README must name the ${manifest.license} licence`);
  assert.ok(readme.includes('LICENSE'), 'it must link the licence file');
});

test('R5: the README says the basemap is bundled rather than fetched', () => {
  assert.ok(readme.includes('never fetches anything to draw itself')
    || readme.includes('bundled with the plugin'));
});
