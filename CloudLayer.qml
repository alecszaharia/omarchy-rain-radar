import QtQuick
import "Model.js" as Model

// Cloud cover heatmap — cavekit-map-rendering.md R3.
//
// Painted at a small fixed raster and scaled up by the scene graph rather than
// at one pixel per device pixel. The readings are only a 12x9 lattice, so a
// device-resolution raster is wasted work — and an expensive one: writing into
// a canvas pixel buffer from QML costs enough per element that a full-size
// paint pegs the shell rather than merely dropping a frame.
//
// `smooth: true` makes the upscale linear, which is the same bilinear blend
// done on the GPU for free.
Item {
  id: root

  property var gridModel: null
  property color hatchColor: "transparent"

  Canvas {
    id: canvas
    width: Model.FIELD_RASTER_WIDTH
    height: Model.FIELD_RASTER_HEIGHT
    smooth: true
    antialiasing: true

    // Scale the small raster up to fill the map area.
    transform: Scale {
      xScale: root.width > 0 ? root.width / canvas.width : 1
      yScale: root.height > 0 ? root.height / canvas.height : 1
    }

    onGridModelChanged: requestPaint()
    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()

      var w = canvas.width
      var h = canvas.height
      if (!root.gridModel || !root.gridModel.cells) return

      var image = ctx.createImageData(w, h)
      Model.paintCloudField(root.gridModel.cells, w, h, image.data, Model.CLOUD_RGB, {
        r: Math.round(root.hatchColor.r * 255),
        g: Math.round(root.hatchColor.g * 255),
        b: Math.round(root.hatchColor.b * 255)
      })
      ctx.putImageData(image, 0, 0)
    }

    property var gridModel: root.gridModel
    property color hatchColor: root.hatchColor
    onHatchColorChanged: requestPaint()
  }
}
