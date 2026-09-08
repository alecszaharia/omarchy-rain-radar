import QtQuick
import "Model.js" as Model

// Precipitation overlay — cavekit-map-rendering.md R4.
//
// Same fixed-raster approach as the cloud layer, and for the same reason.
Item {
  id: root

  property var gridModel: null

  Canvas {
    id: canvas
    width: Model.FIELD_RASTER_WIDTH
    height: Model.FIELD_RASTER_HEIGHT
    smooth: true
    antialiasing: true

    transform: Scale {
      xScale: root.width > 0 ? root.width / canvas.width : 1
      yScale: root.height > 0 ? root.height / canvas.height : 1
    }

    property var gridModel: root.gridModel
    onGridModelChanged: requestPaint()

    onPaint: {
      var ctx = getContext("2d")
      ctx.reset()
      if (!root.gridModel || !root.gridModel.cells) return

      var image = ctx.createImageData(canvas.width, canvas.height)
      Model.paintPrecipitationField(root.gridModel.cells, canvas.width, canvas.height,
                                    image.data, Model.PRECIPITATION_RGB)
      ctx.putImageData(image, 0, 0)
    }
  }
}
