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

// Every sampled point, in the order consumers must preserve: the 108 cell
// centres row-major from the north-west corner (row 0 is the northernmost),
// then the exact centre sample last at index 108. The order is derived purely
// from the constants above, so two calls always agree — the grid model's
// cells[] and the fetch's coordinate lists are indexed by it.
function gridPoints() {
  var points = []
  for (var row = 0; row < GRID_ROWS; row++) {
    for (var col = 0; col < GRID_COLUMNS; col++) {
      points.push({
        lat: GRID_BOUNDS.maxLat - GRID_LAT_STEP * (row + 0.5),
        lon: GRID_BOUNDS.minLon + GRID_LON_STEP * (col + 0.5)
      })
    }
  }
  // The centre is sampled exactly rather than read off the nearest cell, so the
  // bar glyph reports Chisinau itself.
  points.push({ lat: GRID_CENTER.lat, lon: GRID_CENTER.lon })
  return points
}

// Index of the centre sample within gridPoints(). Named so consumers never
// hard-code 108.
var GRID_CELL_COUNT = GRID_COLUMNS * GRID_ROWS
var GRID_CENTER_INDEX = GRID_CELL_COUNT
var GRID_POINT_COUNT = GRID_CELL_COUNT + 1

// ---------------------------------------------------------------------------
// Observable status — cavekit-weather-data.md R6
//
// Exactly one of these four values is current at any instant. The enum and its
// validator live here so both the store (WeatherStatus.qml) and every consumer
// agree on the vocabulary; the observability itself is QML's property change
// notification, which WeatherStatus.qml gets from declaring `status` a property.
// ---------------------------------------------------------------------------

var STATUS = {
  loading: "loading",
  ready: "ready",
  stale: "stale",
  error: "error"
}

// Declared explicitly rather than derived from STATUS with Object.keys so the
// set is a stated contract: adding a value here is a deliberate act.
var STATUS_VALUES = ["loading", "ready", "stale", "error"]

function isStatus(value) {
  for (var i = 0; i < STATUS_VALUES.length; i++) {
    if (STATUS_VALUES[i] === value) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Projection — cavekit-map-rendering.md R1
//
// Equirectangular: longitude and latitude map linearly onto the map area, with
// no per-latitude stretching, so every grid cell becomes a rectangle of the
// same size. The map area is expected to be laid out at MAP_ASPECT; at that
// aspect the horizontal and vertical scales are equal and the projection is
// distortion-free in both axes.
// ---------------------------------------------------------------------------

var GRID_LON_SPAN = GRID_BOUNDS.maxLon - GRID_BOUNDS.minLon
var GRID_LAT_SPAN = GRID_BOUNDS.maxLat - GRID_BOUNDS.minLat

// Width-to-height ratio the map area should be laid out at to preserve the
// aspect ratio of the bounds (18 degrees of longitude by 12 of latitude).
var MAP_ASPECT = GRID_LON_SPAN / GRID_LAT_SPAN

// Fraction of the map area's width at the given longitude. minLon maps to 0
// and maxLon to 1, increasing monotonically in between.
function projectLonFraction(lon) {
  return (lon - GRID_BOUNDS.minLon) / GRID_LON_SPAN
}

// Fraction of the map area's height at the given latitude. maxLat (north) maps
// to 0 and minLat (south) to 1, so increasing latitude decreases the vertical
// position as screen coordinates require.
function projectLatFraction(lat) {
  return (GRID_BOUNDS.maxLat - lat) / GRID_LAT_SPAN
}

function projectPoint(lon, lat, width, height) {
  return {
    x: projectLonFraction(lon) * width,
    y: projectLatFraction(lat) * height
  }
}

// Units per degree along each axis. Both are independent of position — that is
// what makes the projection free of differential stretching — so a single pair
// describes the whole map area.
function projectionScale(width, height) {
  return {
    xPerLon: width / GRID_LON_SPAN,
    yPerLat: height / GRID_LAT_SPAN
  }
}
