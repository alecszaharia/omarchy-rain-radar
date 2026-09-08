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

  // Theme foreground, used for the unavailable hatch so it reads as chrome
  // rather than as weather.
  property color hatchColor: "transparent"

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()
  onHatchColorChanged: requestPaint()

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
    var hatchRed = Math.round(root.hatchColor.r * 255)
    var hatchGreen = Math.round(root.hatchColor.g * 255)
    var hatchBlue = Math.round(root.hatchColor.b * 255)

    for (var y = 0; y < h; y++) {
      // Pixel centres, so the field is sampled where the pixel actually sits.
      var v = (y + 0.5) / h
      var rowOffset = y * w * 4
      for (var x = 0; x < w; x++) {
        var u = (x + 0.5) / w
        var index = rowOffset + x * 4

        // A cell with no reading is hatched in the theme foreground instead of
        // being placed anywhere on the cloud ramp.
        if (Model.isUnavailableAt(cells, u, v)) {
          data[index] = hatchRed
          data[index + 1] = hatchGreen
          data[index + 2] = hatchBlue
          data[index + 3] = Math.round(Model.hatchAlphaAt(x, y) * 255)
          continue
        }

        var value = Model.sampleCloudField(cells, u, v)
        var alpha = (value === Model.UNAVAILABLE) ? 0 : Model.cloudOpacity(value)

        data[index] = red
        data[index + 1] = green
        data[index + 2] = blue
        data[index + 3] = Math.round(alpha * 255)
      }
    }

    ctx.putImageData(image, 0, 0)
  }
}
