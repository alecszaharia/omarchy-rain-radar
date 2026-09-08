---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T06:55:00Z"
---
# Implementation Tracking: plugin-packaging

Build site: context/plans/build-site.md

| Task | Status | Notes |
|------|--------|-------|
| T-001 | DONE | manifest.json identity block (id, name, kind+entryPoint, category Info, allowMultiple false, defaultSection center) + BarWidget.qml stub. scripts/check.sh gate added. 7 tests. |
| T-004 | DONE | manifest barWidget.schema: single refreshMinutes entry (integer 10-120, step 5, default 20) + defaults block. Test sweeps QML for setting() reads of other keys. |
| T-005 | DONE | MIT LICENSE at root, manifest.license matches. |
