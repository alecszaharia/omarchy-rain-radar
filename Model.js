// Pure logic for Cloud Radar. Imported by the QML surfaces as
//   import "Model.js" as Model
// and unit-tested under node through tests/qml-js.mjs. Nothing in here may
// touch the network, the filesystem or any QML type: it is data in, data out.

// ---------------------------------------------------------------------------
// Sampling grid — cavekit-weather-data.md R1
//
// A fixed geographic grid over Eastern Europe centred on Chisinau. The bounds
// are divided into COLUMNS equal-width columns and ROWS equal-height rows, and
// every grid point is the centre of its cell, so no point ever lands on the
// bounds. These constants are the published contract: Map Rendering reads them
// to build its projection, and reading them never triggers a fetch.
// ---------------------------------------------------------------------------

var GRID_BOUNDS = {
  minLon: 19.86,
  maxLon: 37.86,
  minLat: 41.0,
  maxLat: 53.0
}

var GRID_COLUMNS = 12
var GRID_ROWS = 9

// Cell size in degrees. Derived rather than hard-coded so the spacing can never
// drift out of step with the bounds and the column/row counts.
var GRID_LON_STEP = (GRID_BOUNDS.maxLon - GRID_BOUNDS.minLon) / GRID_COLUMNS
var GRID_LAT_STEP = (GRID_BOUNDS.maxLat - GRID_BOUNDS.minLat) / GRID_ROWS

// Chisinau, Moldova. Sampled exactly, in addition to the 108 cell centres, so
// the bar glyph reports the centre rather than the nearest cell.
var GRID_CENTER = {
  lat: 47.01,
  lon: 28.86
}
