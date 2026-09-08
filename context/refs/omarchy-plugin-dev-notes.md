# Omarchy 4 plugin development — reference notes
Source: https://omarchy.baris.sh/plugins/develop/ (fetched 2026-09-04)
Runtime contract source of truth: https://github.com/basecamp/omarchy/blob/quattro/shell/README.md
Built-in plugin examples: https://github.com/basecamp/omarchy/tree/quattro/shell/plugins
Publishing guide: https://omarchy.baris.sh/plugins/publish/

## manifest.json (schemaVersion 1)
Required: schemaVersion(1), id (namespaced, e.g. io.github.<user>.<name>; `omarchy.*` reserved), name, version (semver),
author, license, description, kinds[], entryPoints{}.
Optional: omarchy.clonedFrom (dev only, remove before publish), keepLoaded, preview.png, barWidget{displayName,
description, category, allowMultiple, defaultSection, defaults{}, schema[]} (schema field types seen in the wild:
integer{min,max,step,defaultValue}, boolean{defaultValue}; see ~/.config/omarchy/plugins/io.github.twiking.omatop/manifest.json).

## Kinds -> entryPoints
bar-widget -> barWidget (BarWidget.qml) | panel -> panel | overlay -> overlay | menu -> menu | service -> service | bar -> bar

## Bar-widget contract
Root type `BarWidget`, `moduleName: "<plugin id>"`, readonly props `opened`, `popoutSwitchClosing`; functions open(),
close(), toggle(), closeForPopoutSwitch(). Injected: `bar` (parent bar; `root.bar.fontFamily`), `barForeground` (theme color).
Panel: root type `Panel`, same moduleName, `manageIpc: false`, props anchorItem/hostWidget, open() -> controller.show().
Nested panel loaded via Loader inside the widget (do NOT declare a separate `panel` kind).
Imports: QtQuick, Quickshell, qs.Commons, qs.Ui. Layout: KeyboardPanel (anchors to bar button), PanelKeyCatcher (Esc/Tab).

## Validation
`omarchy plugin validate "$PLUGIN_DIR"`; `qmllint -I "$OMARCHY_PATH/shell" "$PLUGIN_DIR/BarWidget.qml"`.
Rules: valid JSON, kinds/entryPoints aligned, safe relative entry paths that exist, no symlinks, no omarchy.* id.

## Dev workflow
`omarchy plugin clone omarchy.clock --edit` -> ~/.config/omarchy/plugins/<id>/ (auto-discovered, auto-reload).
`omarchy-shell shell summon "$PLUGIN_ID" '{}'`, `omarchy-shell shell hide "$PLUGIN_ID"`, `omarchy plugin list --json`,
`omarchy-shell shell rescanPlugins`.

## Restrictions
Unsandboxed, runs inside the long-running shell process as the user. Never start a second Quickshell. Avoid privileges.
