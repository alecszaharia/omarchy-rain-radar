---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T08:10:00Z"
---

# Plan Overview

## Build Sites
| Site | File | Tasks | Done | Status |
|------|------|-------|------|--------|
| Cloud Radar (primary) | build-site.md | 60 | 49 | BLOCKED ON ENVIRONMENT |

Tiers 0-7 are complete, plus the two documentation tasks from tier 9. All 340
unit tests pass and `scripts/check.sh` (validator, qmllint, tests, symlink
sweep) is clean.

The remaining 11 tasks cannot be completed by an agent alone:

| Task | Needs |
|------|-------|
| T-035, T-043, T-044 | Human review of the rendered map |
| T-051 | A public repository URL and a live Omarchy shell |
| T-052, T-053, T-054, T-055 | Lifecycle and dependency checks in the live shell |
| T-057, T-059 | A screenshot of the running popup |
| T-060 | Catalog metadata, once the preview image exists |
