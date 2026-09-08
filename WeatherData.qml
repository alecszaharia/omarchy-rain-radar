import QtQuick
import Quickshell
import Quickshell.Io
import "Model.js" as Model

// The weather data service — cavekit-weather-data.md R2, R3, R6.
//
// Owns the single outbound request per refresh, the published grid model and
// the observable status. Scheduling, caching and staleness layer on from T-022
// onward; this file establishes the fetch itself and its failure bound.
QtObject {
  id: root

  // The refreshMinutes value from the widget's settings, injected by the
  // panel. Read through Model.effectiveRefreshMinutes wherever it is used.
  property var refreshMinutesSetting: undefined

  // The grid model currently on screen. A failed refresh leaves it alone.
  property var gridModel: null

  readonly property WeatherStatus statusState: WeatherStatus {}
  readonly property string status: statusState.status

  readonly property bool fetching: fetchProcess.running

  // Starts a refresh. Returns false when one is already in flight, so two
  // callers can never put two requests on the wire; T-037 builds the manual
  // refresh path on top of this guard.
  function refresh() {
    if (fetchProcess.running) return false
    statusState.apply(Model.statusOnAttemptStart(statusState.snapshot(), new Date()))
    fetchProcess.command = Model.fetchCommand()
    fetchProcess.running = true
    return true
  }

  // The manual path, used by the popup's refresh control. It is deliberately
  // the same single-flight guard as the scheduled path rather than a second
  // entry point: pressing refresh twice while a fetch is running coalesces onto
  // the one already on the wire instead of starting another.
  //
  // Returns true when this call is the one that started a request.
  function requestManualRefresh() {
    return root.refresh()
  }

  // Failed attempts in the current refresh cycle. Reset whenever a cycle ends,
  // so a bad patch of network does not shorten the next cycle's allowance.
  property int failedAttempts: 0

  function applyFailure(text) {
    statusState.apply(Model.statusOnFailure(statusState.snapshot(), text, new Date()))

    root.failedAttempts += 1
    var decision = Model.retryDecision(root.failedAttempts)
    if (decision.retry) {
      retryTimer.interval = decision.delayMs
      retryTimer.running = true
    } else {
      // Out of retries: stay quiet until the next scheduled interval.
      root.failedAttempts = 0
    }
  }

  // The wait a rate limit imposes, at least twice the configured interval.
  readonly property int rateLimitBackoffMs: Model.rateLimitBackoffMs(root.refreshIntervalMs)

  function applyRateLimit() {
    statusState.apply(Model.statusOnFailure(statusState.snapshot(),
                                            Model.httpFailureText(Model.RATE_LIMIT_STATUS),
                                            new Date()))
    // Ordinary retries are abandoned: they would land inside the same window.
    root.failedAttempts = 0
    retryTimer.running = false

    backoffTimer.interval = root.rateLimitBackoffMs
    backoffTimer.running = true
  }

  property Timer backoffTimer: Timer {
    repeat: false
    running: false
    onTriggered: root.refresh()
  }

  property Timer retryTimer: Timer {
    repeat: false
    running: false
    onTriggered: root.refresh()
  }

  function applyResponse(rawText, completedAt) {
    var response = Model.parseFetchOutput(rawText)

    // A rate-limit rejection is not an ordinary failure: retrying into the same
    // limit would make it worse, so the cycle backs off well past it instead.
    if (Model.isRateLimited(response.httpCode)) {
      root.applyRateLimit()
      return
    }

    if (!Model.isSuccessStatus(response.httpCode)) {
      root.applyFailure(Model.httpFailureText(response.httpCode))
      return
    }

    var parsed = Model.parseGridModel(response.body, completedAt)
    // The previously published model survives a failed parse.
    root.gridModel = Model.nextPublishedModel(root.gridModel, parsed)
    if (parsed.model) {
      statusState.apply(Model.statusOnSuccess(statusState.snapshot(), completedAt))
      // A success ends the cycle, so the next failure starts from a full
      // retry allowance.
      root.failedAttempts = 0
      retryTimer.running = false
      backoffTimer.running = false
      root.evaluateStaleness()
      // Persist after publishing, never before: the screen must not wait on
      // the disk, and a write failure must not hold back a good model.
      root.writeCache(parsed.model)
    } else {
      root.applyFailure(parsed.errorText)
    }
  }

  property Process fetchProcess: Process {
    id: fetchProcess

    stdout: StdioCollector {
      waitForEnd: true
      onStreamFinished: root.applyResponse(String(text || ""), new Date())
    }

    // A non-zero exit is a transport failure or curl's own timeout firing, and
    // no body will follow. Reaching the error status from here is what keeps a
    // stalled request from parking the widget in `loading`.
    onExited: function(exitCode, exitStatus) {
      if (exitCode !== 0) root.applyFailure(Model.fetchFailureText(exitCode))
    }
  }

  // ---- Cache (R5) --------------------------------------------------------
  // Written after every success so a restart shows a map immediately. A write
  // failure is logged and dropped: the model on screen and the next scheduled
  // refresh must not depend on the disk being writable.

  readonly property string stateRoot:
    (Quickshell.env("XDG_STATE_HOME") || (Quickshell.env("HOME") + "/.local/state"))
  readonly property string cachePath: stateRoot + "/" + Model.CACHE_RELATIVE_PATH

  function writeCache(model) {
    if (!model) return false
    try {
      cacheFile.setText(Model.serializeCache(model))
      return true
    } catch (e) {
      console.warn("cloud-radar: could not write the cache at", root.cachePath, e)
      return false
    }
  }

  property FileView cacheFile: FileView {
    path: root.cachePath
    // Watched, because a bar exists per monitor and so does this service. When
    // one instance writes a result the others pick it up here instead of
    // fetching the same 109 points again.
    watchChanges: true
    onFileChanged: reload()
    // The state file is rewritten whole on every success, so a torn write
    // would leave an unreadable cache behind.
    atomicWrites: true
    printErrors: false

    onSaveFailed: function(error) {
      // Non-fatal by design: log it and carry on with the model in memory.
      console.warn("cloud-radar: cache write failed at", root.cachePath, error)
    }

    // Startup restore. A cache that parses gives the popup a map before any
    // network result; one that does not is ignored in silence.
    onLoaded: root.restoreFromCache(text())
    onLoadFailed: root.noteCacheUnreadable()
  }

  // ---- Cache restore (R5) ------------------------------------------------

  // True once a cache read has been attempted, however it turned out, so the
  // load-time refresh decision in T-036 knows the answer is in.
  property bool cacheChecked: false

  function noteCacheUnreadable() {
    // No cache, or an unreadable one: startup proceeds as if none existed. This
    // is deliberately not an error — nothing has been fetched yet to fail.
    root.cacheChecked = true
  }

  function restoreFromCache(rawText) {
    root.cacheChecked = true
    var restored = Model.deserializeCache(rawText)
    if (!restored) return false

    // A peer's result arrives through this file, so a cached model is adopted
    // when it is newer than what is on screen — but never when it is older,
    // which is what keeps our own fresher fetch from being undone.
    if (root.gridModel) {
      var current = Model.parseDataTime(root.gridModel.fetchedAt)
      var candidate = Model.parseDataTime(restored.fetchedAt)
      if (!candidate || (current && candidate.getTime() <= current.getTime())) return false
    }

    root.gridModel = restored
    // Staleness is applied in T-039; a restored model starts as ready, dated
    // from when it was actually fetched rather than from now.
    statusState.apply(Model.statusOnSuccess(statusState.snapshot(),
                                            Model.parseDataTime(restored.fetchedAt)))
    // A restored model may already be old enough to be stale.
    root.evaluateStaleness()
    return true
  }

  // ---- Load-time decision (R4) -------------------------------------------
  // Runs once the cache read has answered, whichever way it went. A restart
  // inside one interval spends no request: the schedule resumes from the
  // cached fetch time rather than from now.

  property bool startupHandled: false

  onCacheCheckedChanged: root.handleStartup()

  function handleStartup() {
    if (root.startupHandled || !root.cacheChecked) return
    root.startupHandled = true

    var decision = Model.loadTimeDecision(root.gridModel, new Date(), root.refreshIntervalMs)
    // Resume the repeating schedule at the cached model's own due time, then
    // let it settle back to the full interval on the next tick.
    resumeTimer.interval = Math.max(1, decision.nextFetchDelayMs)
    resumeTimer.running = !decision.fetchNow
    if (decision.fetchNow) root.refresh()
  }

  // One-shot catch-up timer for a cache that was still fresh at load.
  property Timer resumeTimer: Timer {
    repeat: false
    running: false
    onTriggered: root.refresh()
  }

  // ---- Staleness (R5, R6) ------------------------------------------------
  // Age is not an event, so this is re-evaluated on a tick as well as after
  // every fetch and restore.

  readonly property int staleAfterMs: Model.staleAfterMs(root.refreshIntervalMs)

  function evaluateStaleness() {
    if (!root.gridModel) return
    // A fetch in progress owns the status until it resolves.
    if (statusState.status === Model.STATUS.loading) return

    // Precedence lives in Model.resolveStatus: while the most recent attempt
    // has failed the status stays error even if the model is also stale.
    var next = Model.resolveStatus(root.gridModel, new Date(), root.refreshIntervalMs,
                                   statusState.status === Model.STATUS.error)
    if (statusState.status !== next) statusState.set(next)
  }

  property Timer stalenessTimer: Timer {
    interval: 30000
    repeat: true
    running: true
    onTriggered: root.evaluateStaleness()
  }

  // ---- Scheduling (R4) ---------------------------------------------------
  // The interval is a binding on the setting, so editing refreshMinutes
  // re-evaluates it and QML restarts the timer on the new period. That is what
  // makes a setting change take effect without a shell restart.

  readonly property int refreshIntervalMs: Model.refreshIntervalMs(root.refreshMinutesSetting)
  readonly property int effectiveRefreshMinutes: Model.effectiveRefreshMinutes(root.refreshMinutesSetting)

  // Bars exist per monitor, so this service does too. Offsetting each
  // instance's period keeps their ticks from landing together: the first to
  // fire fetches and writes the cache, and the others then see a model that is
  // already fresh and stand down. One fetch per interval across all monitors
  // rather than one per monitor.
  readonly property int scheduleOffsetMs: Math.round(Math.random() * 45000)

  // A scheduled tick refreshes only if the model is actually due. The same
  // rule the load-time decision uses, so there is one definition of "due".
  function refreshIfDue() {
    if (!Model.loadTimeDecision(root.gridModel, new Date(), root.refreshIntervalMs).fetchNow) return false
    return root.refresh()
  }

  property Timer refreshTimer: Timer {
    interval: root.refreshIntervalMs + root.scheduleOffsetMs
    repeat: true
    running: true
    // The first fetch is decided by the load-time rule in T-036, not by the
    // timer, so this only drives the repeating schedule.
    triggeredOnStart: false
    onTriggered: root.refreshIfDue()
  }
}
