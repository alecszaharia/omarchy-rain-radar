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

  // Theme values lifted off the bar once so every child binds to the same
  // source. barForeground comes from the Panel base and tracks bar.barForeground,
  // so a theme change propagates through these bindings without any reload.
  // The data service, injected by the bar widget. Held as the service itself so
  // these stay live bindings rather than values copied once at injection.
  property var weather: null
  readonly property var gridModel: weather ? weather.gridModel : null
  readonly property string dataStatus: weather ? weather.status : Model.STATUS.loading
  readonly property string dataErrorText: weather ? weather.statusState.lastErrorText : ""
  readonly property var statusPresentation: Model.statusPresentation(root.dataStatus)
  readonly property bool refreshing: weather ? weather.fetching : false

  // View state, deliberately not a setting: the plugin declares exactly one,
  // and how far the map is zoomed is not worth persisting.
  property real zoom: Model.ZOOM_MIN
  readonly property var viewport: Model.viewportFor(root.zoom)
  readonly property bool canZoomIn: root.zoom < Model.ZOOM_MAX
  readonly property bool canZoomOut: root.zoom > Model.ZOOM_MIN

  function zoomBy(steps) {
    root.zoom = Model.clampZoom(root.zoom + steps * Model.ZOOM_STEP)
  }

  // The popup's refresh control goes through the service's single-flight guard,
  // so pressing it during a fetch coalesces onto the request already running
  // rather than starting another.
  function requestRefresh() {
    if (!weather) return false
    return weather.requestManualRefresh()
  }

  readonly property color foregroundColor: root.barForeground
  readonly property string themeFontFamily: root.bar ? root.bar.fontFamily : ""

  function switchPanel(direction) {
    if (root.bar && typeof root.bar.switchPanelFrom === "function")
      return root.bar.switchPanelFrom(root.barIdentity, direction)
    return false
  }

  // One definition for the popup's three buttons; they differ only in label,
  // whether they are actionable, and what they do.
  component PillButton: Rectangle {
    id: pill

    property alias label: pillLabel.text
    property bool actionable: true
    signal activated()

    width: pillLabel.implicitWidth + Style.space(16)
    height: pillLabel.implicitHeight + Style.space(8)
    radius: Style.space(4)
    color: pillArea.containsMouse && pill.actionable
      ? Style.hoverFillFor(root.foregroundColor, Color.accent)
      : "transparent"
    border.width: 1
    border.color: root.foregroundColor
    opacity: pill.actionable ? 1.0 : 0.4

    Text {
      id: pillLabel
      anchors.centerIn: parent
      color: root.foregroundColor
      font.family: root.themeFontFamily
      font.pixelSize: Style.font.bodySmall
    }

    MouseArea {
      id: pillArea
      anchors.fill: parent
      hoverEnabled: true
      cursorShape: Qt.PointingHandCursor
      onClicked: if (pill.actionable) pill.activated()
    }
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
          color: root.foregroundColor
          font.family: root.themeFontFamily
          font.pixelSize: Style.font.body
        }

        // The map surface. Cloud heatmap, precipitation overlay, the Chisinau
        // marker, legends and the status block layer in from T-023 onward.
        Item {
          id: mapArea
          width: parent.width
          height: Math.round(width / Model.MAP_ASPECT)

          // Layer order: outlines, the cloud field, the precipitation overlay
          // above it, then the marker on top — at full cover the cloud layer is
          // opaque, so a marker drawn with the basemap would vanish exactly
          // when it matters most.
          Basemap {
            anchors.fill: parent
            viewport: root.viewport
            strokeColor: root.foregroundColor
          }

          CloudLayer {
            anchors.fill: parent
            viewport: root.viewport
            gridModel: root.gridModel
            hatchColor: root.foregroundColor
          }

          PrecipitationLayer {
            anchors.fill: parent
            viewport: root.viewport
            gridModel: root.gridModel
          }

          CenterMarker {
            anchors.fill: parent
            viewport: root.viewport
            markerColor: root.foregroundColor
          }

          // Wheel zoom over the map itself. A handler rather than a MouseArea,
          // so it does not swallow clicks meant for the popup.
          WheelHandler {
            acceptedDevices: PointerDevice.Mouse | PointerDevice.TouchPad
            onWheel: function(event) {
              root.zoomBy(event.angleDelta.y > 0 ? 1 : -1)
            }
          }
        }

        // ---- Controls (R6, R8) ---------------------------------------------

        Row {
          spacing: Style.space(8)

          PillButton {
            label: root.refreshing ? "Refreshing…" : "Refresh"
            actionable: !root.refreshing
            onActivated: root.requestRefresh()
          }

          PillButton {
            label: "\u2212"
            actionable: root.canZoomOut
            onActivated: root.zoomBy(-1)
          }

          PillButton {
            label: "+"
            actionable: root.canZoomIn
            onActivated: root.zoomBy(1)
          }
        }

        // ---- Status (R5) ---------------------------------------------------
        // The map above stays visible in every status; the indicator only says
        // how much to trust it.
        Column {
          width: parent.width
          spacing: Style.space(2)
          visible: root.statusPresentation.showIndicator

          Text {
            text: root.statusPresentation.label
            color: root.foregroundColor
            font.family: root.themeFontFamily
            font.pixelSize: Style.font.bodySmall
          }

          Text {
            text: root.dataErrorText
            visible: root.statusPresentation.showErrorText && text !== ""
            width: parent.width
            wrapMode: Text.WordWrap
            color: root.foregroundColor
            opacity: 0.7
            font.family: root.themeFontFamily
            font.pixelSize: Style.font.bodySmall
          }
        }

        // ---- Legends (R5) ------------------------------------------------

        // Cloud cover: the scale is opacity, so the legend is the same colour
        // ramped from transparent to full, with both ends labelled.
        Row {
          width: parent.width
          spacing: Style.space(8)

          Text {
            id: cloudScaleMin
            text: "0%"
            anchors.verticalCenter: parent.verticalCenter
            color: root.foregroundColor
            font.family: root.themeFontFamily
            font.pixelSize: Style.font.bodySmall
          }

          Rectangle {
            width: parent.width - cloudScaleMin.width - cloudScaleMax.width - Style.space(16)
            height: Style.space(10)
            anchors.verticalCenter: parent.verticalCenter
            radius: Style.space(2)
            // Stops taken from the same curve the map uses, so the key cannot
            // disagree with what is drawn.
            gradient: Gradient {
              orientation: Gradient.Horizontal

              GradientStop { position: 0.0; color: "transparent" }

              Repeater {
                model: Model.cloudLegendStops(6).slice(1)
                GradientStop {
                  position: modelData.position
                  color: Qt.rgba(Model.CLOUD_RGB.r / 255, Model.CLOUD_RGB.g / 255,
                                 Model.CLOUD_RGB.b / 255, modelData.opacity)
                }
              }
            }
          }

          Text {
            id: cloudScaleMax
            text: "100% cloud"
            anchors.verticalCenter: parent.verticalCenter
            color: root.foregroundColor
            font.family: root.themeFontFamily
            font.pixelSize: Style.font.bodySmall
          }
        }

        // Precipitation: one swatch per band at the band's own opacity, each
        // labelled with the millimetre threshold it covers.
        Flow {
          width: parent.width
          spacing: Style.space(10)

          Repeater {
            model: Model.PRECIPITATION_BANDS

            Row {
              spacing: Style.space(4)

              Rectangle {
                width: Style.space(12)
                height: Style.space(10)
                anchors.verticalCenter: parent.verticalCenter
                radius: Style.space(2)
                color: Model.PRECIPITATION_COLOR
                opacity: modelData.opacity
                border.width: modelData.opacity === 0 ? 1 : 0
                border.color: root.foregroundColor
              }

              Text {
                text: Model.precipitationBandName(modelData) + " " + Model.precipitationBandLabel(modelData)
                anchors.verticalCenter: parent.verticalCenter
                color: root.foregroundColor
                font.family: root.themeFontFamily
                font.pixelSize: Style.font.bodySmall
              }
            }
          }
        }

        // Observation time of the model on screen. Empty until the first
        // result carries one, rather than showing a placeholder clock.
        Text {
          text: Model.updatedLabel(root.gridModel ? root.gridModel.dataTime : "")
          visible: text !== ""
          color: root.foregroundColor
          font.family: root.themeFontFamily
          font.pixelSize: Style.font.bodySmall
        }

        // Required by Open-Meteo's terms, shown verbatim.
        Text {
          text: Model.OPEN_METEO_ATTRIBUTION
          color: root.foregroundColor
          opacity: 0.7
          font.family: root.themeFontFamily
          font.pixelSize: Style.font.bodySmall
        }
      }
    }
  }
}
