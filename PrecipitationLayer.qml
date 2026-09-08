import QtQuick
import "Model.js" as Model

// Precipitation overlay — cavekit-map-rendering.md R4.
//
// Same rasterisation as the cloud layer, and for the same reason. The amount is
// interpolated first and banded afterwards, so a band edge follows the data
// rather than the sampling lattice.
Canvas {
  id: root

  property var gridModel: null

  // The geographic window currently on screen (Model.viewportFor).
  property var viewport: null

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()
  onViewportChanged: requestPaint()
  onAvailableChanged: if (available) requestPaint()
  // The popup is closed when this layer is built, and a Canvas can drop a
  // paint requested while it is hidden. The data behind it changes only once
  // per refresh interval, so without this the first request is also the last.
  onVisibleChanged: if (visible) requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (root.width <= 0 || root.height <= 0 || !root.viewport) return
    if (!root.gridModel || !root.gridModel.cells) return

    var cells = root.gridModel.cells
    var columns = Model.FIELD_RECT_COLUMNS
    var rows = Model.FIELD_RECT_ROWS
    var rectWidth = root.width / columns
    var rectHeight = root.height / rows

    ctx.fillStyle = Model.PRECIPITATION_COLOR

    for (var ry = 0; ry < rows; ry++) {
      var gv = Model.viewToGridV((ry + 0.5) / rows, root.viewport)
      for (var rx = 0; rx < columns; rx++) {
        var gu = Model.viewToGridU((rx + 0.5) / columns, root.viewport)

        // A cell with no amount of its own draws nothing; a neighbour's amount
        // must not be interpolated into it.
        if (Model.isPrecipitationUnavailableAt(cells, gu, gv)) continue

        var band = Model.precipitationBand(Model.samplePrecipitationField(cells, gu, gv))
        if (band.opacity <= 0) continue

        ctx.globalAlpha = band.opacity
        ctx.fillRect(rx * rectWidth, ry * rectHeight, rectWidth + 1, rectHeight + 1)
      }
    }
    ctx.globalAlpha = 1.0
  }
}
