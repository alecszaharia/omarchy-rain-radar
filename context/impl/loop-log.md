---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T06:55:00Z"
---
# Loop Log

Build site: context/plans/build-site.md

### Wave 1 — Tier 0 — 2026-09-08
- T-001: manifest + BarWidget entry — DONE. Files: manifest.json, BarWidget.qml, scripts/check.sh, tests/qml-js.mjs, tests/manifest.test.mjs. Validate P, qmllint P, Tests P (7/7). Acceptance 6/6.
- T-002: grid constants — DONE. Files: Model.js, tests/grid-constants.test.mjs. Tests P (11/11). Acceptance 1/1.
- T-003: status enum + store — DONE. Files: Model.js, WeatherStatus.qml, tests/status.test.mjs. Tests P (17/17). Acceptance 2/2.
- Dead end: qmltestrunner unusable here (silent exit 1). Test strategy = pure logic in Model.js under node; QML thin, qmllint + structural assertions + live shell check at tier 8.
- Tier 0 gate: SKIPPED. codex binary present but unauthenticated (401 on api.openai.com). Cavekit codex-review.sh also targets a pre-0.x CLI (`--approval-mode` rejected by codex-cli 0.152.0). Gate stays skipped until `codex login`.
- Next: T-004, T-005, T-006, T-007, T-008, T-009 (tier 1).

### Wave 2 — Tier 1 — 2026-09-08
- T-004: refreshMinutes schema — DONE. manifest.json, tests/settings-schema.test.mjs. Gate P. Acceptance 3/3.
- T-005: MIT LICENSE — DONE. LICENSE, tests/license.test.mjs. Gate P. Acceptance 1/1.
- T-006: grid point generator — DONE. Model.js, tests/grid-points.test.mjs. Gate P. Acceptance 5/5.
- T-007: projection — DONE. Model.js, tests/projection.test.mjs. Gate P. Acceptance 4/4.
- T-008: bundled outlines — DONE. data/outlines.json, tools/build-outlines.py, tools/README.md, tests/outlines.test.mjs. Gate P. Acceptance 3/3. Natural Earth 50m reachable; public domain confirmed.
- T-009: popup chrome — DONE. Panel.qml, BarWidget.qml, tests/popup-chrome.test.mjs. Gate P. Acceptance 3/3.
- Tier 1 gate: SKIPPED (codex unauthenticated).
- Tests: 48 passing. Next: tier 2 — T-010..T-018.

### Wave 3 — Tier 2 — 2026-09-08
- T-010: grid tiling suite — DONE. tests/grid-tiling.test.mjs. Gate P. Acceptance 2/2.
- T-011: grid model normalizer — DONE. Model.js, tests/fixtures/make.mjs, tests/grid-model.test.mjs. Gate P. Acceptance 3/3.
- T-012: request builder — DONE. Model.js, tests/request.test.mjs. Gate P. Acceptance 3/3. Live API check confirmed array shape + snapped echoed coords.
- T-013: refresh setting reader — DONE. Model.js, tests/refresh-setting.test.mjs. Gate P. Acceptance 3/3.
- T-014: cell rectangles — DONE. Model.js, tests/cell-rects.test.mjs. Gate P. Acceptance 2/2.
- T-015: basemap renderer — DONE. Basemap.qml, data/Outlines.js, Panel.qml, docs/rendering.md, tests/basemap.test.mjs. Gate P. Acceptance 1/1.
- T-016: summon/hide routing — DONE. BarWidget.qml, tests/ipc-routing.test.mjs. Gate P. Acceptance 1/1.
- T-017: popup width + fit — DONE. Model.js, Panel.qml, docs/rendering.md, tests/popup-geometry.test.mjs. Gate P. Acceptance 2/2.
- T-018: theming — DONE. Panel.qml, tests/theming.test.mjs. Gate P. Acceptance 1/1.
- Tier 2 gate: SKIPPED (codex unauthenticated).
- Tests: 101 passing. Next: tier 3 — T-019..T-027.

### Wave 4 — Tier 3 — 2026-09-08
- T-019: unavailable normalization — DONE. Model.js, tests/unavailable.test.mjs. Gate P. Acceptance 4/4.
- T-020: parse boundary — DONE. Model.js, tests/parse.test.mjs. Gate P. Acceptance 1/1.
- T-021: fetch executor — DONE. Model.js, WeatherData.qml, tests/fetch.test.mjs. Gate P. Acceptance 2/2. Live timeout proof (curl exit 28).
- T-022: cache writer — DONE. Model.js, WeatherData.qml, tests/cache-write.test.mjs. Gate P. Acceptance 2/2.
- T-023: Chisinau marker — DONE. CenterMarker.qml, Basemap.qml, tests/marker.test.mjs. Gate P. Acceptance 2/2.
- T-024: cloud heatmap — DONE. CloudLayer.qml, Model.js, Panel.qml, docs, tests/cloud-heatmap.test.mjs. Gate P. Acceptance 4/4.
- T-025: precipitation bands — DONE. Model.js, docs, tests/precipitation-bands.test.mjs. Gate P. Acceptance 2/2.
- T-026: bar glyph mapping — DONE. Model.js, docs, tests/bar-glyph.test.mjs. Gate P. Acceptance 3/3.
- T-027: updated line + attribution — DONE. Model.js, Panel.qml, tests/popup-text.test.mjs. Gate P. Acceptance 2/2.
- Two self-inflicted test regressions caught and fixed at the gate: an over-broad "no curl in Model.js" purity rule, and a blanket "no literal opacity" rule that the marker legitimately violates. Both narrowed to the criterion they were protecting.
- Harness bug fixed: plain() lost Infinity through JSON round-trip; now structuredClone.
- Tier 3 gate: SKIPPED (codex unauthenticated).
- Tests: 170 passing. Next: tier 4 — T-028..T-035.
