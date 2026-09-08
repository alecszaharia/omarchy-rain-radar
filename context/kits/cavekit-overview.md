---
created: "2026-09-04T13:45:07Z"
last_edited: "2026-09-04T13:55:18Z"
---

# Cavekit: Overview

## Project
**Cloud Radar** (`io.github.alecszaharia.cloud-radar`) is an Omarchy 4 bar-widget plugin that sits beside the
built-in Omarchy weather widget. The bar entry is an icon only; activating it opens a popup showing a
hand-drawn cloud-cover map of Eastern Europe centered on Chișinău, Moldova (47.01 N, 28.86 E) with a
precipitation overlay. Data comes from Open-Meteo (non-commercial use, no API key), current conditions only.
The only user setting is the refresh interval (10–120 minutes, default 20). The plugin is distributed as a
public GitHub repository and submitted to the Omarchy plugin catalog.

Source of truth for scope: `context/refs/approved-design-cloud-radar.md` (approved 2026-09-04).

## Domain Index

| Domain | Cavekit File | Requirements | Status | Description |
| --- | --- | --- | --- | --- |
| Weather Data | cavekit-weather-data.md | 6 (R1–R6) | DRAFT | Sampling grid, single Open-Meteo fetch, grid-model normalization, refresh scheduling, on-disk cache and the observable status. Owns the data → rendering interface contract. |
| Map Rendering | cavekit-map-rendering.md | 8 (R1–R8) | DRAFT | Projection, bundled basemap outlines and Chișinău marker, cloud heatmap, precipitation overlay, legend/status/attribution, popup chrome and bar icon. |
| Plugin Packaging | cavekit-plugin-packaging.md | 6 (R1–R6) | DRAFT | Manifest and single settings entry, validator and linter cleanliness, install and bar placement, lifecycle hygiene, docs and catalog artifacts, dependency budget. |

## Cross-Reference Map

| Domain A | Interacts With | Interaction Type |
| --- | --- | --- |
| Weather Data | Map Rendering | Provides the grid model (weather-data R3) and status enum (weather-data R6) as the sole interface contract. |
| Map Rendering | Weather Data | Consumes the grid model and status; triggers a manual refresh from the popup refresh control (weather-data R4). |
| Plugin Packaging | Weather Data | Declares the `refreshMinutes` setting (packaging R1) that drives refresh scheduling (weather-data R4). |
| Plugin Packaging | Map Rendering | Declares the bar-widget entry point and default bar section hosting the bar icon and popup; carries the outline-data attribution (packaging R5 ↔ rendering R2). |
| Map Rendering | Plugin Packaging | Supplies the surfaces validated and documented by packaging; its attribution text appears in the README. |
| Weather Data | Plugin Packaging | Reads the packaging-declared setting; its Open-Meteo attribution requirement appears in the README. |

## Dependency Graph

```
Plugin Packaging
  |  declares refreshMinutes setting            declares bar-widget entry point
  v                                                          v
Weather Data  ---- grid model (R3) + status (R6) ---->  Map Rendering
      ^                                                      |
      +-------------- manual refresh (R4) -------------------+
```

- Plugin Packaging has no dependency on the other domains' internals; it declares the setting key and the
  entry point they rely on.
- Weather Data depends only on the packaging-declared setting value.
- Map Rendering depends on Weather Data's published contract and on the packaging-declared entry point.
- No circular dependency exists: the manual-refresh edge is a runtime invocation of Weather Data R4, not a
  design-time dependency of Weather Data on Map Rendering.

## Coverage Summary

| Cavekit | Requirements | Acceptance Criteria |
| --- | --- | --- |
| cavekit-weather-data.md | 6 | 49 |
| cavekit-map-rendering.md | 8 | 65 |
| cavekit-plugin-packaging.md | 6 | 39 |
| **Total** | **20** | **153** |

Four acceptance criteria are flagged `(human review)` — all in cavekit-map-rendering.md R2, R3 and R4 —
covering theme legibility, Moldova's distinguishability at popup size, heatmap smoothness, and precipitation
band distinctness. Every other criterion is intended to be checkable by an automated agent.

## Project-Wide Out of Scope
Forecast timeline or animation; hover readout; configurable center or extent; low/mid/high cloud layers;
distinguishing rain from snow; city labels; network map tiles; any location other than Chișinău;
notifications.

## Changelog
- 2026-09-04: Initial draft index for the three approved domains.
- 2026-09-04: Reviewer passes 1–2 applied to domain kits; criteria counts refreshed.
- 2026-09-08: Map Rendering gains R8 (zoom) at the user's request; counts refreshed.
