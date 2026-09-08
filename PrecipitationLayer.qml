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

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()
  onAvailableChanged: if (available) requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (root.width <= 0 || root.height <= 0) return
    if (!root.gridModel || !root.gridModel.cells) return

    var cells = root.gridModel.cells
    var columns = Model.FIELD_RECT_COLUMNS
    var rows = Model.FIELD_RECT_ROWS
    var rectWidth = root.width / columns
    var rectHeight = root.height / rows

    ctx.fillStyle = Model.PRECIPITATION_COLOR

    for (var ry = 0; ry < rows; ry++) {
      var v = (ry + 0.5) / rows
      for (var rx = 0; rx < columns; rx++) {
        var u = (rx + 0.5) / columns

        // A cell with no amount of its own draws nothing; a neighbour's amount
        // must not be interpolated into it.
        if (Model.isPrecipitationUnavailableAt(cells, u, v)) continue

        var band = Model.precipitationBand(Model.samplePrecipitationField(cells, u, v))
        if (band.opacity <= 0) continue

        ctx.globalAlpha = band.opacity
        ctx.fillRect(rx * rectWidth, ry * rectHeight, rectWidth + 1, rectHeight + 1)
      }
    }
    ctx.globalAlpha = 1.0
  }
}
