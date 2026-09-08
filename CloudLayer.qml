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

  // The geographic window currently on screen (Model.viewportFor).
  property var viewport: null

  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onGridModelChanged: requestPaint()
  onHatchColorChanged: requestPaint()
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
    // Edges are rounded to whole pixels and each rectangle runs to where the
    // next one starts, so the grid tiles exactly. Drawing them a pixel larger
    // instead makes every seam composite twice, which prints the lattice
    // across the field.
    var edgeX = new Array(columns + 1)
    for (var ex = 0; ex <= columns; ex++) edgeX[ex] = Math.round(ex * root.width / columns)
    var edgeY = new Array(rows + 1)
    for (var ey = 0; ey <= rows; ey++) edgeY[ey] = Math.round(ey * root.height / rows)

    for (var ry = 0; ry < rows; ry++) {
      // Vertical term resolved once per row rather than once per rectangle.
      var gv = Model.viewToGridV((ry + 0.5) / rows, root.viewport)
      var y = edgeY[ry]
      var h = edgeY[ry + 1] - y

      for (var rx = 0; rx < columns; rx++) {
        var gu = Model.viewToGridU((rx + 0.5) / columns, root.viewport)
        var x = edgeX[rx]
        var w = edgeX[rx + 1] - x

        if (Model.isUnavailableAt(cells, gu, gv)) {
          // Documented distinct treatment: stripes in the theme foreground,
          // stepped at rect granularity rather than per pixel.
          var hatch = Model.hatchAlphaAt(Math.round(x), Math.round(y))
          if (hatch <= 0) continue
          ctx.globalAlpha = hatch
          ctx.fillStyle = root.hatchColor
          ctx.fillRect(x, y, w, h)
          continue
        }

        var value = Model.sampleCloudField(cells, gu, gv)
        if (value === Model.UNAVAILABLE) continue

        var alpha = Model.cloudOpacity(value)
        if (alpha <= 0) continue

        ctx.globalAlpha = alpha
        ctx.fillStyle = Model.CLOUD_COLOR
        ctx.fillRect(x, y, w, h)
      }
    }
    ctx.globalAlpha = 1.0
  }
}
