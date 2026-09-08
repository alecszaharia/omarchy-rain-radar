import QtQuick
import "Model.js" as Model

// The single observable status for Cloud Radar — cavekit-weather-data.md R6.
//
// `status` holds exactly one Model.STATUS value at any instant. It is a QML
// property, so every write emits statusChanged and consumers that bind to it
// (the popup's status presentation, the bar glyph) are notified on every
// transition without any explicit subscription.
//
// Writes go through set() so an invalid value can never become current.
QtObject {
  id: root

  property string status: Model.STATUS.loading

  // Timestamps and error text that travel with the status. Null means "never
  // happened yet" rather than the epoch, so consumers can tell the difference.
  property var lastSuccessAt: null
  property var lastAttemptAt: null
  property string lastErrorText: ""

  // Returns true when the transition was applied. An unknown value is refused
  // and logged rather than silently coerced, so a typo in a caller surfaces
  // instead of parking the widget in a bogus state.
  function set(next) {
    if (!Model.isStatus(next)) {
      console.warn("cloud-radar: refusing invalid status:", next)
      return false
    }
    root.status = next
    return true
  }
}
