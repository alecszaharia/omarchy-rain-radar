import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

// The Cloud Radar popup — cavekit-map-rendering.md R6.
//
// Loaded beneath BarWidget.qml rather than declared as its own plugin kind, so
// the bar keeps tracking the widget in its slot as the popup's identity. The
// Panel base owns the open/close lifecycle; this file owns the chrome and,
// from T-014 onward, the map itself.
Panel {
  id: root
  moduleName: "io.github.alecszaharia.cloud-radar"
  ipcTarget: "io.github.alecszaharia.cloud-radar"
  // The bar routes summon/hide through the bar-widget root (T-016), so the
  // base's own IpcHandler stays off to avoid two handlers on one target.
  manageIpc: false

  property var anchorItem: null

  // The bar identifies a panel by the widget mounted in its slot, not by this
  // nested panel, so popout coordination has to be told which item that is.
  property var hostWidget: null
  readonly property var barIdentity: hostWidget || root

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    centerOnBar: true
    focusTarget: keyCatcher
    // Both dimensions go through the fitters, which clamp to the free screen
    // area the host reports for this display — that is what keeps the popup
    // inside the screen at 1280x720 rather than relying on the content being
    // small. Width itself matches the built-in weather popup; see
    // docs/rendering.md.
    contentWidth: panel.fittedContentWidth(Style.space(Model.POPUP_CONTENT_WIDTH))
    contentHeight: panel.fittedContentHeight(content.implicitHeight)

    PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent

      // Escape closes the popup. PanelKeyCatcher turns the key press into this
      // signal so the panel keeps its own state machine.
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }

      Column {
        id: content
        width: parent.width
        spacing: Style.space(10)

        Text {
          text: "Cloud Radar"
          color: root.barForeground
          font.family: root.bar ? root.bar.fontFamily : ""
          font.pixelSize: Style.font.body
        }

        // The map surface, legends, timestamp and status block land here in
        // T-014 onward.
        Item {
          width: parent.width
          height: Math.round(width / Model.MAP_ASPECT)
        }
      }
    }
  }
}
