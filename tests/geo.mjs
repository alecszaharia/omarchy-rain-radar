// Test-side geometry helpers.
//
// These used to live in Model.js purely so the tests could reach them, which
// meant shipping them to users. They belong here: the production code needs
// only the projection itself.
import { loadQmlJs, plain } from './qml-js.mjs';

const M = loadQmlJs('Model.js');

// The full-extent viewport, which is what every criterion written before zoom
// existed is stated against.
export const FULL_VIEW = plain(M.viewportFor(M.ZOOM_MIN));

// Fractional position of a grid point within the grid's own space.
export function gridPointFraction(col, row) {
  return {
    u: (col + 0.5) / M.GRID_COLUMNS,
    v: (row + 0.5) / M.GRID_ROWS
  };
}

// Units per degree along each axis, which the projection keeps constant.
export function projectionScale(width, height, view = FULL_VIEW) {
  return {
    xPerLon: width / (view.maxLon - view.minLon),
    yPerLat: height / (view.maxLat - view.minLat)
  };
}

// The rectangle each grid cell occupies when the whole extent is shown.
export function cellRects(width, height) {
  const cellWidth = width / M.GRID_COLUMNS;
  const cellHeight = height / M.GRID_ROWS;
  const rects = [];
  for (let row = 0; row < M.GRID_ROWS; row++) {
    for (let col = 0; col < M.GRID_COLUMNS; col++) {
      rects.push({ x: col * cellWidth, y: row * cellHeight, width: cellWidth, height: cellHeight });
    }
  }
  return rects;
}
