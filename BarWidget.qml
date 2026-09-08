import QtQuick
import qs.Commons
import qs.Ui
import "Model.js" as Model

// Bar entry for Cloud Radar. The bar mounts this widget in a slot; the popup
// map lives in Panel.qml, loaded beneath this widget so the bar keeps tracking
// the slot item as the popup's identity.
BarWidget {
  id: root
  moduleName: "io.github.alecszaharia.cloud-radar"

  // Hand the loaded panel everything it needs from the bar. Re-run whenever the
  // host injects a new bar or settings object, since the panel is loaded before
  // those necessarily arrive.
  function injectPanel() {
    var target = panelLoader.item
    if (!target) return
    if ("bar" in target) target.bar = root.bar
    if ("settings" in target) target.settings = root.settings
    if ("anchorItem" in target) target.anchorItem = button
    if ("hostWidget" in target) target.hostWidget = root
    // Handed over as the service itself, not as copied values, so the panel's
    // own bindings stay live as the data and status change.
    if ("weather" in target) target.weather = weather
  }

  // The data service lives with the bar entry, which outlives the popup: the
  // glyph has to keep reporting the centre sample whether or not the popup has
  // ever been opened.
  WeatherData {
    id: weather
    refreshMinutesSetting: root.setting("refreshMinutes", undefined)
  }

  function togglePanel() {
    if (panelLoader.item && panelLoader.item.toggle) panelLoader.item.toggle()
  }

  // Shape contract for shell summon/hide routing. Bar.findPanelWidget only
  // considers a slot item that carries open(), close() and opened, and
  // summonBarWidget/hideBarWidget then call them — so the bar-widget root, not
  // the nested panel, has to expose them and forward to the panel.
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false

  function open() {
    if (panelLoader.item && panelLoader.item.open) panelLoader.item.open()
  }

  function close() {
    if (panelLoader.item && panelLoader.item.close) panelLoader.item.close()
  }

  // The bar's popout coordinator prefers closeForPopoutSwitch over close when
  // handing over to another panel, and reads popoutSwitchClosing back off the
  // item it identified — this widget — so both are forwarded too.
  readonly property bool popoutSwitchClosing: panelLoader.item ? panelLoader.item.popoutSwitchClosing === true : false

  function closeForPopoutSwitch() {
    if (panelLoader.item && panelLoader.item.closeForPopoutSwitch) panelLoader.item.closeForPopoutSwitch()
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  onBarChanged: injectPanel()
  onSettingsChanged: injectPanel()

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("Panel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      // The bar may finish wiring itself after the panel loads, so inject once
      // more on the next tick rather than leaving the panel half-connected.
      Qt.callLater(root.injectPanel)
    }
  }

  BarIconButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    // Glyph only — never a percentage, a label or a thumbnail. Empty until a
    // centre reading resolves to a condition, which T-041 gives its own
    // appearance rather than letting unknown data read as clear weather.
    text: Model.barGlyph(weather.gridModel ? weather.gridModel.center : null)
    slotSize: Style.bar.statusSlot
    // Suppressed: the popup is the detail view.
    tooltipText: ""

    onPressed: function(b) { root.togglePanel() }
  }
}
