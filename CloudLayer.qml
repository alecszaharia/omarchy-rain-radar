import QtQuick
import "Model.js" as Model

// Cloud cover heatmap — cavekit-map-rendering.md R3.
//
// The readings are grid-point samples, so the layer paints a bilinearly
// interpolated field rather than 108 flat tiles. The interpolation itself lives
// in Model.paintCloudField, which fills the canvas buffer in one call: sampling
// per pixel from QML allocates per pixel and is far too slow to land a paint.
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

    var image = ctx.createImageData(w, h)
    Model.paintCloudField(root.gridModel.cells, w, h, image.data, Model.CLOUD_RGB, {
      r: Math.round(root.hatchColor.r * 255),
      g: Math.round(root.hatchColor.g * 255),
      b: Math.round(root.hatchColor.b * 255)
    })
    ctx.putImageData(image, 0, 0)
  }
}
