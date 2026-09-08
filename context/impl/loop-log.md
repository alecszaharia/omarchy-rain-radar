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

### Wave 5 — Tier 4 — 2026-09-08
- T-028 scheduler, T-029 cache reader, T-030 status reducer, T-031 interpolation, T-032 precip overlay, T-033 legends, T-034 bar icon — all DONE, gate P at each step.
- T-035 human review — NOT DONE. Requires a real shell and human judgement; left open deliberately.
- Refactors that touched earlier tasks (each re-verified, behaviour unchanged): status writes moved behind the reducer (T-021/T-022 assertions updated); tiled cloud fill replaced by the interpolated field (T-024 assertions updated); marker extracted to its own layer above the cloud (T-023).
- Tier 4 gate: SKIPPED (codex unauthenticated).
- Tests: 224 passing. Next: tier 5 — T-036..T-044.

### Waves 6-8 — Tiers 5, 6, 7 + docs — 2026-09-08
- Tier 5: T-036, T-037, T-038, T-039, T-040, T-041, T-042 DONE. T-043, T-044 left open (human review).
- Tier 6: T-045, T-046, T-047, T-048 DONE.
- Tier 7: T-049, T-050 DONE.
- Out of order but genuinely unblocked: T-056, T-058 (README + attribution) — nothing in them depends on having installed the plugin.
- Notable: fetch protocol changed in T-045 (-f dropped, HTTP status appended via -w) because a 429 must be distinguishable from an ordinary transport failure. Re-verified live.
- Notable: T-041 found BAR_UNKNOWN_GLYPH had been written as an empty string; all glyphs now use \uXXXX escapes and were checked against the shipped JetBrainsMono Nerd Font.
- Notable: T-047 found unavailable precipitation was being interpolated from neighbours; now skipped by the same nearest-cell rule as the cloud hatch.
- Tier gates 5-7: SKIPPED (codex unauthenticated).
- Tests: 340 passing. 49/60 tasks complete.
- STOPPED: the remaining 11 tasks all need either a live Omarchy shell or human eyes. Waiting on the user.

### Wave 9 — Tier 12 (post-map addition) — 2026-09-08
- T-061: zoom — DONE. Requested directly by the user; cavekit-map-rendering.md gains R8 and zoom leaves Out of Scope (center and extent stay out). Gate P. Acceptance 10/10.
- Projection now takes a viewport: viewportFor(zoom) is centred on Chisinau, keeps the bounds' aspect ratio, and is shifted rather than shrunk at the edges so viewportFor(ZOOM_MIN) equals the bounds exactly.
- Layers sample through viewToGridU/V, hoisting the vertical term per row.
- Removed from Model.js as test-only code that was shipping to users: cellRects, projectionScale, gridPointFraction. They now live in tests/geo.mjs.
- Three near-identical button blocks collapsed into one PillButton inline component.
- Tests: 358 passing.

### Wave 10 — rate-limit defect — 2026-09-08
- Reported by the user: Open-Meteo limit exceeded. Confirmed live: HTTP 429.
- Cause: Omarchy creates one bar widget per monitor; WeatherData lived inside the widget, so a 3-monitor desktop ran three independent services, three timers and 327 location-calls per cycle (~23,500/day against ~10,000 guidance). The risk was flagged when T-034 wired the service into the bar widget and then not acted on — that was the mistake.
- Aggravated during this session by development churn: every plugin rebuild re-ran the load-time fetch on all three instances.
- Fix: cache file is now watched, so a peer's result propagates instead of being re-fetched; restoreFromCache adopts a strictly newer model only; scheduled ticks go through refreshIfDue, which reuses loadTimeDecision so there is one definition of "due"; per-instance period offset stops ticks landing together. Manual refresh deliberately still bypasses the due check.
- Rejected: a plugin-local QML singleton. qmllint resolves `import "."` with a qmldir, but an untested import under Quickshell's loader could brick the widget on the next restart, and it could not be verified without one.
- Tests: 365 passing.

### Wave 11 — bar icon reported N/A — 2026-09-08
- Reported by the user: bar icon showing the n/a glyph.
- Not a rendering fault. The cache restores correctly (verified against the real file: 108 cells, centre 7% -> "clear"), but Open-Meteo is returning 429, so the status is `error` — and barAppearance replaced the condition glyph with n/a whenever the last attempt failed.
- The kit itself was wrong here, not just the code: R7 tied the error appearance to the unknown-data appearance. That made the bar claim "no reading" while the popup was drawing a map from a perfectly good cached one.
- Corrected at the source: R7 now states that a usable centre reading keeps being reported in every status, and that the unknown glyph is reserved for having no reading at all. Statuses stay distinguishable by opacity (1.0 / 0.6 / 0.4).
- Tests: 366 passing.
