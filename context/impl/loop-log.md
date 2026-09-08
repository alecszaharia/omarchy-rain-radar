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
