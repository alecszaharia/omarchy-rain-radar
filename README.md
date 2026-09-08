# Cloud Radar

An Omarchy 4 bar widget showing a cloud-cover map of Eastern Europe centred on
Chișinău, Moldova, with a precipitation overlay.

The bar entry is an icon only — it reports the condition at the centre. Clicking
it opens a popup with the map, a legend for both scales, the time of the reading
and a refresh button.

## Install

```sh
omarchy plugin add https://github.com/alecszaharia/cloud-radar
```

Then enable it from Omarchy's plugin list. The widget lands in the bar's
**center** section by default.

## Placing it next to the weather widget

Cloud Radar is designed to sit beside Omarchy's built-in weather widget: the
popup is the same width, and both live in the `Info` category.

The built-in weather widget also defaults to the bar's center section, so
enabling both usually puts them side by side already. To control the order, edit
the bar layout in `~/.config/omarchy/shell.json`: the widgets in a section are
drawn in the order they appear in that section's list, so move the
`io.github.alecszaharia.cloud-radar` entry immediately before or after
`omarchy.weather`.

## Settings

One setting, editable from the widget's entry in Omarchy's plugin settings.

| Setting | Type | Range | Default |
| --- | --- | --- | --- |
| `refreshMinutes` | integer | 10–120 | 20 |

How often the map refreshes from Open-Meteo, in minutes. Values outside the
range are clamped; a missing or unreadable value falls back to 20. Changing it
takes effect immediately — no shell restart needed.

A restart within one interval reuses the cached map and does not spend a
request, so the schedule resumes from the last fetch rather than from startup.

### Why 10 minutes is the floor

Each refresh is one request covering 109 sampling points, and Open-Meteo's free
tier counts multi-location calls per location. At the default 20 minutes that is
roughly 7,800 location-calls a day, comfortably inside their published guidance.
At the 10-minute minimum it is roughly 15,700, which exceeds it — so treat the
short end of the range as something to use briefly, not as a daily setting.

## What it shows

- **Cloud cover** as the opacity of a single neutral grey, interpolated between
  sampling points so the field reads as weather rather than as a grid.
- **Precipitation** above it in blue, in four bands (none, light, moderate,
  heavy). Rain and snow are not distinguished.
- **Moldova** emphasised against its neighbours, with a marker on Chișinău.
- Areas with no reading are hatched rather than drawn as clear sky.

Current conditions only — there is no forecast timeline, and the map area,
centre and extent are fixed.

## Requirements

Stock Omarchy 4. The plugin uses only components that ship with it — Quickshell,
Qt and `curl` — needs no additional packages, and runs without elevated
privileges.

## Development

```sh
./scripts/check.sh      # omarchy plugin validate + qmllint + unit tests + symlink sweep
```

See `docs/rendering.md` and `docs/data.md` for the documented constants — colour,
thresholds, timeouts, retry policy — and `tools/README.md` for regenerating the
bundled outlines.

## Credits

Weather data by Open-Meteo.com

Country outlines and the Black Sea are derived from
[Natural Earth](https://www.naturalearthdata.com/) 50m vector data
(`ne_50m_admin_0_countries`, `ne_50m_geography_marine_polys`). Natural Earth
places its data in the
[public domain](https://www.naturalearthdata.com/about/terms-of-use/), which
permits redistribution, so the simplified outlines are bundled with the plugin
and the map never fetches anything to draw itself. See `tools/README.md` for how
they are regenerated.

Cloud Radar itself is MIT licensed — see [LICENSE](LICENSE).
