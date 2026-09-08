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
| Requested content height | title + map (480 / 1.5 = 320) + controls and status |

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
| 10% | 0.001 |
| 30% | 0.03 |
| 50% | 0.13 |
| 80% | 0.51 |
| 100% | 1.0 — fully opaque |

`Model.cloudOpacity(percent)` raises the cover fraction to
`CLOUD_OPACITY_GAMMA` (3.0). It is the single knob for how heavy the map reads. It is monotonic and clamped at both ends, which is
all R3 fixes; the curve between the ends is a presentation choice.

It is not linear because a linear ramp does not read like the sky. Painting a
third of the sky as a third-grey wash over the whole map made broken cloud look
like heavy overcast — reported from the running plugin as "too much clouds" on
a day the sky was nearly clear, while the readings under Chișinău were 1–7%.
Holding the low and middle of the range back makes thin cover read as thin.

The popup shows no legend — it was removed at the user's request — so these
numbers are documented here rather than on screen. The hue never varies with the value, so a viewer reads
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

The fractional weights are eased (`Model.easeWeight`, a smoothstep) before the
blend. Plain bilinear across a 1.5° lattice reads as a wash, because every
feature is spread evenly over the ~110 km between samples; easing concentrates
the change in the middle of each span so a bank of cloud keeps a recognisable
edge. The field stays continuous and monotonic, and at the midpoint between two
readings the eased weight is still exactly 0.5 — so no cell boundary appears and
R3's midpoint rule still holds.

### Rectangle edges

The layers rasterise into whole-pixel rectangles whose edges meet exactly:
each runs to where the next begins. Drawing them a pixel larger to hide seams
does the opposite — every overlap composites its alpha twice and prints a
lattice across the field.

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
as an invented intensity.

A cell with no amount of its own is skipped before interpolation, by the same
nearest-cell rule the cloud hatch uses (`Model.isPrecipitationUnavailableAt`).
Without that, a drenched neighbour's amount would be interpolated into it and
paint rain over a cell that never reported any.

The two unknowns are independent: a missing amount leaves the cell's cloud cover
drawn normally, and the R3 hatch applies only when the cloud cover itself is
unavailable.

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

## Bar appearance by status

The glyph says what the weather is; the opacity says how much to trust it
(`Model.barAppearance`).

| Status | Glyph | Opacity |
| --- | --- | --- |
| ready | the condition glyph | 1.0 |
| stale | the condition glyph | 0.6 |
| error | the condition glyph | 0.4 |
| no usable centre reading, any status | `U+E374` (weather "n/a") | 0.4 |

The glyph answers *what the weather is*; the opacity answers *how much to trust
it*. Those are separate questions, which is why a failed refresh dims the glyph
rather than replacing it: while a usable reading is on screen the bar keeps
reporting it, exactly as the popup keeps showing the map beneath its error
indicator. A bar that claimed ignorance while the popup displayed a map would be
contradicting itself.

The three statuses stay distinguishable for a known condition by opacity alone:
1.0, 0.6, 0.4.

`U+E374` is reserved for the one case where the first question has no answer —
no usable centre reading, or no model at all. Then every status presents
identically, because there is nothing for the status to qualify. This is what
keeps unknown data from ever being shown as clear weather.

## Popup status presentations

Each of the four statuses has its own presentation
(`Model.STATUS_PRESENTATIONS`). None of them hides the map: a stale or failed
refresh still leaves the last good map on screen, and the indicator only says
how much to trust it.

| Status | Indicator | Text | Error detail |
| --- | --- | --- | --- |
| loading | shown | "Updating…" | no |
| ready | none | — | no |
| stale | shown | "Out of date" | no |
| error | shown | "Refresh failed" | yes — `lastErrorText` below the label |

Ready deliberately says nothing. An indicator for the normal case would be
noise, and saying nothing is itself distinct from the other three.

## Zoom

The map shows a window onto the sampled area. `Model.viewportFor(zoom)` returns
that window; every layer projects and samples through it, so they can never
disagree about what is on screen.

| Constant | Value |
| --- | --- |
| `Model.ZOOM_MIN` | 1.0 — the window is exactly the sampled bounds |
| `Model.ZOOM_MAX` | 4.0 |
| `Model.ZOOM_STEP` | 0.5 per button press or wheel notch |

The window is centred on Chișinău and its span is the full span divided by the
zoom level, so the aspect ratio the projection depends on is the same at every
level.

Where a centred window would run past an edge it is **shifted back inside the
bounds, never shrunk** — shrinking would change the aspect ratio. This is not a
hypothetical: Chișinău sits slightly north of the bounds' centre, so at
`ZOOM_MIN` a centred window would overhang the northern edge by 0.01°. Shifting
is what makes `viewportFor(ZOOM_MIN)` exactly equal to the bounds.

Zoom never asks the source for anything. It is a window onto data already
fetched, so zooming in shows the same 12×9 readings interpolated across a
smaller area — more detail in the drawing, not more detail in the data. The
weather service knows nothing about it.

Zoom is view state rather than a setting. The plugin declares exactly one user
setting, and how far the map is zoomed is not worth persisting.

Controls: `−` and `+` in the popup, greyed at the limits, and the mouse wheel
over the map itself. The wheel uses a `WheelHandler` rather than a `MouseArea`
so it does not swallow presses meant for the popup.
