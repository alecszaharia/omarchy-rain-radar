<!--
Sync Impact Report
==================
Version change: (unratified template) → 1.0.0
Bump rationale: first ratification — every placeholder replaced with project governance.

Principles (template slot → adopted title):
- [PRINCIPLE_1_NAME] → I. Fixed Product Invariants
- [PRINCIPLE_2_NAME] → II. Honest Data Presentation
- [PRINCIPLE_3_NAME] → III. Bounded Network and Resource Use
- [PRINCIPLE_4_NAME] → IV. Stock Omarchy, Shell-Safe
- [PRINCIPLE_5_NAME] → V. Pure Logic in Model.js, Tested Under Node
- (added)            → VI. Verified in the Real Shell

Added sections:
- Platform and Technical Constraints (template SECTION_2)
- Development Workflow and Quality Gates (template SECTION_3)
- Governance (filled)

Removed sections: none.

Dependent artifacts: templates and commands read this file at runtime; none were modified.
- plan-template.md "Constitution Check" / "Complexity Tracking" — compatible, no edit.
- .specify/templates/spec-template.md, tasks-template.md — compatible, no edit.

Deferred TODOs: none.
-->

# Cloud Radar Constitution

## Core Principles

### I. Fixed Product Invariants

Cloud Radar (`io.github.alecszaharia.cloud-radar`) is an Omarchy 4 bar-widget plugin that shows
current cloud cover and precipitation over a fixed Eastern Europe extent. The following are
invariants; changing any of them requires a constitution amendment, not just a spec:

- The plugin MUST expose exactly one user setting: `refreshMinutes`, an integer in 10–120,
  default 20. View state (e.g. zoom) MUST NOT be persisted as a setting.
- The plugin MUST show current conditions only — no forecast timeline or animation.
- The map centre MUST be fixed on Chișinău (47.01 N, 28.86 E) and the extent MUST be fixed.
- The basemap MUST be drawn from bundled data; the plugin MUST NOT fetch map tiles or any other
  network resource to draw the map.

Everything else in the approved design's out-of-scope list (hover readout, city labels,
rain/snow distinction, cloud layers, notifications) is product scope, owned by specs, and may
change through the normal spec workflow.

Rationale: these are the decisions that keep the widget small, quota-safe and maintainable; every
one of them has a cost that compounds if relaxed casually.

### II. Honest Data Presentation

- A missing, null or malformed reading MUST be represented as unavailable, never as zero.
- Unknown data MUST NOT be rendered as clear weather: unavailable cloud cover is hatched in the
  map, and a missing centre reading shows the "n/a" bar glyph.
- Stale and failed states MUST be visible in both the bar and the popup, and MUST NOT hide the last
  good map.
- Interpolation MUST NOT invent values: cells without a reading are dropped from the blend, and the
  field is not extrapolated past the outermost samples.
- Every tuning constant (thresholds, colours, opacities, timeouts, retry counts) MUST be a named
  constant in `Model.js` and documented with its rationale in `docs/rendering.md` or `docs/data.md`.

Rationale: a weather display that silently shows guesses as facts is worse than none.

### III. Bounded Network and Resource Use

- Each refresh MUST issue at most one Open-Meteo request covering every sampling point, with a
  bounded timeout (`FETCH_TIMEOUT_SECONDS`).
- Retries MUST be bounded, at most one fetch MAY be in flight, and a rate-limit (HTTP 429) response
  MUST back off to at least twice the refresh interval.
- At the default interval, daily location-calls (points × refreshes per day) MUST stay within
  Open-Meteo's published free-tier guidance. Any change to the point count, interval range, default
  or retry policy MUST recompute that budget and update the figures in `README.md`.
- Multiple bar instances (one per monitor) MUST share one cache and together spend no more
  than one instance would.
- A cached model younger than one interval MUST be reused on load instead of fetching.
- While disabled, the plugin MUST issue no requests and run no refresh timer.
- Painting MUST NOT peg the shell's CPU: no per-device-pixel canvas rasters.

Rationale: the plugin runs unattended on a free, keyless API and inside the user's desktop shell;
both are shared resources it must not abuse.

### IV. Stock Omarchy, Shell-Safe

- Runtime dependencies MUST be limited to what stock Omarchy 4 ships (Quickshell, Qt, `curl`); a
  change that requires installing a package is out of bounds.
- The plugin MUST run without elevated privileges, MUST NOT start a second shell instance, and MUST
  leave no orphan processes after disable, remove or shell restart.
- The package MUST pass `omarchy plugin validate` and `qmllint` with no errors, contain no symlinks,
  and carry no development-only manifest fields.
- The plugin MUST NOT require API keys or store secrets.
- Tooling MUST NOT alter the user's shell configuration: `omarchy-refresh-shell` (which resets
  `shell.json`) MUST NOT be used during development; use `omarchy-restart-shell`.

Rationale: the plugin runs unsandboxed inside the long-running desktop shell, as the user.

### V. Pure Logic in Model.js, Tested Under Node

- Behaviour that can be expressed as data-in/data-out logic MUST live in `Model.js` and MUST be
  covered by `node --test` unit tests (loaded through `tests/qml-js.mjs`).
- `.qml` files MUST stay thin — bindings, layout and wiring. They are verified by `qmllint`, by
  structural source assertions where a requirement demands it, and by live checks (Principle VI).
- Every behaviour change MUST add or update a test that fails without the change.
- A Qt Quick Test (`qmltestrunner`) harness MUST NOT be reintroduced without first proving it runs
  headless on this machine (see `context/impl/dead-ends.md`).

Rationale: the QML test runner proved unusable here; this split is what makes the logic
verifiable at all, and it mirrors Omarchy's own weather plugin.

### VI. Verified in the Real Shell

- A rendering or shell-integration change MUST NOT be reported done until it has been observed in
  the running shell.
- After editing any `.qml` file the shell MUST be restarted before the result is judged; hot reload
  re-evaluates `.js` imports but not QML component types.
- Node benchmarks of canvas work MUST NOT be treated as representative of shell performance.
- When a screenshot contradicts instrumented logging, the log wins; recapture or confirm with the
  user before concluding.
- Acceptance criteria marked `(human review)` MUST be confirmed by the user, not self-certified.

Rationale: each of these rules was learned from a wrong diagnosis recorded in
`context/impl/dead-ends.md`.

## Platform and Technical Constraints

- **Platform**: Omarchy 4 plugin, manifest `schemaVersion` 1, kind `bar-widget`, entry point
  `BarWidget.qml`, category `Info`, single instance, default section `center`. The id namespace is
  `io.github.alecszaharia.*`; the `omarchy.*` prefix is reserved and MUST NOT be used.
- **Stack**: QML on Quickshell and Qt 6; plain JavaScript QML resources (`Model.js`,
  `data/Outlines.js`); `curl` for HTTP. No build step and no bundler in the shipped package.
- **Data source**: Open-Meteo forecast API, keyless and non-commercial. The attribution "Weather
  data by Open-Meteo.com" MUST appear in the popup and in `README.md`.
- **Basemap data**: simplified Natural Earth 50m vectors bundled as `data/Outlines.js`, which is
  generated by `tools/build-outlines.py` and MUST NOT be hand-edited. Its source and public-domain
  status MUST be credited in `README.md`.
- **Cache**: `$XDG_STATE_HOME/omarchy/cloud-radar/model.json` (falling back to `~/.local/state`),
  written atomically and versioned via `CACHE_VERSION`. A shape change MUST bump the version so old
  caches are rejected rather than misread. A corrupt cache MUST be ignored and a failed cache write
  MUST NOT be fatal.
- **License**: MIT. The manifest's license MUST match `LICENSE`.

## Development Workflow and Quality Gates

- **Source of truth**: Spec Kit leads all new work (`/speckit-specify` → `/speckit-plan` →
  `/speckit-tasks` → `/speckit-implement`). The approved design
  (`context/refs/approved-design-cloud-radar.md`) and the Cavekit kits in `context/kits/` are frozen
  as the record of the shipped baseline and MUST NOT receive new requirements.
- **Baseline changes**: a spec that alters baseline behaviour MUST cite the kit requirement it
  supersedes (e.g. "supersedes cavekit-map-rendering.md R5"). Where they conflict, the newer spec
  wins over the kit, and this constitution wins over both.
- **Prior art**: before choosing a rendering, testing or shell-integration approach, read
  `context/impl/dead-ends.md` and do not retry a recorded dead end without new evidence.
- **Gate**: `./scripts/check.sh` (plugin validator, `qmllint`, node tests, symlink sweep) MUST pass
  before any change is committed or reported complete. Skipped or failing checks MUST be reported
  as such.
- **Documentation**: a change to a setting, documented constant, request budget, installation or
  attribution MUST update `README.md` and/or `docs/` in the same change.
- **Scope of change**: changes MUST be the minimum needed; new abstractions require a concrete
  problem they solve and, if major, the maintainer's agreement first.

## Governance

- This constitution supersedes all other project guidance: specs, plans, kits, `context/` notes
  and agent instructions. Conflicts MUST be resolved in favour of this document or fixed by an
  amendment.
- **Amendments** are made through `/speckit-constitution`, MUST update the Sync Impact Report,
  and MUST land in their own commit whose message states the version change.
- **Versioning** follows semantic versioning: MAJOR for removing or redefining a principle or
  invariant; MINOR for adding a principle or section or materially expanding guidance; PATCH for
  clarifications and wording.
- **Compliance**: every `plan.md` MUST pass its Constitution Check against Principles I–VI before
  research and again after design. Any deviation MUST be justified in the plan's Complexity Tracking
  table, listing the simpler alternative that was rejected; a deviation from Principle I is not
  justifiable there and requires an amendment instead.
- **Review**: `/speckit-analyze` findings that conflict with this constitution are blocking.
  Runtime development guidance lives in `README.md`, `docs/`, and `context/impl/dead-ends.md`.

**Version**: 1.0.0 | **Ratified**: 2026-09-10 | **Last Amended**: 2026-09-10
