// cavekit-map-rendering.md R3/R4 — the raster painters agree with the
// definition and are fast enough to actually land (T-031, T-032 follow-up).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');
const CLOUD = plain(M.CLOUD_RGB);
const HATCH = { r: 255, g: 255, b: 255 };
const PRECIP = plain(M.PRECIPITATION_RGB);

function fieldCells(cloudAt, precipAt = () => 0) {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      cells.push({ cloudCoverPercent: cloudAt(col, row), precipitationMm: precipAt(col, row) });
    }
  }
  return cells;
}

function paintCloud(cells, w, h) {
  const data = new Array(w * h * 4).fill(0);
  M.paintCloudField(cells, w, h, data, CLOUD, HATCH);
  return data;
}

test('R3: the fast painter reproduces sampleCloudField pixel for pixel', () => {
  const cells = fieldCells((col, row) => (col * 13 + row * 29) % 101);
  const w = 97, h = 61; // deliberately not multiples of the grid
  const data = paintCloud(cells, w, h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w;
      const v = (y + 0.5) / h;
      const value = M.sampleCloudField(cells, u, v);
      const expected = value === M.UNAVAILABLE ? 0 : Math.round(M.cloudOpacity(value) * 255);
      const actual = data[(y * w + x) * 4 + 3];
      assert.equal(actual, expected, `alpha differs at ${x},${y}`);
    }
  }
});

test('R3: the painter uses the cloud colour for every numeric pixel', () => {
  const cells = fieldCells(() => 50);
  const w = 40, h = 30;
  const data = paintCloud(cells, w, h);
  for (let i = 0; i < w * h; i++) {
    assert.equal(data[i * 4], CLOUD.r);
    assert.equal(data[i * 4 + 1], CLOUD.g);
    assert.equal(data[i * 4 + 2], CLOUD.b);
  }
});

test('R3: unavailable cells are hatched, in the hatch colour', () => {
  const cells = fieldCells((col, row) => (col === 5 && row === 4) ? M.UNAVAILABLE : 60);
  const w = 120, h = 90;
  const data = paintCloud(cells, w, h);

  let hatched = 0;
  let striped = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = (y + 0.5) / h;
      if (!M.isUnavailableAt(cells, u, v)) continue;
      hatched += 1;
      const i = (y * w + x) * 4;
      assert.equal(data[i], HATCH.r, `hatch colour at ${x},${y}`);
      const expected = Math.round(M.hatchAlphaAt(x, y) * 255);
      assert.equal(data[i + 3], expected, `hatch alpha at ${x},${y}`);
      if (data[i + 3] > 0) striped += 1;
    }
  }
  assert.ok(hatched > 0, 'the fixture must contain a hatched region');
  assert.ok(striped > 0 && striped < hatched, 'the hatch must be stripes, not a fill');
});

test('R4: the precipitation painter reproduces its own definition', () => {
  const cells = fieldCells(() => 50, (col, row) => ((col + row) % 5) * 2.5);
  const w = 83, h = 47;
  const data = new Array(w * h * 4).fill(0);
  M.paintPrecipitationField(cells, w, h, data, PRECIP);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = (y + 0.5) / h;
      const expected = M.isPrecipitationUnavailableAt(cells, u, v)
        ? 0
        : Math.round(plain(M.precipitationBand(M.samplePrecipitationField(cells, u, v))).opacity * 255);
      assert.equal(data[(y * w + x) * 4 + 3], expected, `alpha differs at ${x},${y}`);
    }
  }
});

test('R4: a cell with no amount draws nothing even beside a drenched neighbour', () => {
  const cells = fieldCells(() => 50, (col, row) => (col === 5 && row === 4) ? M.UNAVAILABLE : 8);
  const w = 120, h = 90;
  const data = new Array(w * h * 4).fill(0);
  M.paintPrecipitationField(cells, w, h, data, PRECIP);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w, v = (y + 0.5) / h;
      if (!M.isPrecipitationUnavailableAt(cells, u, v)) continue;
      assert.equal(data[(y * w + x) * 4 + 3], 0, `paint leaked into ${x},${y}`);
    }
  }
});

test('the painters are fast enough to paint on every model change', () => {
  // The readable per-pixel path costs ~270 ms for this raster in V8 and several
  // times that in QML's engine, which is why the layer rendered blank. The
  // budget here is generous but still an order of magnitude below that.
  const cells = plain(M.buildGridModel(completeResponse(), new Date().toISOString())).cells;
  const w = 480, h = 320;
  const data = new Array(w * h * 4).fill(0);

  const started = process.hrtime.bigint();
  M.paintCloudField(cells, w, h, data, CLOUD, HATCH);
  M.paintPrecipitationField(cells, w, h, data, PRECIP);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

  assert.ok(elapsedMs < 120, `both layers took ${elapsedMs.toFixed(1)} ms, which is too slow to paint`);
});

test('the layers call the painters rather than sampling per pixel', () => {
  const cloud = readRepoFile('CloudLayer.qml');
  const precipitation = readRepoFile('PrecipitationLayer.qml');
  assert.match(cloud, /Model\.paintCloudField\(/);
  assert.match(precipitation, /Model\.paintPrecipitationField\(/);
  for (const [name, source] of [['CloudLayer', cloud], ['PrecipitationLayer', precipitation]]) {
    assert.ok(!/for \(var y = 0/.test(source), `${name} must not run its own pixel loop`);
  }
});
