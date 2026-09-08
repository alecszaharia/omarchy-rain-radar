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
    statusState.lastAttemptAt = new Date()
    statusState.set(Model.STATUS.loading)
    fetchProcess.command = Model.fetchCommand()
    fetchProcess.running = true
    return true
  }

  function applyFailure(text) {
    statusState.lastErrorText = text
    statusState.set(Model.STATUS.error)
  }

  function applyResponse(rawText, completedAt) {
    var parsed = Model.parseGridModel(rawText, completedAt)
    // The previously published model survives a failed parse.
    root.gridModel = Model.nextPublishedModel(root.gridModel, parsed)
    if (parsed.model) {
      statusState.lastErrorText = ""
      statusState.lastSuccessAt = completedAt
      statusState.set(Model.STATUS.ready)
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
    watchChanges: false
    // The state file is rewritten whole on every success, so a torn write
    // would leave an unreadable cache behind.
    atomicWrites: true
    printErrors: false

    onSaveFailed: function(error) {
      // Non-fatal by design: log it and carry on with the model in memory.
      console.warn("cloud-radar: cache write failed at", root.cachePath, error)
    }
  }

  // ---- Scheduling (R4) ---------------------------------------------------
  // The interval is a binding on the setting, so editing refreshMinutes
  // re-evaluates it and QML restarts the timer on the new period. That is what
  // makes a setting change take effect without a shell restart.

  readonly property int refreshIntervalMs: Model.refreshIntervalMs(root.refreshMinutesSetting)
  readonly property int effectiveRefreshMinutes: Model.effectiveRefreshMinutes(root.refreshMinutesSetting)

  property Timer refreshTimer: Timer {
    interval: root.refreshIntervalMs
    repeat: true
    running: true
    // The first fetch is decided by the load-time rule in T-036, not by the
    // timer, so this only drives the repeating schedule.
    triggeredOnStart: false
    onTriggered: root.refresh()
  }
}
