---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T06:55:00Z"
---
# Implementation Tracking: map-rendering

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-007 | DONE | Model.projectPoint/projectLonFraction/projectLatFraction/projectionScale + MAP_ASPECT=1.5. Linear, corners-to-corners, no differential stretch. 6 tests. |
| T-008 | DONE | data/outlines.json — 10 regions, 1364 vertices, 20 KB, from Natural Earth 50m (public domain). Moldova flagged emphasis, finer tolerance. tools/build-outlines.py regenerates. 6 tests. |
| T-009 | DONE | Panel.qml (Panel base, KeyboardPanel + PanelKeyCatcher, manageIpc false) loaded by BarWidget.qml Loader; bar press -> toggle; Escape -> close. 5 tests. |
| T-014 | DONE | Model.cellRects(w,h): 108 rects tiling exactly, points at rect centres, re-derived per call. Verified at 5 sizes. 4 tests. |
| T-015 | DONE | Basemap.qml Canvas + Model.basemapStyle emphasis rule (Moldova 2x width, opacity 1.0 vs 0.45; water filled 0.18). Data moved to data/Outlines.js QML resource. 8 tests. |
| T-016 | DONE | BarWidget exposes opened/open/close/popoutSwitchClosing/closeForPopoutSwitch per Bar.findPanelWidget contract; asserted against shell Bar.qml. 5 tests. |
| T-017 | DONE | Model.POPUP_CONTENT_WIDTH=480, read back from shell weather Panel.qml in test. Both dims via fittedContentWidth/Height. docs/rendering.md. 5 tests. |
| T-018 | DONE | Panel foregroundColor/themeFontFamily lifted off bar; tests reject per-Text colours/fonts and any hex literal in QML. 5 tests. |
| T-023 | DONE | CenterMarker.qml (extracted in T-024): dot+ring at projected centre, above all layers, no text anywhere in map layers. 7 tests. |
| T-024 | DONE | CloudLayer.qml + Model.cloudOpacity/CLOUD_COLOR (#9aa0a6). 0%=transparent, 100%=opaque, monotonic, hue fixed outside loop. Layer order documented. 9 tests. |
| T-025 | DONE | Model.PRECIPITATION_BANDS half-open [0,0.1)(0.1,2.5)(2.5,7.6)[7.6,inf) + precipitationBand(). Total, gapless. Harness plain() fixed to structuredClone. 9 tests. |
| T-026 | DONE | Model.barCondition/barGlyph/BAR_GLYPHS. Precip wins, then cloud [0,25)(25,75)[75,100]. Swept exhaustively. Unavailable cloud -> null. 9 tests. |
| T-027 | DONE | Model.updatedLabel/parseDataTime/formatClock + OPEN_METEO_ATTRIBUTION. GMT parsed explicitly, rendered in reader's zone. 5 tests. |
| T-031 | DONE | Model.sampleField/sampleCloudField bilinear; CloudLayer per-pixel putImageData. Edge-flat, weight renormalisation on unavailable corners. 9 tests. |
| T-032 | DONE | PrecipitationLayer above cloud, blue-only (#4a90d9), interpolate-then-band. 8 tests. |
| T-033 | DONE | Cloud gradient legend (0%/100%) + Repeater over PRECIPITATION_BANDS with thresholds; none band outlined. 8 tests. |
| T-034 | DONE | BarIconButton text = Model.barGlyph(center); WeatherData owned by BarWidget, service injected into Panel for live bindings. 7 tests. |
| T-035 | PENDING-HUMAN | Cannot be verified by an agent. Needs the plugin running in a real shell on a light and a dark theme, judging outline/marker legibility and whether Moldova reads as distinct. Prepare at T-051/T-057. |
| T-040 | DONE | Hatch (foreground colour, 8px period, alpha 0.5) for cells with no cloud reading; nearest-cell region; neighbours keep own values. 8 tests. |
| T-041 | DONE | Model.barAppearance: ready 1.0 / stale 0.6 / error+unknown U+E374 @0.4. Glyph coverage verified against the shipped Nerd Font. 9 tests. |
| T-042 | DONE | Model.STATUS_PRESENTATIONS, four distinct; map never hidden (asserted structurally). 9 tests. |
| T-043 | PENDING-HUMAN | Cloud field smoothness at popup size. Needs the running plugin. |
| T-044 | PENDING-HUMAN | Precipitation band distinctness at popup size. Needs the running plugin. |
| T-047 | DONE | Rain/snow parity structural (no breakdown requested or modelled); unavailable precip skipped before interpolation. 7 tests. |
| T-048 | DONE | Themed refresh button -> requestManualRefresh; popup has no path to the process. 6 tests. |
| T-061 | DONE | R8 zoom. Model.viewportFor/clampZoom/viewToGridU/V; all four layers project and sample through the viewport; PillButton component drives Refresh and both zoom controls; WheelHandler on the map. Removed cellRects/projectionScale/gridPointFraction from Model.js (test-only, now in tests/geo.mjs). 14 tests. |
