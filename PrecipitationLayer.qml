import QtQuick
import "Model.js" as Model

// Precipitation overlay — cavekit-map-rendering.md R4.
//
// Stacked above the cloud field. One blue, four band opacities; the amount is
// interpolated first and banded afterwards, so band edges follow the data
// rather than the sampling lattice. The raster is filled by
// Model.paintPrecipitationField for the same reason the cloud layer is.
Canvas {
  id: root

  property var gridModel: null

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()

    var w = Math.floor(root.width)
    var h = Math.floor(root.height)
    if (w <= 0 || h <= 0) return
    if (!root.gridModel || !root.gridModel.cells) return

    var image = ctx.createImageData(w, h)
    Model.paintPrecipitationField(root.gridModel.cells, w, h, image.data, Model.PRECIPITATION_RGB)
    ctx.putImageData(image, 0, 0)
  }
}
