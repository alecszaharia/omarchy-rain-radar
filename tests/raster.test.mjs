// cavekit-map-rendering.md R3/R4 — the raster painters agree with the
// definition and are fast enough to actually land (T-031, T-032 follow-up).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadQmlJs, plain, readRepoFile } from './qml-js.mjs';
import { completeResponse } from './fixtures/make.mjs';

const M = loadQmlJs('Model.js');

function fieldCells(cloudAt, precipAt = () => 0) {
  const cells = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      cells.push({ cloudCoverPercent: cloudAt(col, row), precipitationMm: precipAt(col, row) });
    }
  }
  return cells;
}

test('the layers rasterise into rectangles, not per device pixel', () => {
  // Sampling per device pixel could not land a paint, and createImageData /
  // putImageData rendered nothing at all in the shell. The layers draw the way
  // Basemap and CenterMarker do, which demonstrably renders.
  for (const source of ['CloudLayer.qml', 'PrecipitationLayer.qml']) {
    const qml = readRepoFile(source);
    assert.match(qml, /^Canvas \{/m, `${source} must be a full-size Canvas`);
    assert.match(qml, /ctx\.fillRect\(/, `${source} must draw with fill calls`);
    assert.ok(!/ctx\.(createImageData|putImageData)\(/.test(qml),
      `${source} must not use ImageData, which renders nothing in this shell`);
    assert.match(qml, /Model\.FIELD_RECT_COLUMNS/, `${source} must use the shared rect grid`);
  }
});

test('the rect grid is far finer than the sampling lattice', () => {
  // So a rectangle is much smaller than the scale on which the field varies.
  assert.ok(M.FIELD_RECT_COLUMNS >= M.GRID_COLUMNS * 8);
  assert.ok(M.FIELD_RECT_ROWS >= M.GRID_ROWS * 8);
  // And few enough fill calls to paint comfortably.
  assert.ok(M.FIELD_RECT_COLUMNS * M.FIELD_RECT_ROWS <= 20000,
    'too many fill calls to land a paint');
});

test('sampling the rect grid is cheap enough to paint on every change', () => {
  const cells = fieldCells((col, row) => (col * 13 + row * 29) % 101);
  const started = process.hrtime.bigint();
  let drawn = 0;
  for (let ry = 0; ry < M.FIELD_RECT_ROWS; ry++) {
    const v = (ry + 0.5) / M.FIELD_RECT_ROWS;
    for (let rx = 0; rx < M.FIELD_RECT_COLUMNS; rx++) {
      const u = (rx + 0.5) / M.FIELD_RECT_COLUMNS;
      if (M.isUnavailableAt(cells, u, v)) continue;
      const value = M.sampleCloudField(cells, u, v);
      if (value !== M.UNAVAILABLE && M.cloudOpacity(value) > 0) drawn += 1;
    }
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(drawn > 0, 'the field must produce visible rectangles');
  assert.ok(elapsedMs < 60, `sampling the rect grid took ${elapsedMs.toFixed(1)} ms`);
});

test('the layers ask for a paint whenever anything relevant changes', () => {
  for (const source of ['CloudLayer.qml', 'PrecipitationLayer.qml']) {
    const qml = readRepoFile(source);
    assert.match(qml, /onWidthChanged: requestPaint\(\)/, `${source} must repaint on resize`);
    assert.match(qml, /onGridModelChanged: requestPaint\(\)/, `${source} must repaint on new data`);
    assert.match(qml, /onAvailableChanged: if \(available\) requestPaint\(\)/,
      `${source} must paint once the canvas is available`);
    // The popup is closed when the layer is built, and a hidden Canvas can
    // drop a requested paint. The data changes only once per refresh, so a
    // dropped first request would never be followed by another.
    assert.match(qml, /onVisibleChanged: if \(visible\) requestPaint\(\)/,
      `${source} must paint when the popup opens`);
  }
});
