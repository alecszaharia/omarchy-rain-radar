---
created: "2026-09-08T06:37:19Z"
last_edited: "2026-09-08T06:37:19Z"
---

# Dead Ends

Build site: context/plans/build-site.md

## Qt Quick Test (`qmltestrunner`) as the QML test harness — ABANDONED (wave 1)

**Attempted:** running `qmltestrunner` headless (`QT_QPA_PLATFORM=offscreen`) over a
trivial `TestCase` probe, both with `-input <dir>` and `-input <file>`.

**Result:** exits 1 with completely empty stdout and stderr, even with
`QT_LOGGING_RULES="*=true"` and output redirected to files. The `QtTest` QML module
is installed (`/usr/lib/qt6/qml/QtTest`). Two attempts; not diagnosable from inside
the tool sandbox and not worth further budget.

**Consequence — the project's test strategy:** every behaviour that can be expressed
as pure data-in/data-out logic lives in `Model.js` and is unit-tested under node via
`tests/qml-js.mjs` (which loads the QML `.js` resource through `vm`). `.qml` files stay
thin: bindings, layout and wiring only. They are verified by `qmllint`, by structural
assertions over their source where a criterion demands it, and finally by live checks
in the real shell at tier 8+ (T-051 onward). This mirrors how Omarchy's own weather
plugin splits `Model.js` from `Panel.qml`.

**Do not** re-attempt a Qt Quick Test harness without first confirming
`qmltestrunner` works outside this sandbox.
