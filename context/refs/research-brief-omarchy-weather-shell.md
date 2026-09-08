# Research brief: Omarchy 4.0.2 shell — weather widget and plugin runtime
Generated: 2026-09-04 (codebase exploration of /usr/share/omarchy; 1 agent)

## Summary
- Omarchy 4 shell is Quickshell-based (Wayland layer-shell). Plugins are git checkouts under ~/.config/omarchy/plugins/<id>/.
- The built-in weather plugin (/usr/share/omarchy/shell/plugins/panels/weather/) ALREADY uses Open-Meteo for its
  forecast (Panel.qml:177-184) and Open-Meteo geocoding for its location search; wttr.in is used for bar text scripts.
- Location state: ~/.local/state/omarchy/settings/weather.json = {"name","latitude","longitude"}, written by
  omarchy-weather-location; the weather panel live-watches it with FileView { watchChanges: true }.
- Weather refresh: `refreshMinutes` setting (default 15, min 1) on a repeating Timer; 3 retries 2.5 s apart on failure.
- Bar render pattern: BarIconButton with an icon glyph; popup is a KeyboardPanel (layer-shell PanelWindow) sized by
  the widget (weather 480 units wide, omatop 360); clamped to free screen area; only one popup open at a time.
- Bar layout: ~/.config/omarchy/shell.json -> bar.layout.{left,center,right} arrays of {"id": ...}. A plugin sits next
  to weather by being adjacent to {"id":"omarchy.weather"} in the same array (drag in bar UI or `omarchy bar move`).
- Manifest schema field types in use: integer{min,max,step,defaultValue}, boolean, enum{options}, string, path.
  barWidget.defaultSection must be left|center|right.
- QML runtime available to plugins: `import qs.Commons` (Color, Style, Border, Util singletons), `import qs.Ui`
  (BarWidget, Panel, KeyboardPanel, PanelKeyCatcher, PanelController, BarIconButton, WidgetButton, OpticalGlyph,
  TextField, Button, NumberField, PanelSeparator, PanelSectionHeader). BarWidget exposes bar, moduleName, settings,
  vertical, barSize, setting(name, fallback), broadcast(method). Theme via bar.foreground/background/fontFamily.
- HTTP: idiomatic pattern is Quickshell.Io.Process running `curl -fsS --max-time N <url>` + StdioCollector,
  JSON parsed in a pure Model.js. No XHR usage in-tree.
- Drawing: QtQuick Canvas is used in-shell (BorderOverlay, Background, ImagePicker); QtQuick.Shapes is installed.
  NO QtLocation / map / tile component installed (qt6-location absent). Map must be hand-painted.
- Validation: omarchy-plugin-validate mirrors services/PluginRegistry.qml; no symlinks in plugin dir (except .git),
  id regex ^[A-Za-z0-9][A-Za-z0-9._-]*$, no `omarchy.` prefix.

## Implications for design
- Reuse the weather plugin's location file as an optional source, but the user chose a fixed Moldova center.
- Match the weather widget's look: BarIconButton in bar, KeyboardPanel popup ~480 wide.
- Separate pure data/model logic (grid generation, JSON normalization, colour mapping) from QML for testability.
- Keep total Open-Meteo load small: coarse grid (~108 points) at 15 min.

## Sources
/usr/share/omarchy/shell/README.md, shell/plugins/bar/README.md, shell/plugins/panels/weather/{Panel.qml,BarWidget.qml,Model.js,manifest.json},
shell/Ui/{BarWidget,Panel,KeyboardPanel}.qml, shell/Commons/{Color,Style}.qml, bin/omarchy-plugin-{validate,add,clone},
bin/omarchy-weather-{status,icon,location}, ~/.config/omarchy/plugins/io.github.twiking.omatop/.
