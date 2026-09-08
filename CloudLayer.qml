import QtQuick
import "Model.js" as Model

// Cloud cover heatmap — cavekit-map-rendering.md R3.
//
// Drawn the same way Basemap and CenterMarker are — a full-size Canvas using
// ordinary fill calls — because that is what demonstrably renders in the
// Omarchy shell. Two earlier approaches did not: sampling per device pixel was
// far too slow to land a paint, and writing through createImageData /
// putImageData produced nothing at all.
//
// The field is rasterised into a grid of small rectangles, each filled from the
// bilinear sample at its centre. That is a few thousand fill calls rather than
// hundreds of thousands of buffer writes, and at this rect size the steps are
// well under the gradient's own scale.
Canvas {
  id: root

  property var gridModel: null
  property color hatchColor: "transparent"

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()
  onHatchColorChanged: requestPaint()
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

    for (var ry = 0; ry < rows; ry++) {
      var v = (ry + 0.5) / rows
      var y = ry * rectHeight

      for (var rx = 0; rx < columns; rx++) {
        var u = (rx + 0.5) / columns
        var x = rx * rectWidth

        if (Model.isUnavailableAt(cells, u, v)) {
          // Documented distinct treatment: stripes in the theme foreground,
          // stepped at rect granularity rather than per pixel.
          var hatch = Model.hatchAlphaAt(Math.round(x), Math.round(y))
          if (hatch <= 0) continue
          ctx.globalAlpha = hatch
          ctx.fillStyle = root.hatchColor
          ctx.fillRect(x, y, rectWidth + 1, rectHeight + 1)
          continue
        }

        var value = Model.sampleCloudField(cells, u, v)
        if (value === Model.UNAVAILABLE) continue

        var alpha = Model.cloudOpacity(value)
        if (alpha <= 0) continue

        ctx.globalAlpha = alpha
        ctx.fillStyle = Model.CLOUD_COLOR
        // Overdraw by a pixel so neighbouring rects cannot leave seams.
        ctx.fillRect(x, y, rectWidth + 1, rectHeight + 1)
      }
    }
    ctx.globalAlpha = 1.0
  }
}
