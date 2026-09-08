---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T06:55:00Z"
---
# Implementation Tracking: weather-data

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-002 | DONE | Model.js grid constants: GRID_BOUNDS/COLUMNS/ROWS/LON_STEP/LAT_STEP/CENTER. Steps derived from bounds. 4 tests. |
| T-003 | DONE | Model.STATUS + STATUS_VALUES + isStatus(); WeatherStatus.qml QtObject, set() guards through isStatus. 6 tests. |
| T-006 | DONE | Model.gridPoints(): 108 cell centres row-major from NW + exact center at index 108 (GRID_CENTER_INDEX). Deterministic. 7 tests. |
| T-010 | DONE | Exhaustive tiling/containment suite: strict-inside bounds, exact cell centring, one point per cell, area+edge partition, centre never collides. 5 tests. |
| T-011 | DONE | Model.buildGridModel + UNAVAILABLE + responseLocations/responseDataTime. Positional mapping; ignores source-echoed snapped coords. tests/fixtures/make.mjs. 8 tests. |
| T-012 | DONE | Model.requestUrl(): 109 points, current=cloud_cover,precipitation, no key, 1448 chars. Verified live against Open-Meteo. 5 tests. |
| T-013 | DONE | effectiveRefreshMinutes/refreshIntervalMs: clamp 10-120, default 20, rejects booleans and "15min". Bounds pinned to manifest schema. 8 tests. |
