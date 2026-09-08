import QtQuick
import qs.Commons
import qs.Ui

// Bar entry for Cloud Radar. The bar mounts this widget in a slot; the popup
// map lives in Panel.qml and is loaded lazily beneath it (T-009).
BarWidget {
  id: root
  moduleName: "io.github.alecszaharia.cloud-radar"

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // Placeholder glyph. T-034 replaces this with the condition-driven glyph
    // derived from the center sample.
    text: ""
    slotSize: Style.bar.statusSlot
    tooltipText: "Cloud Radar"
  }
}
