---
created: "2026-09-04T13:45:07Z"
last_edited: "2026-09-04T13:55:18Z"
complexity: medium
---

# Cavekit: Map Rendering

## Scope
Everything Cloud Radar shows to the user given a grid model and a status: the projection of the fixed Eastern
Europe bounds into the map area, the bundled basemap outlines and Chișinău marker, the cloud-cover heatmap,
the precipitation overlay, the legend/timestamp/status/attribution block, the popup chrome and its refresh
button, and the bar icon.

Input contract: the grid model fields and the status enum defined in cavekit-weather-data.md R3 and R6. This
kit performs no fetching, scheduling or caching of its own.

## Requirements

### R1: Projection
**Description:** The fixed grid bounds are mapped into the map area with an equirectangular projection that
preserves aspect ratio, so that each grid cell corresponds to a rectangle in the map area.
**Acceptance Criteria:**
- [ ] The four corners of the bounds (lon 19.86/37.86 × lat 41.0/53.0) map to the four corners of the map
      area.
- [ ] The center coordinate 47.01 N, 28.86 E maps to the geometric center of the map area, within 1% of the
      map area width and height.
- [ ] Increasing longitude maps to increasing horizontal position and increasing latitude maps to decreasing
      vertical position, monotonically across the whole area.
- [ ] The ratio between horizontal units per degree of longitude and vertical units per degree of latitude is
      constant across the map area (no differential stretching).
- [ ] Each of the 108 grid cells maps to a rectangle; the rectangles tile the map area with no gaps and no
      overlaps, and each grid point projects to the centre of its rectangle (cell-centre convention from
      cavekit-weather-data.md R1).
- [ ] Resizing the map area re-derives the projection so the above criteria still hold at the new size.
**Dependencies:** cavekit-weather-data.md R3 (`bounds`, `columns`, `rows`, cell coordinates)

### R2: Basemap
**Description:** A bundled, simplified set of country outlines is drawn beneath the data layers: Moldova,
Romania, Ukraine, Bulgaria, Hungary, Slovakia, Poland, Belarus, Serbia and the Black Sea coast. Moldova is
emphasized relative to the others. A marker indicates Chișinău. No city labels are drawn and no map data is
fetched from the network. The outline data's license must permit redistribution and must be credited.
**Acceptance Criteria:**
- [ ] Outline geometry for all ten listed regions is bundled with the plugin and present after installation.
- [ ] Rendering the map issues no network request for basemap or outline data.
- [ ] Moldova's outline differs from the other outlines in at least one documented visual attribute
      (for example stroke weight or colour), and the emphasis rule is documented.
- [ ] A Chișinău marker is drawn at the projected position of 47.01 N, 28.86 E (R1).
- [ ] No place-name or city text labels appear on the map.
- [ ] The outline data source, its license and the fact that the license permits redistribution are recorded
      in the project attribution (see cavekit-plugin-packaging.md R5).
- [ ] Outlines and the Chișinău marker are legible against both light and dark themes. (human review)
- [ ] Moldova is distinguishable from its neighbours at the popup's rendered size. (human review)
**Dependencies:** R1

### R3: Cloud heatmap
**Description:** Cloud cover percentages from the grid model are drawn as the opacity of a single neutral
cloud colour, interpolated between grid points so the field appears smooth rather than blocky. Cells whose
cloud cover is "unavailable" are drawn with a documented distinct treatment.
**Acceptance Criteria:**
- [ ] A cell value of 0% renders fully transparent (the basemap beneath is unmodified).
- [ ] A cell value of 100% renders at full opacity of the documented neutral cloud colour.
- [ ] Rendered opacity increases monotonically with cloud cover percentage between 0% and 100%.
- [ ] For numeric-valued cells, only the documented neutral cloud colour is used for this layer; hue does not
      vary with value.
- [ ] For two adjacent grid points with different values, the rendered value sampled midway between them lies
      strictly between the two endpoint values (interpolation, not nearest-cell fill).
- [ ] A fixture containing one "unavailable" cell renders that cell with the documented distinct treatment,
      different from any opacity used for numeric values.
- [ ] In that fixture, cells adjacent to the unavailable cell still render from their own numeric values.
- [ ] The cloud field shows no visible rectangular cell edges at popup size. (human review)
**Dependencies:** R1; cavekit-weather-data.md R3 (`cells[].cloudCoverPercent`)

### R4: Precipitation overlay
**Description:** Precipitation is drawn above the cloud layer in blue, with intensity expressed as four
documented bands: none, light, moderate and heavy. Rain and snow are not distinguished.
**Acceptance Criteria:**
- [ ] The precipitation layer is composited above the cloud heatmap (R3) wherever both are present.
- [ ] The layer uses blue only; no other hue is used to encode precipitation.
- [ ] Exactly four bands exist — none, light, moderate, heavy — with numeric millimetre thresholds documented
      in the project documentation.
- [ ] Each documented threshold value maps deterministically to exactly one band, and the mapping covers every
      value greater than or equal to 0 with no gaps or overlaps.
- [ ] A value in the "none" band renders no precipitation marking.
- [ ] Two fixtures with the same precipitation amount, one representing rain and one representing snow,
      render identically.
- [ ] A cell whose precipitation is "unavailable" but whose cloud cover is numeric renders no precipitation
      marking and its cloud cover is drawn normally per R3; the R3 distinct treatment applies only when cloud
      cover itself is "unavailable".
- [ ] The four bands are visually distinct from one another at popup size. (human review)
**Dependencies:** R3; cavekit-weather-data.md R3 (`cells[].precipitationMm`)

### R5: Legend, timestamp, status and attribution
**Description:** The popup shows a legend for both scales, the time of the displayed data, an indicator of the
current status, and the required data attribution.
**Acceptance Criteria:**
- [ ] A legend for the cloud-cover scale is visible in the popup, showing at minimum its 0% and 100% ends.
- [ ] A legend for the four precipitation bands is visible in the popup, labelled with their thresholds.
- [ ] The popup shows "Updated HH:MM" derived from the displayed model's `dataTime`.
- [ ] Each of the four statuses `loading`, `ready`, `stale`, `error` produces a distinct, documented
      presentation in the popup.
- [ ] In `stale`, a stale indicator is visible alongside the displayed map and the map remains visible.
- [ ] In `error`, an error indicator is visible and the last error text is shown or reachable in the popup.
- [ ] The text "Weather data by Open-Meteo.com" is visible in the popup.
**Dependencies:** cavekit-weather-data.md R3 (`dataTime`), R6 (status enum, `lastErrorText`)

### R6: Popup chrome
**Description:** The popup opens and closes from the bar entry, closes on Escape, fits within the free screen
area, has a width comparable to the built-in Omarchy weather popup, carries a refresh button, and adopts the
bar's colours and font.
**Acceptance Criteria:**
- [ ] Activating the bar entry when the popup is closed opens it.
- [ ] Activating the bar entry when the popup is open closes it (toggle).
- [ ] Pressing Escape while the popup is open closes it.
- [ ] The shell's summon command for `io.github.alecszaharia.cloud-radar` opens the popup and the hide command
      closes it.
- [ ] The popup's rendered geometry stays inside the free screen area reported by the host on the display it
      opens on, at the smallest supported screen size of 1280×720 logical pixels.
- [ ] The popup width equals the documented value chosen to match the built-in weather popup.
- [ ] The popup contains a refresh control that triggers a manual refresh (cavekit-weather-data.md R4).
- [ ] Triggering the refresh control while a fetch is in flight issues no additional outbound request.
- [ ] The popup's foreground colour and font family are taken from the bar's theme values rather than
      hard-coded, and change when the bar theme changes.
**Dependencies:** cavekit-weather-data.md R4 (manual refresh); cavekit-plugin-packaging.md R1 (bar-widget
entry point)

### R7: Bar icon
**Description:** The bar entry is an icon only. The glyph reflects the condition at the center sample —
clear, partly cloudy, overcast or precipitating — and takes a distinct appearance when data is stale or in
error.
**Acceptance Criteria:**
- [ ] The bar entry renders a glyph and no text, percentage or map thumbnail.
- [ ] The mapping from center cloud cover and precipitation to the four glyphs (clear, partly cloudy,
      overcast, precipitating) is documented with numeric thresholds.
- [ ] The mapping is total and unambiguous: every combination of valid numeric center values resolves to
      exactly one of the four documented glyphs.
- [ ] A numeric center cloud cover with an "unavailable" center precipitation is treated as no precipitation
      (same rule as R4).
- [ ] An "unavailable" center cloud cover value never resolves to a condition glyph; it uses the same
      documented distinct appearance as the error state, so unknown data is never shown as clear weather.
- [ ] A fixture for each of the four conditions renders its documented glyph.
- [ ] In the `stale` status, the bar entry adopts a documented appearance distinct from `ready`.
- [ ] In the `error` status, the bar entry adopts a documented appearance distinct from both `ready` and
      `stale`.
- [ ] The bar entry uses the bar's foreground colour rather than a hard-coded colour.
**Dependencies:** cavekit-weather-data.md R3 (`center`), R6 (status enum)

## Out of Scope
- Fetching, scheduling, retrying or caching weather data (see cavekit-weather-data.md).
- The plugin manifest, settings UI, installation and catalog artifacts (see cavekit-plugin-packaging.md).
- Forecast timeline or animation playback.
- Hover readout or any per-point value inspection.
- Click-through to the built-in weather panel.
- Configurable center, zoom or extent controls.
- Rendering low/mid/high cloud layers or distinguishing rain from snow.
- City labels and any network-fetched map tiles.
- A settings UI beyond the single refresh-interval setting declared by packaging.

## Cross-References
- See also: cavekit-weather-data.md — defines the grid model (R3) and status enum (R6) this kit renders.
- See also: cavekit-plugin-packaging.md — declares the bar-widget entry point that hosts the bar icon and
  popup.

## Changelog
- 2026-09-04: Initial draft from the approved design (context/refs/approved-design-cloud-radar.md).
- 2026-09-04: Reviewer pass 1 — clarified grid cell-centre convention, setting clamping, cache-fresh scheduling, fixed timeout/retry constants, unavailable-data handling.
- 2026-09-04: Reviewer pass 2 (advisory) — neutral-colour rule scoped to numeric cells, minimum screen size 1280×720, unavailable-precipitation rule for the bar glyph.
