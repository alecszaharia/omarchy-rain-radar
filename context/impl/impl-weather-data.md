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
| T-019 | DONE | normalizeCloudCover/normalizePrecipitation; dropped location keeps its slot (no shift); nulls/out-of-range/non-numeric -> UNAVAILABLE, never 0. 8 tests. |
| T-020 | DONE | Model.parseGridModel/nextPublishedModel/statusForParse. 13 garbage inputs + Open-Meteo {error,reason}. Previous model survives failure. 7 tests. |
| T-021 | DONE | WeatherData.qml: one curl per refresh, single-flight guard, FETCH_TIMEOUT_SECONDS=20 via --max-time, exit!=0 -> error. Timeout bound proven live (curl exit 28). 8 tests. |
| T-022 | DONE | Atomic FileView write to $XDG_STATE_HOME/omarchy/cloud-radar/model.json, versioned payload, publish-before-persist, both failure paths logged and non-fatal. 7 tests. |
| T-028 | DONE | Timer interval bound to Model.refreshIntervalMs(setting) -> live setting changes, no restart. triggeredOnStart false. 6 tests. |
| T-029 | DONE | Model.deserializeCache validates version + grid shape; FileView onLoaded restores before network, onLoadFailed silent. Never sets error. 7 tests. |
| T-030 | DONE | Pure status reducer (statusOnAttemptStart/Success/Failure) + WeatherStatus.snapshot/apply. All four transitions observed from fixtures. 9 tests. |
| T-036 | DONE | Model.loadTimeDecision + modelAgeMs; fresh cache spends no request, schedule resumes from fetchedAt+interval. Future timestamps undatable. 9 tests. |
| T-037 | DONE | requestManualRefresh() reuses the one guard; interleaved press/tick/finish simulation shows concurrency never exceeds 1. 6 tests. |
| T-038 | DONE | FETCH_RETRY_LIMIT=2 @30s (max 3 attempts), constants not settings; worst-case burst bounded below the 10-min minimum. docs/data.md. 9 tests. |
| T-039 | DONE | STALE_INTERVAL_MULTIPLIER=2, isStale, re-evaluated on a 30s tick + after fetch/restore. Boundary is fresh; undatable is not stale. 9 tests. |
| T-045 | DONE | Fetch protocol changed to -sS + -w status tail; 429 -> backoff 2x interval, abandons retry burst. Verified live (HTTP 200, 109 entries). 11 tests. |
| T-046 | DONE | Model.resolveStatus centralises error-over-stale precedence; field guarantees asserted directly. 9 tests. |
