# Cloud Radar — documented rendering values

Every number the kits require to be "documented" lives here, with the reasoning
behind it. The code reads these as named constants in `Model.js`; this file
explains them.

## Popup width

`Model.POPUP_CONTENT_WIDTH = 480`, passed through `Style.space()` like every
other shell dimension so it tracks the theme's spacing scale.

480 is the exact value Omarchy's built-in weather popup uses
(`/usr/share/omarchy/shell/plugins/panels/weather/Panel.qml`, which calls
`panel.fittedContentWidth(Style.space(480))`). Cloud Radar is designed to sit
next to that widget in the bar, so the two popups match rather than stepping on
each other visually.

## Fitting the free screen area

The popup never sizes itself directly. Both dimensions go through
`KeyboardPanel.fittedContentWidth()` and `fittedContentHeight()`, which clamp
the requested size to `availableCardWidth` / `availableCardHeight` — the screen
minus the bar, the gap and the outer margin, as reported by the host for the
display the popup opens on.

At the smallest supported screen, 1280x720 logical pixels with a top bar:

| Quantity | Value |
| --- | --- |
| `availableCardWidth` | `1280 - margin * 2` = 1270 |
| `availableCardHeight` | `720 - (barHeight + gap + margin)` ≈ 670 |
| Requested content width | 480 |
| Requested content height | title + map (480 / 1.5 = 320) + legends and status |

The requested width is well inside the available width, and the clamp means a
smaller screen, a larger spacing scale or a side bar shrinks the popup instead
of letting it overflow. Fitting is therefore structural, not a matter of the
content happening to be small enough.

## Map aspect ratio

`Model.MAP_ASPECT = 1.5`. The sampled bounds span 18 degrees of longitude by 12
of latitude, so laying the map area out at 3:2 makes the equirectangular
projection's horizontal and vertical scales equal and keeps the region
undistorted.

## Basemap emphasis rule

Moldova is the region the map is about, so it is drawn differently from its
neighbours. The rule lives in `Model.basemapStyle(region)`:

| Region kind | Stroke width | Opacity | Filled |
| --- | --- | --- | --- |
| Moldova (`emphasis: true`) | `BASEMAP_STROKE_WIDTH * 2` = 2.0 | 1.0 | no |
| Other countries | `BASEMAP_STROKE_WIDTH` = 1.0 | 0.45 | no |
| Black Sea (`kind: "water"`) | 1.0 | 0.18 | yes |

Two attributes separate Moldova from its neighbours — twice the stroke weight
and full opacity against their muted 0.45 — so the emphasis survives even where
a shared border means the two outlines coincide.

Every stroke uses the bar's foreground colour rather than a fixed palette, and
varies only in width and opacity. That is what keeps the basemap legible under
both light and dark themes without a second set of colours to maintain.

Draw order is water, then neighbours, then Moldova, so the emphasized outline is
never overdrawn by a neighbour sharing its border.

## Outline data

`data/Outlines.js` is a generated QML `.js` resource, not JSON. The QML engine
loads it as part of the compilation unit, so drawing the basemap reads no file
and issues no network request. Regenerate it with `tools/build-outlines.py`.
