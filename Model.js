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

// Fraction of the map area's width at the given longitude within `view`:
// view.minLon maps to 0 and view.maxLon to 1, increasing monotonically.
function projectLonFraction(lon, view) {
  return (lon - view.minLon) / (view.maxLon - view.minLon)
}

// Fraction of the map area's height at the given latitude. view.maxLat (north)
// maps to 0 and view.minLat (south) to 1, so increasing latitude decreases the
// vertical position as screen coordinates require.
function projectLatFraction(lat, view) {
  return (view.maxLat - lat) / (view.maxLat - view.minLat)
}

function projectPoint(lon, lat, width, height, view) {
  return {
    x: projectLonFraction(lon, view) * width,
    y: projectLatFraction(lat, view) * height
  }
}


// ---------------------------------------------------------------------------
// Zoom — cavekit-map-rendering.md R8
//
// Zoom shows a smaller window of the same sampled area; it never asks the
// source for more. The window keeps the bounds' aspect ratio and is centred on
// Chisinau, shifted back inside the bounds when that would run past an edge, so
// the map can never show ground the source did not report.
// ---------------------------------------------------------------------------

var ZOOM_MIN = 1.0
var ZOOM_MAX = 4.0
var ZOOM_STEP = 0.5

function clampZoom(zoom) {
  if (typeof zoom !== "number" || !isFinite(zoom)) return ZOOM_MIN
  if (zoom < ZOOM_MIN) return ZOOM_MIN
  if (zoom > ZOOM_MAX) return ZOOM_MAX
  return zoom
}

// The geographic window shown at a zoom level. At ZOOM_MIN this is exactly the
// sampled bounds.
function viewportFor(zoom) {
  var level = clampZoom(zoom)
  var lonSpan = GRID_LON_SPAN / level
  var latSpan = GRID_LAT_SPAN / level

  var minLon = GRID_CENTER.lon - lonSpan / 2
  var minLat = GRID_CENTER.lat - latSpan / 2

  // Shifted rather than shrunk: the window keeps its span, and with it the
  // aspect ratio the projection depends on.
  if (minLon < GRID_BOUNDS.minLon) minLon = GRID_BOUNDS.minLon
  if (minLon + lonSpan > GRID_BOUNDS.maxLon) minLon = GRID_BOUNDS.maxLon - lonSpan
  if (minLat < GRID_BOUNDS.minLat) minLat = GRID_BOUNDS.minLat
  if (minLat + latSpan > GRID_BOUNDS.maxLat) minLat = GRID_BOUNDS.maxLat - latSpan

  return {
    minLon: minLon,
    maxLon: minLon + lonSpan,
    minLat: minLat,
    maxLat: minLat + latSpan
  }
}

// Map-area fraction to grid-space fraction, so the field can be sampled through
// whatever window is on screen. Split per axis so a caller looping rows can
// resolve the vertical term once per row instead of once per rectangle.
function viewToGridU(u, view) {
  return ((view.minLon + u * (view.maxLon - view.minLon)) - GRID_BOUNDS.minLon) / GRID_LON_SPAN
}

function viewToGridV(v, view) {
  return (GRID_BOUNDS.maxLat - (view.maxLat - v * (view.maxLat - view.minLat))) / GRID_LAT_SPAN
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

// Separator between the response body and the trailing status line curl
// appends. Chosen because it cannot occur in JSON.
var FETCH_STATUS_SEPARATOR = "\n<<<cloud-radar-status:"

// The one command a refresh runs. curl enforces the timeout itself, so the
// bound holds even if the process is otherwise unresponsive.
//
// Deliberately not -f: a rate-limit rejection has to be told apart from an
// ordinary transport failure, which means reading the HTTP status rather than
// collapsing every 4xx into one exit code. The status is appended after the
// body so a single stream carries both.
function fetchCommand() {
  return [
    "curl", "-sS",
    "--max-time", String(FETCH_TIMEOUT_SECONDS),
    "-w", FETCH_STATUS_SEPARATOR + "%{http_code}",
    requestUrl()
  ]
}

// Splits curl's output back into the body and the HTTP status it carried.
// A missing or unreadable status reads as 0, which is not a success and not a
// rate limit either — it is simply unknown.
function parseFetchOutput(rawText) {
  var text = String(rawText === null || rawText === undefined ? "" : rawText)
  var marker = text.lastIndexOf(FETCH_STATUS_SEPARATOR)
  if (marker < 0) return { body: text, httpCode: 0 }

  var body = text.slice(0, marker)
  var codeText = text.slice(marker + FETCH_STATUS_SEPARATOR.length).replace(/^\s+|\s+$/g, "")
  var code = parseInt(codeText, 10)
  return { body: body, httpCode: isNaN(code) ? 0 : code }
}

function isSuccessStatus(httpCode) {
  return httpCode >= 200 && httpCode < 300
}

// ---------------------------------------------------------------------------
// Rate limiting — cavekit-weather-data.md R4
// ---------------------------------------------------------------------------

var RATE_LIMIT_STATUS = 429
var RATE_LIMIT_BACKOFF_MULTIPLIER = 2

function isRateLimited(httpCode) {
  return httpCode === RATE_LIMIT_STATUS
}

// How long to wait after a rate-limit rejection: at least twice the configured
// interval, so backing off actually reduces the load rather than retrying into
// the same limit.
function rateLimitBackoffMs(intervalMs) {
  return intervalMs * RATE_LIMIT_BACKOFF_MULTIPLIER
}

function httpFailureText(httpCode) {
  if (isRateLimited(httpCode)) return "Open-Meteo rate limit reached (HTTP 429)"
  if (httpCode === 0) return "No response from Open-Meteo"
  return "Open-Meteo returned HTTP " + httpCode
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

// The same colour as channels, so the per-pixel field can be composited
// without re-parsing the string for every pixel.
var CLOUD_RGB = { r: 0x9a, g: 0xa0, b: 0xa6 }

// How sharply opacity climbs with cover. Above 1 the low and middle of the
// range are held back, which is what makes the map read like the sky: a third
// of the sky covered is thin haze, not a third-grey wash over everything. A
// straight linear ramp painted broken cloud far heavier than it looks.
var CLOUD_OPACITY_GAMMA = 3.0

// Opacity for a cloud cover percentage. 0% is fully transparent, so the
// basemap underneath is untouched, and 100% is fully opaque — overcast hides
// the ground, which is why the Chisinau marker is drawn above this layer.
// Monotonic throughout, as R3 requires; the curve between the ends is a
// presentation choice, not part of the contract.
function cloudOpacity(percent) {
  if (typeof percent !== "number" || !isFinite(percent)) return 0
  if (percent <= 0) return 0
  if (percent >= 100) return 1
  return Math.pow(percent / 100, CLOUD_OPACITY_GAMMA)
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

// The precipitation overlay's one colour. Blue and nothing else: intensity is
// carried by the band opacity, never by hue, so the layer can never be confused
// with the neutral cloud field beneath it.
var PRECIPITATION_COLOR = "#4a90d9"
var PRECIPITATION_RGB = { r: 0x4a, g: 0x90, b: 0xd9 }

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
  clear: "\ue30d",
  partlyCloudy: "\ue302",
  overcast: "\ue33d",
  precipitating: "\ue318"
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

// ---------------------------------------------------------------------------
// Popup text — cavekit-map-rendering.md R5
// ---------------------------------------------------------------------------

// Required by Open-Meteo's CC BY 4.0 terms and shown in the popup verbatim.
var OPEN_METEO_ATTRIBUTION = "Weather data by Open-Meteo.com"

// The source reports its observation time without a zone suffix when the
// request asks for GMT, so an explicit Z is added before parsing rather than
// letting the runtime guess local time and shift the reading.
function parseDataTime(dataTime) {
  if (typeof dataTime !== "string") return null
  var text = dataTime.replace(/^\s+|\s+$/g, "")
  if (text === "") return null
  if (!/(Z|[+-]\d{2}:?\d{2})$/.test(text)) text += "Z"
  var date = new Date(text)
  return isNaN(date.getTime()) ? null : date
}

// Local wall-clock HH:MM. The observation time is GMT; the user reads their own
// clock, so it is displayed in their zone.
function formatClock(date) {
  var hours = date.getHours()
  var minutes = date.getMinutes()
  return (hours < 10 ? "0" : "") + hours + ":" + (minutes < 10 ? "0" : "") + minutes
}

// "Updated HH:MM" for the displayed model, or an empty string when there is no
// usable observation time to report.
function updatedLabel(dataTime) {
  var date = parseDataTime(dataTime)
  return date ? "Updated " + formatClock(date) : ""
}

// Reads a cache payload back into a grid model, or null when it cannot be
// trusted. A cache that fails any of these checks is treated exactly like no
// cache at all: it is ignored, never reported as a fetch error.
function deserializeCache(rawText) {
  var text = String(rawText === null || rawText === undefined ? "" : rawText)
  if (text.replace(/^\s+|\s+$/g, "") === "") return null

  var payload
  try {
    payload = JSON.parse(text)
  } catch (e) {
    return null
  }

  if (!payload || typeof payload !== "object") return null
  // A payload from a future or older shape is not readable by this code.
  if (payload.version !== CACHE_VERSION) return null

  var model = payload.model
  if (!model || typeof model !== "object") return null
  if (Object.prototype.toString.call(model.cells) !== "[object Array]") return null
  if (model.cells.length !== GRID_CELL_COUNT) return null
  if (model.columns !== GRID_COLUMNS || model.rows !== GRID_ROWS) return null
  if (!model.bounds || model.bounds.minLon !== GRID_BOUNDS.minLon) return null
  if (!model.center) return null

  return model
}

// ---------------------------------------------------------------------------
// Status transitions — cavekit-weather-data.md R6
//
// A pure reducer over the status snapshot, so every transition a fetch drives
// can be observed from fixtures rather than inferred from QML signals. The
// store in WeatherStatus.qml holds the result; this decides it.
//
// Snapshot shape: { status, lastSuccessAt, lastAttemptAt, lastErrorText }.
// ---------------------------------------------------------------------------

function initialStatusSnapshot() {
  return {
    status: STATUS.loading,
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastErrorText: ""
  }
}

// A fetch is starting. The attempt time advances whatever the outcome turns out
// to be, and the last known success is kept so a failure can still report it.
function statusOnAttemptStart(snapshot, now) {
  return {
    status: STATUS.loading,
    lastSuccessAt: snapshot ? snapshot.lastSuccessAt : null,
    lastAttemptAt: now,
    lastErrorText: snapshot ? snapshot.lastErrorText : ""
  }
}

// The fetch produced a usable model. The error text is cleared: it described a
// failure that has now been superseded.
function statusOnSuccess(snapshot, now) {
  return {
    status: STATUS.ready,
    lastSuccessAt: now,
    lastAttemptAt: snapshot ? snapshot.lastAttemptAt : now,
    lastErrorText: ""
  }
}

// The fetch failed, or produced nothing usable. lastSuccessAt is preserved so
// the popup can still say how old the model on screen is.
function statusOnFailure(snapshot, errorText, now) {
  var text = String(errorText === null || errorText === undefined ? "" : errorText)
  return {
    status: STATUS.error,
    lastSuccessAt: snapshot ? snapshot.lastSuccessAt : null,
    lastAttemptAt: snapshot ? snapshot.lastAttemptAt : now,
    // The error status always carries something a reader can act on.
    lastErrorText: text === "" ? "Refresh failed" : text
  }
}

// ---------------------------------------------------------------------------
// Cloud field interpolation — cavekit-map-rendering.md R3
//
// The 12x9 readings are grid-point samples, not tiles. Drawing them as flat
// rectangles would show the sampling lattice rather than the weather, so the
// field is bilinearly interpolated between the four surrounding grid points.
// ---------------------------------------------------------------------------

function clampIndex(value, limit) {
  if (value < 0) return 0
  if (value > limit) return limit
  return value
}

// Bilinear sample of the cloud field at a fractional position in the map area,
// u and v each running 0..1 from the west and north edges.
//
// Grid points are cell centres, so the sample lattice sits half a cell inside
// each edge; positions outside it clamp to the edge samples rather than
// extrapolating into values the source never reported.
//
// Corners with no reading are dropped and the remaining weights renormalised,
// which is what keeps a cell's unavailable neighbour from bleeding a hole into
// its own numeric value. A sample with no usable corner at all is unavailable.
// Weight shaping for the interpolation.
//
// Plain bilinear across a 1.5-degree lattice reads as a wash: every feature is
// spread evenly over the 110 km between samples. Easing the fractional weights
// concentrates the change in the middle of each span, so a bank of cloud keeps
// a recognisable edge while the field stays perfectly continuous — at the
// midpoint the eased weight is still exactly 0.5, so no boundary appears.
function easeWeight(t) {
  return t * t * (3 - 2 * t)
}

function sampleField(cells, u, v, key) {
  if (!cells || cells.length < GRID_CELL_COUNT) return UNAVAILABLE

  var x = u * GRID_COLUMNS - 0.5
  var y = v * GRID_ROWS - 0.5

  var x0 = Math.floor(x)
  var y0 = Math.floor(y)
  var tx = x - x0
  var ty = y - y0

  var col0 = clampIndex(x0, GRID_COLUMNS - 1)
  var col1 = clampIndex(x0 + 1, GRID_COLUMNS - 1)
  var row0 = clampIndex(y0, GRID_ROWS - 1)
  var row1 = clampIndex(y0 + 1, GRID_ROWS - 1)

  // Clamping collapses the weight on the outside of an edge onto the edge
  // sample itself, so the field stays flat beyond the outermost grid points.
  if (x0 < 0 || x0 >= GRID_COLUMNS - 1) tx = (x0 < 0) ? 1 : 0
  if (y0 < 0 || y0 >= GRID_ROWS - 1) ty = (y0 < 0) ? 1 : 0

  var ex = easeWeight(tx)
  var ey = easeWeight(ty)

  var corners = [
    { value: cells[row0 * GRID_COLUMNS + col0][key], weight: (1 - ex) * (1 - ey) },
    { value: cells[row0 * GRID_COLUMNS + col1][key], weight: ex * (1 - ey) },
    { value: cells[row1 * GRID_COLUMNS + col0][key], weight: (1 - ex) * ey },
    { value: cells[row1 * GRID_COLUMNS + col1][key], weight: ex * ey }
  ]

  var total = 0
  var sum = 0
  for (var i = 0; i < corners.length; i++) {
    var corner = corners[i]
    if (typeof corner.value !== "number") continue
    if (corner.weight <= 0) continue
    sum += corner.value * corner.weight
    total += corner.weight
  }

  if (total <= 0) return UNAVAILABLE
  return sum / total
}

function sampleCloudField(cells, u, v) {
  return sampleField(cells, u, v, "cloudCoverPercent")
}

// Precipitation is interpolated as a millimetre amount and only then banded, so
// band edges follow the shape of the data instead of the sampling lattice.
function samplePrecipitationField(cells, u, v) {
  return sampleField(cells, u, v, "precipitationMm")
}





// ---------------------------------------------------------------------------
// Load-time refresh decision — cavekit-weather-data.md R4
//
// What to do the moment the widget comes up, given whatever the cache had. The
// point is that a restart inside one interval does not spend a request: the
// cached model is already current enough, and the next fetch is due at the
// cached fetch time plus one interval, not one interval from now.
// ---------------------------------------------------------------------------

// Age of a model in milliseconds, or null when it cannot be dated.
function modelAgeMs(model, now) {
  if (!model) return null
  var fetchedAt = parseDataTime(model.fetchedAt)
  if (!fetchedAt) return null
  var age = now.getTime() - fetchedAt.getTime()
  // A fetch time in the future means a clock change, not a fresh model; treat
  // it as unknown rather than trusting it.
  return age < 0 ? null : age
}

// { fetchNow, nextFetchDelayMs }. nextFetchDelayMs is when the repeating
// schedule should next fire, measured from now.
function loadTimeDecision(model, now, intervalMs) {
  var age = modelAgeMs(model, now)

  // Nothing usable on disk: fetch immediately.
  if (age === null) return { fetchNow: true, nextFetchDelayMs: intervalMs }

  // Fresh: younger than one interval. Leave the network alone and let the
  // schedule pick up where the cached fetch left off.
  if (age < intervalMs) {
    return { fetchNow: false, nextFetchDelayMs: intervalMs - age }
  }

  // Older than an interval: the cached model is still shown, but it is due a
  // refresh now.
  return { fetchNow: true, nextFetchDelayMs: intervalMs }
}

// ---------------------------------------------------------------------------
// Retry policy — cavekit-weather-data.md R4
//
// A failed refresh is retried a fixed number of times and then gives up until
// the next scheduled interval. Both numbers are constants, not user settings:
// the point is a bounded amount of noise after a failure, not a knob.
// Documented in docs/data.md.
// ---------------------------------------------------------------------------

// Retries after the initial attempt, so a failing cycle makes at most
// 1 + FETCH_RETRY_LIMIT attempts before waiting for the next interval.
var FETCH_RETRY_LIMIT = 2
var FETCH_RETRY_DELAY_MS = 30 * 1000

// Given how many attempts in this cycle have already failed, whether to try
// again and how long to wait first.
function retryDecision(failedAttempts) {
  var failed = (typeof failedAttempts === "number" && isFinite(failedAttempts)) ? failedAttempts : 0
  if (failed >= 1 + FETCH_RETRY_LIMIT) return { retry: false, delayMs: 0 }
  return { retry: true, delayMs: FETCH_RETRY_DELAY_MS }
}

// ---------------------------------------------------------------------------
// Staleness — cavekit-weather-data.md R5, R6
//
// A model goes stale by the passage of time rather than by any event, so it has
// to be re-evaluated on a tick as well as after a fetch.
// ---------------------------------------------------------------------------

// A model is stale once it is older than this many refresh intervals.
var STALE_INTERVAL_MULTIPLIER = 2

function staleAfterMs(intervalMs) {
  return intervalMs * STALE_INTERVAL_MULTIPLIER
}

// An undatable model is not called stale: nothing is known about its age, and
// claiming staleness would be as much of an invention as claiming freshness.
function isStale(model, now, intervalMs) {
  var age = modelAgeMs(model, now)
  if (age === null) return false
  return age > staleAfterMs(intervalMs)
}

// ---------------------------------------------------------------------------
// Unavailable cells — cavekit-map-rendering.md R3
//
// A cell with no reading is not drawn on the cloud ramp at all. It gets a
// hatch, in the theme's foreground rather than the cloud grey: a pattern no
// percentage can produce, so "we do not know" can never be mistaken for a
// density. Documented in docs/rendering.md.
// ---------------------------------------------------------------------------

var UNAVAILABLE_HATCH_PERIOD = 8
var UNAVAILABLE_HATCH_WIDTH = 2
var UNAVAILABLE_HATCH_ALPHA = 0.5

// The cell a point belongs to, by nearest grid point. This is what makes the
// treatment cell-shaped: the unavailable cell's own area is hatched while its
// neighbours keep rendering from their own readings.
function nearestCellIndex(u, v) {
  var col = clampIndex(Math.floor(u * GRID_COLUMNS), GRID_COLUMNS - 1)
  var row = clampIndex(Math.floor(v * GRID_ROWS), GRID_ROWS - 1)
  return row * GRID_COLUMNS + col
}

function isUnavailableAt(cells, u, v) {
  if (!cells || cells.length < GRID_CELL_COUNT) return true
  return cells[nearestCellIndex(u, v)].cloudCoverPercent === UNAVAILABLE
}

// A cell with no precipitation reading draws no marking at all, decided the
// same cell-shaped way. Interpolating a neighbour's amount into it would put
// rain on a cell that never reported any.
function isPrecipitationUnavailableAt(cells, u, v) {
  if (!cells || cells.length < GRID_CELL_COUNT) return true
  return cells[nearestCellIndex(u, v)].precipitationMm === UNAVAILABLE
}

// Diagonal stripes. Alternating between a fixed alpha and nothing is a texture,
// not a shade, which is why it cannot collide with any value on the ramp.
function hatchAlphaAt(x, y) {
  var phase = (x + y) % UNAVAILABLE_HATCH_PERIOD
  return phase < UNAVAILABLE_HATCH_WIDTH ? UNAVAILABLE_HATCH_ALPHA : 0
}

// ---------------------------------------------------------------------------
// Bar appearance by status — cavekit-map-rendering.md R7
//
// The glyph reports the weather; the appearance reports how much to trust it.
// Documented in docs/rendering.md.
// ---------------------------------------------------------------------------

// The weather "n/a" glyph. Verified present in the JetBrainsMono Nerd Font
// Omarchy ships, like the four condition glyphs.
var BAR_UNKNOWN_GLYPH = "\ue374"

var BAR_READY_OPACITY = 1.0
var BAR_STALE_OPACITY = 0.6
var BAR_ERROR_OPACITY = 0.4

// { glyph, opacity } for the bar entry.
//
// The glyph answers "what is the weather"; the opacity answers "how much should
// you trust it". Those are separate questions, so a failed refresh dims the
// glyph rather than replacing it: while a usable reading is on screen the bar
// keeps reporting it, exactly as the popup keeps showing the map beneath the
// error indicator.
//
// The unknown glyph is reserved for the one case where the first question has
// no answer — no usable centre reading — so unknown data is never shown as
// clear weather, and the bar never claims ignorance while displaying a map.
function barAppearance(center, status) {
  var condition = barCondition(center)
  if (!condition) return { glyph: BAR_UNKNOWN_GLYPH, opacity: BAR_ERROR_OPACITY }

  if (status === STATUS.error) {
    return { glyph: BAR_GLYPHS[condition], opacity: BAR_ERROR_OPACITY }
  }
  if (status === STATUS.stale) {
    return { glyph: BAR_GLYPHS[condition], opacity: BAR_STALE_OPACITY }
  }
  return { glyph: BAR_GLYPHS[condition], opacity: BAR_READY_OPACITY }
}

// ---------------------------------------------------------------------------
// Popup status presentation — cavekit-map-rendering.md R5
//
// Each status gets its own presentation, and none of them hides the map: a
// stale or failed refresh still leaves the last good map on screen, with the
// indicator explaining how much to trust it. Documented in docs/rendering.md.
// ---------------------------------------------------------------------------

var STATUS_PRESENTATIONS = {
  loading: { label: "Updating…", showIndicator: true, showErrorText: false },
  // Ready says nothing: an indicator for the normal case would be noise, and
  // saying nothing is itself distinct from the other three.
  ready: { label: "", showIndicator: false, showErrorText: false },
  stale: { label: "Out of date", showIndicator: true, showErrorText: false },
  error: { label: "Refresh failed", showIndicator: true, showErrorText: true }
}

function statusPresentation(status) {
  var presentation = STATUS_PRESENTATIONS[status]
  return presentation ? presentation : STATUS_PRESENTATIONS.loading
}

// ---------------------------------------------------------------------------
// Status precedence — cavekit-weather-data.md R6
//
// Age and failure can be true at once: a model can be older than twice the
// interval *and* the last attempt to replace it can have failed. Error wins.
// "We tried and could not" is the more actionable of the two, and it already
// implies the model is not being kept current.
// ---------------------------------------------------------------------------

function resolveStatus(model, now, intervalMs, lastAttemptFailed) {
  if (lastAttemptFailed) return STATUS.error
  if (!model) return STATUS.loading
  return isStale(model, now, intervalMs) ? STATUS.stale : STATUS.ready
}

// ---------------------------------------------------------------------------
// Field rasterisation — cavekit-map-rendering.md R3, R4
//
// The layers draw the field as a grid of small rectangles, each filled from the
// bilinear sample at its centre, the same way Basemap and CenterMarker draw.
// Two earlier approaches failed in the real shell: sampling per device pixel
// was far too slow to land a paint, and createImageData/putImageData rendered
// nothing at all. See context/impl/dead-ends.md.
// ---------------------------------------------------------------------------

// 10x the sampling lattice in each axis, so a rectangle is far smaller than the
// scale on which the field actually varies, and only ~10k fill calls per paint.
var FIELD_RECT_COLUMNS = 120
var FIELD_RECT_ROWS = 90
