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

// ---------------------------------------------------------------------------
// Grid model — cavekit-weather-data.md R3
//
// The sole data structure handed to Map Rendering. Built from a parsed
// Open-Meteo multi-location response, whose entries are positional: entry i
// corresponds to gridPoints()[i], the last one being the centre sample.
// ---------------------------------------------------------------------------

// The distinct value a measurement takes when the source did not supply a
// usable one. Deliberately not 0: "no cloud" and "we do not know" must never
// render the same way.
var UNAVAILABLE = "unavailable"

// Open-Meteo returns a bare object for a single location and an array for
// several. Normalising to an array first keeps the rest of the mapping
// positional and shape-agnostic.
//
// Positional is the only safe mapping here: the response echoes back the
// coordinates of the source's own model grid, not the ones asked for (the
// centre sample 47.01,28.86 comes back as 47.0,28.875). Cell coordinates
// therefore always come from gridPoints(), never from the response.
function responseLocations(raw) {
  if (raw === null || raw === undefined) return []
  if (Object.prototype.toString.call(raw) === "[object Array]") return raw
  if (typeof raw === "object") return [raw]
  return []
}

// The observation time reported by the source. Every location in one response
// shares a model run, so the first entry that carries a time speaks for all.
function responseDataTime(locations) {
  for (var i = 0; i < locations.length; i++) {
    var entry = locations[i]
    if (entry && entry.current && entry.current.time) return String(entry.current.time)
  }
  return ""
}

function measurementsAt(locations, index) {
  var entry = locations[index]
  var current = entry ? entry.current : null
  return {
    cloudCoverPercent: current ? current.cloud_cover : UNAVAILABLE,
    precipitationMm: current ? current.precipitation : UNAVAILABLE
  }
}

// Builds the grid model from a parsed response. `fetchedAt` is the local time
// the fetch completed, supplied by the caller so this stays a pure function.
// Returns null when the response cannot supply a point-for-point mapping.
function buildGridModel(raw, fetchedAt) {
  var locations = responseLocations(raw)
  if (locations.length < GRID_POINT_COUNT) return null

  var points = gridPoints()
  var cells = []
  for (var i = 0; i < GRID_CELL_COUNT; i++) {
    var measured = measurementsAt(locations, i)
    cells.push({
      lat: points[i].lat,
      lon: points[i].lon,
      cloudCoverPercent: measured.cloudCoverPercent,
      precipitationMm: measured.precipitationMm
    })
  }

  return {
    bounds: {
      minLon: GRID_BOUNDS.minLon,
      maxLon: GRID_BOUNDS.maxLon,
      minLat: GRID_BOUNDS.minLat,
      maxLat: GRID_BOUNDS.maxLat
    },
    columns: GRID_COLUMNS,
    rows: GRID_ROWS,
    cells: cells,
    center: measurementsAt(locations, GRID_CENTER_INDEX),
    dataTime: responseDataTime(locations),
    fetchedAt: fetchedAt
  }
}

// ---------------------------------------------------------------------------
// Open-Meteo request — cavekit-weather-data.md R2
//
// One request covers every sampled point: Open-Meteo takes parallel latitude
// and longitude lists and answers with one entry per pair, in the same order,
// which is exactly the positional contract buildGridModel relies on.
// ---------------------------------------------------------------------------

var OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

// Only the two measurements the map draws. No forecast series, no low/mid/high
// cloud layers — anything more is bandwidth the plugin never renders.
var OPEN_METEO_CURRENT = "cloud_cover,precipitation"

// Four decimals is ~11 m at these latitudes: far below the grid's 1.5-degree
// spacing, and it keeps the query string to a manageable length. The centre
// coordinate survives it exactly.
function roundCoordinate(value) {
  return Math.round(value * 10000) / 10000
}

// The full request URL for one refresh. No API key: Open-Meteo's free
// non-commercial tier is unauthenticated, so there is no credential to leak.
function requestUrl() {
  var points = gridPoints()
  var latitudes = []
  var longitudes = []
  for (var i = 0; i < points.length; i++) {
    latitudes.push(roundCoordinate(points[i].lat))
    longitudes.push(roundCoordinate(points[i].lon))
  }
  return OPEN_METEO_URL +
    "?latitude=" + latitudes.join(",") +
    "&longitude=" + longitudes.join(",") +
    "&current=" + OPEN_METEO_CURRENT +
    "&timezone=GMT"
}
