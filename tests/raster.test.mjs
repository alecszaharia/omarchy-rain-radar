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

test('a device-resolution raster is the cost being avoided', () => {
  // Kept as the record of why the layers paint a fixed raster: at the popup's
  // size on a 2x display this is what a per-device-pixel paint would cost, in
  // V8, writing into a plain array. QML writing into a canvas pixel buffer is
  // dearer still, which is how it came to peg the shell.
  const cells = plain(M.buildGridModel(completeResponse(), new Date().toISOString())).cells;
  const w = 480, h = 320;
  const data = new Array(w * h * 4).fill(0);

  const started = process.hrtime.bigint();
  M.paintCloudField(cells, w, h, data, CLOUD, HATCH);
  const quarterScaleMs = Number(process.hrtime.bigint() - started) / 1e6;

  const fixed = M.FIELD_RASTER_WIDTH * M.FIELD_RASTER_HEIGHT;
  assert.ok(fixed * 12 < w * h,
    'the fixed raster must be more than an order of magnitude smaller');
  assert.ok(quarterScaleMs > 0);
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

test('a raster larger than the budget paints nothing rather than wedging', () => {
  // Writing into a canvas pixel buffer from QML costs far more per element than
  // writing into a plain array, and an overrunning paint pegs the shell rather
  // than merely dropping a frame. A blank layer is recoverable; a wedged
  // desktop is not.
  const cells = fieldCells(() => 50);
  const w = 4000, h = 2880;
  assert.ok(w * h > M.MAX_RASTER_PIXELS);
  const data = { length: 0 };
  let touched = false;
  const probe = new Proxy(data, { set() { touched = true; return true; } });
  M.paintCloudField(cells, w, h, probe, CLOUD, HATCH);
  M.paintPrecipitationField(cells, w, h, probe, PRECIP);
  assert.equal(touched, false, 'an oversized raster must not be painted at all');
});

test('the layers paint a fixed raster, not one pixel per device pixel', () => {
  // At the popup's size on a 2x display a device-resolution raster is 614,400
  // pixels, which is what pegged the shell. The fixed raster is independent of
  // canvas size and comfortably inside the budget.
  const deviceRaster = (M.POPUP_CONTENT_WIDTH * 2) * Math.round((M.POPUP_CONTENT_WIDTH / M.MAP_ASPECT) * 2);
  assert.ok(deviceRaster > M.MAX_RASTER_PIXELS, 'the device raster is the thing being avoided');

  assert.ok(M.rasterFits(M.FIELD_RASTER_WIDTH, M.FIELD_RASTER_HEIGHT));
  assert.ok(M.FIELD_RASTER_WIDTH * M.FIELD_RASTER_HEIGHT < 20000,
    'the fixed raster must be small enough to paint well inside a frame');

  // Still generously oversampled against the 12x9 sample lattice, so the
  // upscale loses nothing.
  assert.ok(M.FIELD_RASTER_WIDTH >= M.GRID_COLUMNS * 8);
  assert.ok(M.FIELD_RASTER_HEIGHT >= M.GRID_ROWS * 8);

  for (const source of ['CloudLayer.qml', 'PrecipitationLayer.qml']) {
    const qml = readRepoFile(source);
    assert.match(qml, /width: Model\.FIELD_RASTER_WIDTH/, `${source} must paint the fixed raster`);
    assert.match(qml, /smooth: true/, `${source} must scale smoothly`);
    assert.ok(!/Math\.floor\(root\.width\)/.test(qml), `${source} must not size the raster to the item`);
  }
});

test('the fixed raster paints well inside a frame budget', () => {
  const cells = fieldCells((col, row) => (col * 13 + row * 29) % 101);
  const w = M.FIELD_RASTER_WIDTH, h = M.FIELD_RASTER_HEIGHT;
  const data = new Array(w * h * 4).fill(0);
  const started = process.hrtime.bigint();
  M.paintCloudField(cells, w, h, data, CLOUD, HATCH);
  M.paintPrecipitationField(cells, w, h, data, PRECIP);
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 10, `both layers took ${elapsedMs.toFixed(2)} ms`);
});
