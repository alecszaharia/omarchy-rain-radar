---
created: "2026-09-04T13:45:07Z"
last_edited: "2026-09-04T13:45:07Z"
complexity: medium
---

# Cavekit: Plugin Packaging

## Scope
Everything that makes Cloud Radar an installable, publishable Omarchy 4 plugin: the plugin manifest and its
settings schema, passing the platform's validation tooling, installation and bar placement, lifecycle
behaviour across enable/disable/remove/shell restart, user documentation and catalog artifacts, and the
dependency budget.

This kit declares the `refreshMinutes` setting consumed by cavekit-weather-data.md R4 and the bar-widget entry
point that hosts the surfaces in cavekit-map-rendering.md.

Reference material: `context/refs/omarchy-plugin-dev-notes.md` and
`context/refs/research-brief-omarchy-weather-shell.md` (background only; not requirements).

## Requirements

### R1: Manifest and settings schema
**Description:** The plugin manifest identifies Cloud Radar to Omarchy: id `io.github.alecszaharia.cloud-radar`,
display name "Cloud Radar", kind bar-widget with a matching entry point, category "Info" (the same category as
the built-in Omarchy weather widget), single instance only, default bar section "center" (where the built-in
weather widget lands when enabled). It exposes exactly one user setting: the refresh interval, key
`refreshMinutes`, an integer with minimum 10, maximum 120 and default 20.
**Acceptance Criteria:**
- [ ] The manifest declares the id `io.github.alecszaharia.cloud-radar`.
- [ ] The manifest declares the display name "Cloud Radar".
- [ ] The manifest declares the kind bar-widget and a corresponding entry point that exists in the package.
- [ ] The manifest declares category "Info".
- [ ] The manifest disallows multiple instances of the widget.
- [ ] The manifest declares default section "center".
- [ ] The settings schema contains exactly one entry.
- [ ] That entry has key `refreshMinutes`, type integer, minimum 10, maximum 120 and default value 20.
- [ ] No other user-configurable setting is exposed anywhere in the plugin.
**Dependencies:** none; consumed by cavekit-weather-data.md R4 and cavekit-map-rendering.md R6

### R2: Validation
**Description:** The packaged plugin passes Omarchy's plugin validator and the shell's UI source linter with
no errors, and contains no symlinks.
**Acceptance Criteria:**
- [ ] Running Omarchy's plugin validator against the plugin directory reports no errors.
- [ ] Running the shell's UI source linter against the bar-widget entry point reports no errors.
- [ ] The plugin directory contains no symlinks (excluding version-control internals).
- [ ] The manifest is well-formed and its declared kinds and entry points are consistent with one another.
- [ ] All declared entry paths are relative, safe, and resolve to files that exist in the package.
- [ ] The plugin id does not use the reserved `omarchy.` prefix.
- [ ] No development-only manifest fields remain in the published package.
**Dependencies:** R1

### R3: Installation and placement
**Description:** The plugin installs from its public repository with Omarchy's standard plugin-add command,
enables cleanly, and its documentation explains how to place it next to the built-in weather widget.
**Acceptance Criteria:**
- [ ] Adding the plugin from the public repository URL with Omarchy's standard plugin-add command succeeds
      with a zero exit status.
- [ ] After adding, the plugin appears in Omarchy's plugin listing under the id
      `io.github.alecszaharia.cloud-radar`.
- [ ] Enabling the plugin makes the bar entry appear in the bar's center section by default.
- [ ] Enabling the plugin produces no error entries in the shell log.
- [ ] The user documentation states the steps to place the widget adjacent to the built-in weather widget in
      the bar.
**Dependencies:** R1, R2

### R4: Lifecycle
**Description:** Enabling, disabling, removing the plugin and restarting the shell leave the system clean: no
orphan processes, no shell-log errors, and never a second shell instance.
**Acceptance Criteria:**
- [ ] After disabling the plugin, no process started by the plugin remains running.
- [ ] After removing the plugin, no process started by the plugin remains running and its bar entry is gone.
- [ ] After a shell restart with the plugin enabled, the bar entry reappears and functions.
- [ ] Enable, disable, remove and shell restart each produce no error entries in the shell log attributable to
      the plugin.
- [ ] While disabled, the plugin issues no outbound data requests and runs no refresh timer.
- [ ] The plugin never launches an additional shell instance.
**Dependencies:** R3

### R5: Documentation and catalog artifacts
**Description:** The public repository carries the user-facing documentation, license, preview image and
catalog publishing metadata needed for submission to the Omarchy plugin catalog.
**Acceptance Criteria:**
- [ ] The repository README documents installation using the standard plugin-add command.
- [ ] The README documents placing the widget next to the built-in weather widget.
- [ ] The README documents the `refreshMinutes` setting including its range 10–120 and default 20.
- [ ] The README contains at least one screenshot of the popup map.
- [ ] The README credits "Weather data by Open-Meteo.com".
- [ ] The README credits the bundled outline data source and states its license (see
      cavekit-map-rendering.md R2).
- [ ] The repository contains a license file for the plugin itself, and the manifest's declared license
      matches it.
- [ ] A preview image is present in the package and referenced by the manifest.
- [ ] The metadata required for Omarchy catalog submission is present and matches the manifest id, name,
      version and description.
**Dependencies:** R1

### R6: Dependency budget
**Description:** The plugin runs using only tools and components already shipped with Omarchy 4; installing it
requires no additional packages.
**Acceptance Criteria:**
- [ ] The plugin declares no external runtime dependency beyond components shipped with Omarchy 4.
- [ ] Installing and enabling the plugin on a stock Omarchy 4 system requires no additional package
      installation.
- [ ] All plugin functionality operates without elevated privileges.
**Dependencies:** R2

## Out of Scope
- Weather fetching, scheduling, caching and the grid model (see cavekit-weather-data.md); this kit only
  declares the setting that drives the interval.
- Map drawing, popup contents and bar glyph behaviour (see cavekit-map-rendering.md); this kit only declares
  the bar-widget entry point.
- Any setting other than the refresh interval — no center, extent, layer, theme or unit settings.
- Packaging for distribution channels other than the public repository and the Omarchy plugin catalog.
- Automatic update, migration or telemetry mechanisms.
- Notifications or system integrations beyond the bar widget.

## Cross-References
- See also: cavekit-weather-data.md — consumes the `refreshMinutes` setting declared in R1.
- See also: cavekit-map-rendering.md — its bar icon and popup are hosted by the bar-widget entry point
  declared in R1, and its outline-data attribution is carried by R5.

## Changelog
- 2026-09-04: Initial draft from the approved design (context/refs/approved-design-cloud-radar.md).
