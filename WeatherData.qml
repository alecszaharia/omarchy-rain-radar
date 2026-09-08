import QtQuick
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
}
