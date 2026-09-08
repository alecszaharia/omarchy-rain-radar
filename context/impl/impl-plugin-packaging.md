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
| T-049 | DONE | omarchy plugin validate run in-suite + manifest/kind/entry-path/id assertions. 6 tests. |
| T-050 | DONE | qmllint over all QML, symlink walk, dev-only manifest field sweep. 5 tests. |
| T-056 | DONE | README: install, placement next to omarchy.weather, refreshMinutes 10-120/20, requirements. Rate-limit note on the 10-min floor. 6 tests. |
| T-058 | DONE | README attribution: Open-Meteo verbatim + Natural Earth public domain, redistribution stated. Asserted against Outlines.js and manifest. 6 tests. |
| T-051 | BLOCKED | Needs a public repo URL and a live Omarchy shell. |
| T-052 | BLOCKED | Lifecycle checks need the live shell (depends on T-051). |
| T-053 | BLOCKED | Shell-log audit needs the live shell. |
| T-054 | BLOCKED | Disabled-state quiescence needs the live shell. |
| T-055 | BLOCKED | Install-on-stock check needs the live shell. Static half (no extra runtime deps, no privilege escalation) holds by inspection. |
| T-057 | BLOCKED | Screenshot needs the running popup. |
| T-059 | BLOCKED | preview.png derives from T-057. |
| T-060 | BLOCKED | Catalog metadata depends on T-059. |
