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

## Per-device-pixel canvas painting — ABANDONED (live testing, 2026-09-08)

**Attempted:** painting the cloud and precipitation fields at one pixel per canvas
pixel, first by calling `Model.sampleCloudField` per pixel, then with an
allocation-free painter writing RGBA into `ctx.createImageData(w, h)`.

**Result:** both layers rendered blank in the real shell, with no warning logged.
The second version pegged the shell process at 100% of a core and left the
desktop unresponsive until it was restarted.

**Why:** two compounding costs.
1. The popup canvas is device-scaled. At the documented 480-wide popup on a 2x
   display the raster is 960x640 = 614,400 pixels, four times what was
   benchmarked.
2. Writing into a QML canvas pixel buffer is far more expensive per element than
   writing into a plain JS array, so a node benchmark understates the real cost
   by a wide margin. 273 ms measured in V8 for a 480x320 plain array was already
   too slow; the real thing was worse again.

**What replaced it:** the layers paint a fixed `FIELD_RASTER_WIDTH` x
`FIELD_RASTER_HEIGHT` (120x80) raster and the scene graph scales it to the map
area with `smooth: true`. The upscale is linear filtering on the GPU — the same
bilinear blend, for free. The field is only a 12x9 sample lattice, so 120x80 is
still 10x oversampled and nothing visible is lost. `Model.MAX_RASTER_PIXELS` is
a hard backstop: above it the painters return without touching the buffer, so
the worst case is a blank layer rather than a wedged desktop.

**Rules this leaves behind:**
- Never benchmark QML canvas work in node and treat the number as representative.
- Never size a per-pixel raster from an item's device-scaled dimensions.
- Verify a paint in the real shell before syncing it to an installed plugin.
