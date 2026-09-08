---
created: "2026-09-04T13:45:07Z"
last_edited: "2026-09-04T13:55:18Z"
complexity: medium
---

# Cavekit: Weather Data

## Scope
Everything between the Open-Meteo data source and a ready-to-draw grid model for Cloud Radar
(`io.github.alecszaharia.cloud-radar`): the fixed sampling grid over Eastern Europe centered on Chișinău
(47.01 N, 28.86 E), a single current-conditions fetch per refresh, normalization into a grid model, refresh
scheduling driven by the `refreshMinutes` setting, an on-disk cache of the last successful result, and one
observable status.

This kit owns the **Weather Data → Map Rendering interface contract**: the grid model fields (R3) and the
status enum (R6). Map Rendering consumes that contract and nothing else from this domain.

Reference material: `context/refs/open-meteo-api-notes.md` (background only; not a requirement).

## Requirements

### R1: Fixed sampling grid
**Description:** The area sampled is a fixed geographic grid over Eastern Europe centered on Chișinău. It is
12 columns by 9 rows across bounds of lon 19.86–37.86 and lat 41.0–53.0, plus one additional sample at the
exact center coordinate, for 109 points total. Grid points follow the cell-centre convention: the bounds are
divided into 12 equal-width columns (1.5° of longitude each) and 9 equal-height rows (12.0/9 ≈ 1.3333° of latitude
each), and each grid point is the centre of its cell. No grid point lies on the bounds. The grid bounds, column count, row count, point
spacing and center coordinate are published constants that consumers (including Map Rendering) can read; they
are not recomputed or configurable by the user.
**Acceptance Criteria:**
- [ ] The generated point set contains exactly 109 points.
- [ ] The point set contains exactly 108 grid points arranged as 12 columns by 9 rows.
- [ ] The point set contains a point at exactly 47.01 N, 28.86 E (the center sample).
- [ ] All grid points lie strictly inside the bounds lon 19.86–37.86, lat 41.0–53.0.
- [ ] Grid points are cell centres: column centres run from lon 20.61 to lon 37.11 in steps of 1.5°, and row
      centres run from lat 41.667 to lat 52.333 in steps of 12.0/9 ≈ 1.3333° (tolerance 0.001°).
- [ ] Every grid point is the centre of exactly one cell, and the 108 cells tile the bounds with no gaps or
      overlaps.
- [ ] Point order is deterministic: two generations from the same constants produce the same sequence of
      coordinates in the same order.
- [ ] Grid bounds, column count, row count, spacing and center coordinate are readable by a consumer without
      triggering a fetch.
**Dependencies:** none

### R2: Single fetch per refresh
**Description:** One refresh performs exactly one outbound request to Open-Meteo covering all sampling points,
requesting only current total cloud cover and current precipitation, with no API key, and bounded by a fixed timeout constant that is not a user setting.
**Acceptance Criteria:**
- [ ] A single refresh cycle issues exactly one outbound data request.
- [ ] That request carries all 109 sampling points from R1.
- [ ] The requested measurements are limited to current total cloud cover and current precipitation (no
      forecast series, no low/mid/high cloud layers).
- [ ] The request carries no API key or other credential.
- [ ] A request that exceeds the fixed timeout terminates within a bounded time and produces the `error`
      status (R6) rather than hanging indefinitely.
**Dependencies:** R1

### R3: Normalization into the grid model (interface contract)
**Description:** A successful response is normalized into a grid model, which is the sole data structure
handed to Map Rendering. The model has these fields:
- `bounds` — `{ minLon, maxLon, minLat, maxLat }`, equal to the R1 constants.
- `columns` — 12. `rows` — 9.
- `cells[]` — one entry per grid point, in R1 order, each `{ lat, lon, cloudCoverPercent, precipitationMm }`.
- `center` — `{ cloudCoverPercent, precipitationMm }` for the exact center sample.
- `dataTime` — the observation time reported by the source.
- `fetchedAt` — the time the successful fetch completed locally.

`cloudCoverPercent` is a number 0–100 or the distinct value "unavailable". `precipitationMm` is a number
greater than or equal to 0 or "unavailable". A missing location, a null measurement, or an out-of-range value
is represented as "unavailable" and never as 0. A response that cannot be parsed produces no model at all.
**Acceptance Criteria:**
- [ ] A complete fixture produces a model with 108 grid cells plus the center sample, `columns` 12, `rows` 9,
      and `bounds` equal to the R1 constants.
- [ ] Cell coordinates in the model match the R1 grid point coordinates and their order.
- [ ] A fixture with one location dropped from the response produces a model in which the corresponding cell's
      measurements are "unavailable" and every other cell holds its numeric value.
- [ ] A fixture with a null cloud cover value produces "unavailable" for that measurement, not 0.
- [ ] A fixture with a null precipitation value produces "unavailable" for that measurement, not 0.
- [ ] A fixture with an out-of-range cloud cover value (below 0 or above 100) produces "unavailable" for that
      measurement.
- [ ] A garbage/unparseable fixture produces no new model, leaves any previously published model unchanged,
      and results in the `error` status (R6).
- [ ] `dataTime` is taken from the source response and `fetchedAt` is the local completion time of the fetch.
**Dependencies:** R2; consumed by cavekit-map-rendering.md R1, R3, R4, R5, R7

### R4: Refresh scheduling
**Description:** Data refreshes on load and then on a repeating interval taken from the `refreshMinutes`
setting (integer, 10–120 minutes, default 20). A manual refresh is available. Failures retry a bounded number
of times and then wait for the next scheduled interval. Two fetches are never in flight at once. A rate-limit
rejection (HTTP 429) backs off to at least twice the configured interval.
**Acceptance Criteria:**
- [ ] With no fresh cached model present, a fetch starts on load.
- [ ] For load purposes a cached model is fresh when its `fetchedAt` is younger than one configured interval.
      With a fresh cached model present, no fetch starts on load and the next fetch occurs at
      `fetchedAt` + interval (measured from the cached fetch time, not from load time).
- [ ] With a cached model older than one interval but not yet stale (per R5), the cached model is presented and
      a fetch starts on load.
- [ ] The scheduled interval equals the `refreshMinutes` setting value; changing the setting changes the next
      scheduled fetch time without a restart.
- [ ] A setting value below 10 is clamped to 10 and a value above 120 is clamped to 120; the effective
      interval is the clamped value.
- [ ] A missing or non-numeric setting value results in the default effective interval of 20 minutes.
- [ ] With no setting present, the effective interval is 20 minutes.
- [ ] A manual refresh request starts a fetch when none is in flight.
- [ ] Two manual refresh requests issued while one fetch is in flight result in exactly one outbound request.
- [ ] At no observed point are two fetches in flight simultaneously.
- [ ] After a failed fetch, retries are attempted a fixed, documented number of times (a constant, not a user setting); after the last retry
      no further attempt occurs before the next scheduled interval.
- [ ] After a rate-limit rejection (HTTP 429), the next attempt occurs no earlier than twice the configured
      interval, and this backoff is observable to a test.
**Dependencies:** R2; the `refreshMinutes` setting supplied by cavekit-plugin-packaging.md R1; consumed by cavekit-map-rendering.md R6 (manual refresh)

### R5: Persistent cache
**Description:** The last successful grid model is persisted under the user's state directory and reloaded at
startup so a map is shown before any network result. Cached data is marked stale once it is older than twice
the configured refresh interval. Cache write failures are logged and non-fatal; a corrupt or unreadable cache
is ignored.
**Acceptance Criteria:**
- [ ] After a successful fetch, a grid model equivalent to the published one is present in the user's state
      directory.
- [ ] On startup with a cache present, the cached grid model is published to consumers before any network
      result arrives.
- [ ] A restored model retains its original `dataTime` and `fetchedAt` values from when it was fetched.
- [ ] A restored model whose `fetchedAt` is older than twice the configured refresh interval yields the
      `stale` status (R6); a newer one does not.
- [ ] A cache write failure produces a log entry and does not change the published model or prevent the next
      scheduled refresh.
- [ ] A corrupt or unreadable cache file is ignored: startup proceeds as if no cache existed and no `error`
      status is produced by the cache read alone.
**Dependencies:** R3, R4

### R6: Observable status (interface contract)
**Description:** Exactly one current status is exposed to consumers, drawn from the enum
`{ loading, ready, stale, error }`, together with `lastSuccessAt`, `lastAttemptAt` and `lastErrorText`.
Map Rendering consumes this status to choose its presentation.
**Acceptance Criteria:**
- [ ] At any instant, exactly one status value is current and it is one of `loading`, `ready`, `stale`,
      `error`.
- [ ] From fixtures, the transition to `loading` on a starting fetch is observed.
- [ ] From fixtures, the transition `loading → ready` on a successful fetch is observed.
- [ ] From fixtures, the transition to `stale` when the published model exceeds twice the refresh interval in
      age is observed.
- [ ] From fixtures, the transition to `error` on a failed or unparseable fetch is observed.
- [ ] `error` takes precedence over `stale`: while the most recent attempt has failed, the status is `error`
      even if the published model is also older than twice the refresh interval.
- [ ] From fixtures, the transition `error → ready` after a subsequent successful fetch is observed.
- [ ] In `error`, `lastErrorText` is non-empty; in `ready` and `stale`, `lastSuccessAt` is set.
- [ ] `lastAttemptAt` updates on every fetch attempt regardless of outcome.
- [ ] Consumers receive a change notification whenever the status value changes.
**Dependencies:** R2, R3, R4, R5; consumed by cavekit-map-rendering.md R5, R7

## Out of Scope
- Any drawing, projection, colour mapping, popup or bar presentation (see cavekit-map-rendering.md).
- The plugin manifest, settings schema declaration, packaging and distribution (see
  cavekit-plugin-packaging.md); this kit only reads the `refreshMinutes` value.
- Forecast timeline or animation data; only current conditions are fetched.
- Low, mid and high cloud layers; only total cloud cover is fetched.
- Distinguishing rain from snow; only a single precipitation amount is modelled.
- Configurable center, extent or any location other than Chișinău.
- Hover readout data, per-point queries, and city/place name lookup.
- Network map tiles or any basemap data source.
- Notifications or any alerting on weather values.

## Cross-References
- See also: cavekit-map-rendering.md — consumes the grid model (R3) and status (R6) defined here.
- See also: cavekit-plugin-packaging.md — declares the `refreshMinutes` setting consumed by R4.

## Changelog
- 2026-09-04: Initial draft from the approved design (context/refs/approved-design-cloud-radar.md).
- 2026-09-04: Reviewer pass 1 — clarified grid cell-centre convention, setting clamping, cache-fresh scheduling, fixed timeout/retry constants, unavailable-data handling.
- 2026-09-04: Reviewer pass 2 (advisory) — lat step written exactly, error-over-stale precedence, R4 consumed-by link to rendering R6.
