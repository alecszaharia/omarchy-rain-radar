import QtQuick
import "Model.js" as Model

// Cloud cover heatmap — cavekit-map-rendering.md R3.
//
// The readings are grid-point samples, so the layer paints a bilinearly
// interpolated field rather than 108 flat tiles: at popup size a tiled draw
// shows the sampling lattice instead of the weather. One neutral colour
// throughout, varying only in opacity.
Canvas {
  id: root

  // The published grid model, or null before the first result.
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
    var red = Model.CLOUD_RGB.r
    var green = Model.CLOUD_RGB.g
    var blue = Model.CLOUD_RGB.b

    for (var y = 0; y < h; y++) {
      // Pixel centres, so the field is sampled where the pixel actually sits.
      var v = (y + 0.5) / h
      var rowOffset = y * w * 4
      for (var x = 0; x < w; x++) {
        var u = (x + 0.5) / w
        var value = Model.sampleCloudField(cells, u, v)

        // Unavailable areas are left to the distinct treatment in T-040 rather
        // than being painted as clear sky here.
        var alpha = (value === Model.UNAVAILABLE) ? 0 : Model.cloudOpacity(value)

        var index = rowOffset + x * 4
        data[index] = red
        data[index + 1] = green
        data[index + 2] = blue
        data[index + 3] = Math.round(alpha * 255)
      }
    }

    ctx.putImageData(image, 0, 0)
  }
}
