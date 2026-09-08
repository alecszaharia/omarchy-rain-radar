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
