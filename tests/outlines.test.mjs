// cavekit-map-rendering.md R2 — bundled basemap outlines (T-008).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadQmlJs, plain } from './qml-js.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outlines = plain(loadQmlJs('data/Outlines.js').OUTLINES);

const REQUIRED = ['moldova', 'romania', 'ukraine', 'bulgaria', 'hungary',
                  'slovakia', 'poland', 'belarus', 'serbia', 'black-sea'];

test('R2: outline geometry for all ten regions is bundled', () => {
  const ids = outlines.regions.map((r) => r.id);
  for (const id of REQUIRED) {
    assert.ok(ids.includes(id), `missing region: ${id}`);
  }
  assert.equal(outlines.regions.length, REQUIRED.length);
});

test('R2: every region carries usable ring geometry', () => {
  for (const region of outlines.regions) {
    assert.ok(region.rings.length > 0, `${region.id} has no rings`);
    for (const ring of region.rings) {
      assert.equal(ring.length % 2, 0, `${region.id} ring must be flat lon,lat pairs`);
      assert.ok(ring.length >= 8, `${region.id} ring is degenerate`);
    }
  }
});

test('R2: all geometry lies inside the declared bounds', () => {
  const b = outlines.bounds;
  for (const region of outlines.regions) {
    for (const ring of region.rings) {
      for (let i = 0; i < ring.length; i += 2) {
        assert.ok(ring[i] >= b.minLon - 1e-6 && ring[i] <= b.maxLon + 1e-6,
          `${region.id} longitude ${ring[i]} outside bounds`);
        assert.ok(ring[i + 1] >= b.minLat - 1e-6 && ring[i + 1] <= b.maxLat + 1e-6,
          `${region.id} latitude ${ring[i + 1]} outside bounds`);
      }
    }
  }
});

test('R2: Moldova is flagged for emphasis and is the only one', () => {
  const emphasized = outlines.regions.filter((r) => r.emphasis).map((r) => r.id);
  assert.deepEqual(emphasized, ['moldova']);
});

test('R2: the outline source, license and redistribution right are recorded', () => {
  const a = outlines.attribution;
  assert.equal(a.source, 'Natural Earth');
  assert.equal(a.license, 'Public domain');
  assert.equal(a.redistributionPermitted, true);
  assert.ok(a.url.startsWith('https://'));
  assert.ok(a.licenseUrl.startsWith('https://'));
});

test('R2: the basemap is bundled, not fetched', () => {
  // The data ships in the package, and no shipped source may name a remote
  // host for it — that is what makes "no network request for outline data"
  // structural rather than a matter of runtime luck.
  assert.ok(statSync(join(repoRoot, 'data/Outlines.js')).size > 0);
  const shipped = readdirSync(repoRoot).filter((f) => f.endsWith('.qml') || f === 'Model.js');
  for (const file of shipped) {
    const source = readFileSync(join(repoRoot, file), 'utf8');
    assert.ok(!/naturalearthdata|githubusercontent|tile\.|\.pbf|\.mbtiles/.test(source),
      `${file} must not reference a remote basemap source`);
  }
});
