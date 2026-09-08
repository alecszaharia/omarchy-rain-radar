import QtQuick
import "Model.js" as Model

// Precipitation overlay — cavekit-map-rendering.md R4.
//
// Stacked above the cloud field, so wherever both have something to say the
// precipitation is what the viewer sees. One blue, four band opacities; the hue
// never varies, and the "none" band paints nothing at all.
//
// The millimetre amount is interpolated first and banded afterwards, so band
// edges follow the shape of the data rather than the sampling lattice.
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

    var cells = root.gridModel.cells
    var image = ctx.createImageData(w, h)
    var data = image.data
    var red = Model.PRECIPITATION_RGB.r
    var green = Model.PRECIPITATION_RGB.g
    var blue = Model.PRECIPITATION_RGB.b

    for (var y = 0; y < h; y++) {
      var v = (y + 0.5) / h
      var rowOffset = y * w * 4
      for (var x = 0; x < w; x++) {
        var u = (x + 0.5) / w
        // An unavailable amount lands in the "none" band, which draws nothing —
        // unknown precipitation is never shown as precipitation.
        var band = Model.precipitationBand(Model.samplePrecipitationField(cells, u, v))

        var index = rowOffset + x * 4
        data[index] = red
        data[index + 1] = green
        data[index + 2] = blue
        data[index + 3] = Math.round(band.opacity * 255)
      }
    }

    ctx.putImageData(image, 0, 0)
  }
}
