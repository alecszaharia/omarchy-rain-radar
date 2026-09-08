import QtQuick
import "Model.js" as Model

// The Chisinau marker — cavekit-map-rendering.md R2.
//
// Its own layer, drawn above the cloud heatmap: at high cover the cloud layer
// is opaque, so a marker painted with the basemap would disappear exactly when
// the map is most worth reading.
Canvas {
  id: root

  property color markerColor: "transparent"

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onMarkerColorChanged: requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (root.width <= 0 || root.height <= 0) return

    var point = Model.projectPoint(Model.GRID_CENTER.lon, Model.GRID_CENTER.lat,
                                   root.width, root.height)

    ctx.strokeStyle = root.markerColor
    ctx.fillStyle = root.markerColor

    ctx.beginPath()
    ctx.arc(point.x, point.y, Model.MARKER_DOT_RADIUS, 0, 2 * Math.PI)
    ctx.fill()

    ctx.lineWidth = Model.MARKER_RING_WIDTH
    ctx.beginPath()
    ctx.arc(point.x, point.y, Model.MARKER_RING_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()
  }
}
