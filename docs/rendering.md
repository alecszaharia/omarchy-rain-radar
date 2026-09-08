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

## Cloud heatmap

`Model.CLOUD_COLOR = "#9aa0a6"` — a single mid neutral grey, and the only colour
this layer ever uses. Cloud cover is expressed purely as opacity:

| Cloud cover | Opacity |
| --- | --- |
| 0% | 0.0 — fully transparent, the basemap beneath is unmodified |
| 50% | 0.5 |
| 100% | 1.0 — fully opaque |

`Model.cloudOpacity(percent)` is the ramp: linear, monotonically increasing, and
clamped at both ends. The hue never varies with the value, so a viewer reads
density rather than decoding a palette, and nothing on this layer can be
confused with the blue precipitation overlay above it.

The grey is deliberately neither white nor black — it has to read as cloud
against a light bar theme and a dark one alike.

### Interpolation

The 12x9 readings are grid-point samples, not tiles. Drawing them as flat
rectangles would show the sampling lattice rather than the weather, so the layer
paints a bilinearly interpolated field: every pixel is blended from the four
surrounding grid points (`Model.sampleCloudField`).

The sample lattice sits half a cell inside each edge, because grid points are
cell centres. Past it the edge reading holds flat rather than extrapolating into
values the source never reported.

Corners with no reading are dropped from the blend and the remaining weights
renormalised, so an unavailable cell cannot bleed a hole into a neighbour that
does have a reading. A sample with no usable corner at all is itself
unavailable.

### Layer order

Outlines, then the cloud field, then the precipitation overlay, then the
Chisinau marker. At 100% cover the
cloud layer is opaque, so the marker is drawn on top; painted with the basemap
it would disappear exactly when the map is most worth reading.

## Precipitation bands

Precipitation is drawn in blue only, with intensity carried by four bands. The
thresholds are half-open millimetre intervals, so every value from 0 upwards
falls in exactly one band — no gaps, no overlaps:

| Band | Millimetres | Overlay opacity |
| --- | --- | --- |
| none | `0 <= mm < 0.1` | 0.0 — nothing is drawn |
| light | `0.1 <= mm < 2.5` | 0.30 |
| moderate | `2.5 <= mm < 7.6` | 0.55 |
| heavy | `mm >= 7.6` | 0.80 |

`Model.PRECIPITATION_COLOR = "#4a90d9"` is the layer's only colour. Intensity is
carried entirely by the band opacity, never by hue, so the overlay can never be
confused with the neutral cloud field beneath it.

The millimetre amount is interpolated across the field first and banded
afterwards, so a band boundary follows the shape of the data rather than the
sampling lattice.

These are the conventional hourly rain-rate breaks. Rain and snow are not
distinguished: the source reports a single precipitation amount and the same
amount renders identically whatever is falling.

A reading that is not a usable number — including `UNAVAILABLE` — falls in the
`none` band, so unknown precipitation is drawn as no precipitation rather than
as an invented intensity. The cell's cloud cover is unaffected and is still
drawn from its own value.

## Bar glyph

The bar entry is an icon and nothing else — no text, no percentage, no map
thumbnail. The glyph reports the centre sample, resolved in this order:

1. **Precipitating** if the centre's precipitation falls outside the `none`
   band (see above), whatever the cloud cover.
2. Otherwise by cloud cover, in half-open percent intervals:

| Condition | Cloud cover | Glyph |
| --- | --- | --- |
| Precipitating | any, when precipitation is not `none` | `U+E318` |
| Clear | `0 <= cc < 25` | `U+E30D` |
| Partly cloudy | `25 <= cc < 75` | `U+E302` |
| Overcast | `75 <= cc <= 100` | `U+E33D` |

The two rules together are total and unambiguous: every valid numeric pair
resolves to exactly one glyph.

An unavailable centre precipitation counts as no precipitation, so a known sky
is still described. An unavailable centre cloud cover resolves to no condition
at all — `Model.barCondition` returns null — and T-041 renders that with the
same appearance as an error, so unknown data is never shown as clear weather.

The glyphs are Nerd Font weather icons taken from the set Omarchy's own weather
widget draws, so they are known to render in the bar's font.

### Cells with no reading

A cell whose cloud cover is `unavailable` is not placed anywhere on the opacity
ramp. It is hatched instead: diagonal stripes in the bar's **foreground**
colour, period 8 px, 2 px wide, at alpha 0.5
(`Model.hatchAlphaAt`, `Model.UNAVAILABLE_HATCH_*`).

That is deliberately distinct in two ways at once from anything a percentage can
produce:

- **Colour** — the foreground, not the neutral cloud grey, so it reads as chrome
  rather than as weather.
- **Texture** — alternating stripes rather than a uniform fill. No cloud
  percentage renders as a pattern, so "we do not know" can never be misread as
  a density.

The hatched area is the unavailable cell's own region, decided by nearest grid
point (`Model.nearestCellIndex`). Its neighbours are unaffected and keep
rendering from their own readings, because the interpolation drops corners with
no reading and renormalises the remaining weights.
