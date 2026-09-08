# Cloud Radar — documented data-side values

The constants the weather kits require to be documented, and why they are the
values they are. All of them are fixed: the plugin exposes exactly one user
setting, `refreshMinutes`.

## Refresh interval

The only user setting. An integer number of minutes, clamped to 10..120, default
20 (`Model.effectiveRefreshMinutes`). A missing, blank, non-numeric or
non-finite value falls back to 20; booleans and trailing-garbage strings like
`"15min"` are refused rather than coerced.

## Request timeout

`Model.FETCH_TIMEOUT_SECONDS = 20`, passed to curl as `--max-time`.

Deliberately not a setting. It exists so a stalled connection fails the refresh
instead of pinning the widget in `loading` forever, and it is comfortably longer
than a healthy 109-point response takes while staying well inside the shortest
refresh interval, so a request can never outlive its own cycle.

## Retry policy

| Constant | Value |
| --- | --- |
| `Model.FETCH_RETRY_LIMIT` | 2 retries after the initial attempt |
| `Model.FETCH_RETRY_DELAY_MS` | 30000 (30 seconds between attempts) |

A failing cycle therefore makes at most **three** attempts — the first plus two
retries — spread over about a minute, and then goes quiet until the next
scheduled interval. Both numbers are constants rather than settings: the goal is
a bounded amount of noise after a failure, not a knob.

The counter resets on success and when the allowance runs out, so a bad patch of
network never shortens the next cycle's allowance.

## Rate-limit backoff

A rate-limit rejection is handled separately from ordinary failures; see
`Model.rateLimitBackoffMs`.

## Cache

Written to `$XDG_STATE_HOME/omarchy/cloud-radar/model.json`, falling back to
`~/.local/state`. The payload is versioned (`Model.CACHE_VERSION`) so a future
change to the model shape is rejected rather than misread, and it is written
atomically so a torn file cannot be left behind.

A model is **stale** once it is older than twice the configured interval.

## Load-time behaviour

| Cached model | On load |
| --- | --- |
| none, or undatable | fetch immediately |
| younger than one interval | no fetch; next fetch at `fetchedAt + interval` |
| older than one interval | show it, and fetch immediately |

A restart inside one interval therefore spends no request, and the schedule
resumes from the cached fetch time rather than from load.
