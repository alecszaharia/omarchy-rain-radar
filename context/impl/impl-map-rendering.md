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
