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

// Cloud cover is a percentage. Anything that is not a finite number inside
// 0..100 is unknown, and unknown is never 0: an absent reading and a clear sky
// must not render the same way.
function normalizeCloudCover(value) {
  if (typeof value !== "number" || !isFinite(value)) return UNAVAILABLE
  if (value < 0 || value > 100) return UNAVAILABLE
  return value
}

// Precipitation is a millimetre amount, so any finite value from 0 upwards is
// meaningful. Negative amounts are not physical and read as unknown.
function normalizePrecipitation(value) {
  if (typeof value !== "number" || !isFinite(value)) return UNAVAILABLE
  if (value < 0) return UNAVAILABLE
  return value
}

// A location the source dropped keeps its slot: the entry is present but
// carries no current block, so the cell is unknown while every other cell stays
// on its own reading. Silently closing the gap instead would shift every
// following cell onto its neighbour's data.
function measurementsAt(locations, index) {
  var entry = locations[index]
  var current = entry ? entry.current : null
  if (!current) {
    return { cloudCoverPercent: UNAVAILABLE, precipitationMm: UNAVAILABLE }
  }
  return {
    cloudCoverPercent: normalizeCloudCover(current.cloud_cover),
    precipitationMm: normalizePrecipitation(current.precipitation)
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

// ---------------------------------------------------------------------------
// Refresh interval — cavekit-weather-data.md R4
//
// The plugin's only user setting. The shell hands over whatever sits in the
// widget's shell.json entry, which may be absent, out of range or not a number
// at all, so the effective interval is always derived rather than trusted.
// ---------------------------------------------------------------------------

var REFRESH_MINUTES_MIN = 10
var REFRESH_MINUTES_MAX = 120
var REFRESH_MINUTES_DEFAULT = 20

function effectiveRefreshMinutes(value) {
  // Only numbers and numeric strings are meaningful. Booleans in particular
  // must not slip through Number()'s coercion and become a 1-minute interval.
  if (typeof value === "number") {
    if (!isFinite(value)) return REFRESH_MINUTES_DEFAULT
  } else if (typeof value === "string") {
    var trimmed = value.replace(/^\s+|\s+$/g, "")
    // Number("") is 0, and a trailing-garbage string like "15min" must not be
    // read as 15, so the whole string has to look like a number.
    if (trimmed === "" || !/^[+-]?\d+(\.\d+)?$/.test(trimmed)) return REFRESH_MINUTES_DEFAULT
    value = Number(trimmed)
    if (!isFinite(value)) return REFRESH_MINUTES_DEFAULT
  } else {
    return REFRESH_MINUTES_DEFAULT
  }

  var minutes = Math.round(value)
  if (minutes < REFRESH_MINUTES_MIN) return REFRESH_MINUTES_MIN
  if (minutes > REFRESH_MINUTES_MAX) return REFRESH_MINUTES_MAX
  return minutes
}

// The interval as milliseconds, for the scheduler's timer.
function refreshIntervalMs(value) {
  return effectiveRefreshMinutes(value) * 60 * 1000
}

// Rectangle for each of the 108 cells, in cells[] order, covering the map area
// exactly. Derived from the projection, so a resize is just a fresh call with
// the new size rather than a second source of truth.
function cellRects(width, height) {
  var cellWidth = width / GRID_COLUMNS
  var cellHeight = height / GRID_ROWS
  var rects = []
  for (var row = 0; row < GRID_ROWS; row++) {
    for (var col = 0; col < GRID_COLUMNS; col++) {
      rects.push({
        x: col * cellWidth,
        y: row * cellHeight,
        width: cellWidth,
        height: cellHeight
      })
    }
  }
  return rects
}

// ---------------------------------------------------------------------------
// Popup geometry — cavekit-map-rendering.md R6
// ---------------------------------------------------------------------------

// Popup content width, in the same Style.space units the shell's own panels
// use. 480 is the value Omarchy's built-in weather popup passes to
// fittedContentWidth, so Cloud Radar sits beside it at a matching width.
// Documented in docs/rendering.md.
var POPUP_CONTENT_WIDTH = 480

// ---------------------------------------------------------------------------
// Basemap styling — cavekit-map-rendering.md R2
//
// The emphasis rule, documented in docs/rendering.md: Moldova is stroked at
// twice the base width and at full foreground opacity, while its neighbours are
// stroked at the base width and held back to a muted opacity. Both use the
// bar's foreground colour rather than a fixed palette, so the outlines stay
// legible on light and dark themes alike.
// ---------------------------------------------------------------------------

var BASEMAP_STROKE_WIDTH = 1.0
var BASEMAP_EMPHASIS_STROKE_MULTIPLIER = 2.0
var BASEMAP_NEIGHBOUR_OPACITY = 0.45
var BASEMAP_EMPHASIS_OPACITY = 1.0
var BASEMAP_WATER_OPACITY = 0.18

// Stroke width and opacity for one region. Returned rather than branched at the
// call site so the rule lives in one place and can be asserted directly.
function basemapStyle(region) {
  if (region && region.kind === "water") {
    return {
      lineWidth: BASEMAP_STROKE_WIDTH,
      opacity: BASEMAP_WATER_OPACITY,
      filled: true
    }
  }
  if (region && region.emphasis === true) {
    return {
      lineWidth: BASEMAP_STROKE_WIDTH * BASEMAP_EMPHASIS_STROKE_MULTIPLIER,
      opacity: BASEMAP_EMPHASIS_OPACITY,
      filled: false
    }
  }
  return {
    lineWidth: BASEMAP_STROKE_WIDTH,
    opacity: BASEMAP_NEIGHBOUR_OPACITY,
    filled: false
  }
}

// ---------------------------------------------------------------------------
// Parse boundary — cavekit-weather-data.md R3
//
// Everything the source sends crosses into the plugin here. A response that
// cannot be turned into a whole grid model yields no model at all, and the
// model already on screen survives the attempt: a bad refresh must never blank
// out good data.
// ---------------------------------------------------------------------------

function parseGridModel(rawText, fetchedAt) {
  var text = String(rawText === null || rawText === undefined ? "" : rawText)
  if (text.replace(/^\s+|\s+$/g, "") === "") {
    return { model: null, errorText: "Empty response from Open-Meteo" }
  }

  var parsed
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return { model: null, errorText: "Unreadable response from Open-Meteo" }
  }

  // Open-Meteo reports its own failures as an object with error/reason rather
  // than an HTTP status, so a well-formed body can still be a failure.
  if (parsed && parsed.error) {
    return {
      model: null,
      errorText: String(parsed.reason || "Open-Meteo reported an error")
    }
  }

  var model = buildGridModel(parsed, fetchedAt)
  if (!model) {
    return { model: null, errorText: "Incomplete response from Open-Meteo" }
  }
  return { model: model, errorText: "" }
}

// The model that stays published after an attempt. A failed attempt keeps
// whatever was already there, including nothing.
function nextPublishedModel(previous, parsed) {
  return (parsed && parsed.model) ? parsed.model : previous
}

// The status an attempt's outcome implies, before staleness is considered.
// Staleness and the error-over-stale precedence are applied in T-039/T-046.
function statusForParse(parsed) {
  return (parsed && parsed.model) ? STATUS.ready : STATUS.error
}

// ---------------------------------------------------------------------------
// Fetch execution — cavekit-weather-data.md R2
// ---------------------------------------------------------------------------

// Wall-clock ceiling on one request, in seconds. A fixed constant, deliberately
// not a user setting: it exists so a stalled connection fails the refresh
// instead of pinning the widget in `loading` forever. Comfortably longer than a
// healthy 109-point response takes, short enough to be well inside the
// shortest refresh interval (10 minutes).
var FETCH_TIMEOUT_SECONDS = 20

// The one command a refresh runs. curl enforces the timeout itself, so the
// bound holds even if the process is otherwise unresponsive.
function fetchCommand() {
  return ["curl", "-fsS", "--max-time", String(FETCH_TIMEOUT_SECONDS), requestUrl()]
}

// curl exit 28 is its operation timeout; the rest are transport or HTTP
// failures. Either way the refresh failed and the message has to say something.
function fetchFailureText(exitCode) {
  if (exitCode === 28) return "Open-Meteo timed out after " + FETCH_TIMEOUT_SECONDS + "s"
  return "Could not reach Open-Meteo (curl exit " + exitCode + ")"
}

// ---------------------------------------------------------------------------
// Cache — cavekit-weather-data.md R5
//
// The last successful grid model is persisted so a map is on screen before any
// network result. The payload is versioned: a future change to the model shape
// can then reject an old file instead of misreading it.
// ---------------------------------------------------------------------------

var CACHE_VERSION = 1

// Relative to the user's state directory; the QML side resolves the root from
// XDG_STATE_HOME, falling back to ~/.local/state, the way Omarchy's own plugins
// do.
var CACHE_RELATIVE_PATH = "omarchy/cloud-radar/model.json"

function serializeCache(model) {
  return JSON.stringify({ version: CACHE_VERSION, model: model }) + "\n"
}

// Chisinau marker geometry, in map pixels — cavekit-map-rendering.md R2. A
// filled dot inside an open ring reads at popup size without needing a label,
// which the map deliberately has none of.
var MARKER_DOT_RADIUS = 2.5
var MARKER_RING_RADIUS = 5.0
var MARKER_RING_WIDTH = 1.5

// ---------------------------------------------------------------------------
// Cloud heatmap — cavekit-map-rendering.md R3
//
// Cloud cover is drawn as the opacity of one fixed neutral colour. The hue
// never varies with the value: a viewer reads density, not colour, so there is
// no palette to misread and nothing to confuse with the blue precipitation
// overlay. Documented in docs/rendering.md.
// ---------------------------------------------------------------------------

// A mid neutral grey, deliberately neither white nor black: it has to read as
// cloud against a light bar theme and a dark one alike.
var CLOUD_COLOR = "#9aa0a6"

// Opacity for a cloud cover percentage. 0% is fully transparent, so the
// basemap underneath is untouched, and 100% is fully opaque — overcast hides
// the ground, which is why the Chisinau marker is drawn above this layer.
function cloudOpacity(percent) {
  if (typeof percent !== "number" || !isFinite(percent)) return 0
  if (percent <= 0) return 0
  if (percent >= 100) return 1
  return percent / 100
}

// ---------------------------------------------------------------------------
// Precipitation bands — cavekit-map-rendering.md R4
//
// Four bands, expressed as half-open millimetre intervals so the mapping is
// total over every value from 0 upwards with no gap and no overlap: a reading
// lands in exactly one band, always. Thresholds are the conventional hourly
// rain-rate breaks. Documented in docs/rendering.md.
// ---------------------------------------------------------------------------

var PRECIPITATION_BANDS = [
  { id: "none",     minMm: 0,   maxMm: 0.1,      opacity: 0.0 },
  { id: "light",    minMm: 0.1, maxMm: 2.5,      opacity: 0.30 },
  { id: "moderate", minMm: 2.5, maxMm: 7.6,      opacity: 0.55 },
  { id: "heavy",    minMm: 7.6, maxMm: Infinity, opacity: 0.80 }
]

// The band for a millimetre amount, by half-open interval [minMm, maxMm).
// Anything that is not a usable number — including UNAVAILABLE — reads as no
// precipitation rather than inventing one.
function precipitationBand(mm) {
  if (typeof mm !== "number" || !isFinite(mm) || mm < 0) return PRECIPITATION_BANDS[0]
  for (var i = 0; i < PRECIPITATION_BANDS.length; i++) {
    var band = PRECIPITATION_BANDS[i]
    if (mm >= band.minMm && mm < band.maxMm) return band
  }
  return PRECIPITATION_BANDS[PRECIPITATION_BANDS.length - 1]
}

// ---------------------------------------------------------------------------
// Bar glyph — cavekit-map-rendering.md R7
//
// The bar entry is an icon only. Its glyph reports the centre sample: whether
// anything is falling first, and failing that how much cloud there is. The
// mapping is total over every valid numeric pair. Documented in
// docs/rendering.md.
// ---------------------------------------------------------------------------

// Nerd Font weather glyphs, the same set Omarchy's own weather widget draws
// from, so they are known to render in the bar's font.
var BAR_GLYPHS = {
  clear: "",
  partlyCloudy: "",
  overcast: "",
  precipitating: ""
}

// Cloud cover breaks, in percent. Half-open like the precipitation bands:
// clear [0, 25), partly cloudy [25, 75), overcast [75, 100].
var BAR_CLOUD_CLEAR_MAX = 25
var BAR_CLOUD_OVERCAST_MIN = 75

// The condition at the centre, or null when it cannot be known. Precipitation
// wins over cloud cover: something falling is the more useful thing to report.
// An unavailable precipitation reading counts as none, so a known sky is still
// described; an unavailable cloud reading yields null, and T-041 turns that
// into the same appearance as an error rather than a condition.
function barCondition(center) {
  if (!center) return null

  var cloud = center.cloudCoverPercent
  if (typeof cloud !== "number" || !isFinite(cloud) || cloud < 0 || cloud > 100) return null

  if (precipitationBand(center.precipitationMm).id !== "none") return "precipitating"
  if (cloud < BAR_CLOUD_CLEAR_MAX) return "clear"
  if (cloud < BAR_CLOUD_OVERCAST_MIN) return "partlyCloudy"
  return "overcast"
}

function barGlyph(center) {
  var condition = barCondition(center)
  return condition ? BAR_GLYPHS[condition] : ""
}
