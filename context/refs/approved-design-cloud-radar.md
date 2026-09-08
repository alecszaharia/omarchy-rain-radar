# Approved design — Cloud Radar (Omarchy 4 bar-widget plugin)
Approved by user on 2026-09-04 via /ck:sketch interview.

## Product summary
An Omarchy 4 bar-widget plugin, id `io.github.alecszaharia.cloud-radar`, name "Cloud Radar", meant to sit beside the
built-in Omarchy weather widget. Bar entry is an icon only. Clicking opens a popup with a hand-drawn cloud-cover map
of Eastern Europe centered on Chișinău, Moldova (47.01 N, 28.86 E), with a precipitation overlay. Data from
Open-Meteo (non-commercial, no API key). Current conditions only (no timeline/animation). Distributed as a public
GitHub repo and submitted to the Omarchy plugin catalog.

## User decisions (interview)
- Placement: bar icon + popup map. Bar shows icon ONLY (no percentage, no thumbnail).
- Time: current conditions only.
- Basemap: embedded simplified country outlines (Moldova emphasized) + Chișinău marker. No city labels. No network tiles.
- Center: fixed on Chișinău. Extent: fixed Eastern Europe (no extent setting).
- Grid: coarse, 12 columns x 9 rows (~±9° lon, ~±6° lat) + 1 exact center sample = 109 points.
- Refresh: setting 10–120 minutes, DEFAULT 20 (user chose 20 to stay inside Open-Meteo's nominal free quota).
- Layers: total cloud cover + precipitation overlay (blue intensity, rain and snow NOT distinguished, 4 bands:
  none/light/moderate/heavy).
- Interaction: view only + refresh button. No hover readout, no click-through to the weather panel.
- Failure: keep last map from an on-disk cache, mark stale, retry next interval.
- Distribution: public GitHub repo + catalog submission.
- Only setting exposed: refresh interval.

## Domain 1: Weather Data
Scope: everything between Open-Meteo and a ready-to-draw grid model. No drawing, no manifest.
R1 Sampling grid: fixed 12x9 grid over bounds centered on Chișinău (approx lon 19.86–37.86, lat 41.0–53.0) plus one
   sample at the exact center; deterministic point order; bounds/spacing are constants the renderer can read.
   AC: 109 points; center included; constants exposed.
R2 Single fetch: one request per refresh for all points; only current total cloud cover and current precipitation;
   bounded timeout; no API key. AC: exactly one request per refresh; all 109 points in it; timeout → failure not hang.
R3 Normalization: response → grid model {bounds, columns, rows, cells[{lat, lon, cloudCoverPercent, precipitationMm}],
   center{cloudCoverPercent, precipitationMm}, dataTime, fetchedAt}. Missing/malformed values → "unavailable", never 0.
   AC: fixtures with a dropped location, a null value, and garbage JSON each produce the documented result.
R4 Refresh scheduling: fetch on load unless fresh cache exists; then every N minutes (setting 10–120, default 20);
   manual refresh; bounded retries then wait for next interval; never two fetches in flight; HTTP 429 → backoff to at
   least 2x interval. AC: timer respects setting; back-to-back manual refreshes coalesce; 429 backoff observable.
R5 Persistent cache: last successful grid model written under the user's state directory, loaded at startup; stale
   when older than 2x refresh interval; write failure logged, non-fatal; corrupt cache ignored.
   AC: restart shows cached map with original timestamp; corrupt file ignored.
R6 Status: one observable state ∈ {loading, ready, stale, error} with timestamps and last error text, consumed by
   rendering. AC: every transition reachable from fixtures.

## Domain 2: Map Rendering
Scope: popup + bar icon given a grid model. No fetching.
R1 Projection: equirectangular mapping of fixed bounds into the map area, aspect preserved, each cell → rectangle.
   AC: four corners map to four corners; Chișinău at center.
R2 Basemap: bundled simplified outlines (Moldova, Romania, Ukraine, Bulgaria, Hungary, Slovakia, Poland, Belarus,
   Serbia, Black Sea coast) under data; Moldova emphasized; Chișinău marker. Outline data license must permit
   redistribution and be credited. AC: visible on light and dark themes; Moldova distinguishable at popup size.
R3 Cloud heatmap: cloud % → opacity of a neutral cloud colour, interpolated between grid points (smooth, not blocky);
   unavailable cells drawn distinctly. AC: 0% transparent, 100% opaque; fixture with an unavailable cell shows it.
R4 Precipitation overlay: above clouds, blue, intensity in 4 documented bands (none/light/moderate/heavy), rain and
   snow not distinguished. AC: thresholds documented; each band visually distinct.
R5 Legend/timestamp/status: legend for both scales; "Updated HH:MM"; visible stale/error indicator; attribution
   "Weather data by Open-Meteo.com". AC: each Domain-1 status has a distinct presentation.
R6 Popup chrome: opens/closes from the bar entry; Escape closes; fits within free screen area; width comparable to
   the built-in weather popup; refresh button; uses the bar's colours and font.
   AC: open/close/toggle/Escape work; shell summon/hide commands work.
R7 Bar icon: icon only; glyph reflects center condition (clear / partly cloudy / overcast / precipitating) with a
   distinct look when stale or in error. AC: each state maps to a documented glyph.

## Domain 3: Plugin Packaging
Scope: what makes it an installable Omarchy plugin.
R1 Manifest: id io.github.alecszaharia.cloud-radar, name "Cloud Radar", kind bar-widget, category "Info" (same as the built-in weather widget), single
   instance, default section "center" (matches where the built-in weather widget lands when enabled), settings schema exposing ONLY refresh interval
   (integer, 10–120, default 20).
R2 Validation: passes the Omarchy plugin validator and the QML linter with no errors; no symlinks.
R3 Install & placement: installable from the public repo with the standard plugin-add command; enables cleanly;
   README documents placing it next to the weather widget.
R4 Lifecycle: enable/disable/remove/shell restart leave no orphan processes and no shell-log errors; never starts a
   second shell instance.
R5 Docs & catalog: README (install, placement, settings, screenshots, attribution for Open-Meteo and outline data),
   LICENSE, preview image, catalog publishing metadata.
R6 Dependencies: only tools already shipped with Omarchy.

## Cross-references
Weather Data → Map Rendering: the grid model + status (interface contract).
Plugin Packaging → Weather Data: the refresh-interval setting key. Packaging → Rendering: bar-widget entry point.

## Out of scope (whole project)
Forecast timeline / animation; hover readout; configurable center or extent; low/mid/high cloud layers; rain/snow
distinction; city labels; network map tiles; any location other than Chișinău; notifications.
