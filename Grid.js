// Fixed sampling grid over Eastern Europe centred on Chișinău.
// cavekit-weather-data.md R1 — published constants that consumers (including
// Map Rendering) read directly; they are never recomputed downstream and are
// not user-configurable.
//
// Plain top-level declarations, no `.pragma library` and no module system, so
// the file imports into QML as a JS resource and still loads under node for
// unit tests (see tests/qml-js.mjs). Top-level `var` is deliberate: `const`
// bindings would not be visible as context properties to the test loader.

// Geographic extent of the sampled area.
var BOUNDS = Object.freeze({
  minLon: 19.86,
  maxLon: 37.86,
  minLat: 41.0,
  maxLat: 53.0
});

// Cell grid laid over BOUNDS.
var COLUMNS = 12;
var ROWS = 9;

// Cell size, derived from BOUNDS so the extent stays the single source of
// truth: 18.0/12 = 1.5° of longitude, 12.0/9 ≈ 1.3333° of latitude.
var SPACING = Object.freeze({
  lon: (BOUNDS.maxLon - BOUNDS.minLon) / COLUMNS,
  lat: (BOUNDS.maxLat - BOUNDS.minLat) / ROWS
});

// The exact centre coordinate, sampled in addition to the cell centres.
var CENTER = Object.freeze({
  lat: 47.01,
  lon: 28.86
});
