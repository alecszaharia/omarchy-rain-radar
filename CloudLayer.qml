import QtQuick
import "Model.js" as Model

// Cloud cover heatmap — cavekit-map-rendering.md R3.
//
// One neutral colour at varying opacity, never a varying hue. Cells are drawn
// from the projection's own rectangles, so the layer lines up with the grid
// exactly; T-031 replaces the per-cell fill with an interpolated field.
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
    if (root.width <= 0 || root.height <= 0) return
    if (!root.gridModel || !root.gridModel.cells) return

    var rects = Model.cellRects(root.width, root.height)
    var cells = root.gridModel.cells
    ctx.fillStyle = Model.CLOUD_COLOR

    for (var i = 0; i < cells.length && i < rects.length; i++) {
      var value = cells[i].cloudCoverPercent
      // Unavailable cells are left to the distinct treatment in T-040 rather
      // than being drawn as clear sky here.
      if (value === Model.UNAVAILABLE) continue

      var alpha = Model.cloudOpacity(value)
      if (alpha <= 0) continue

      ctx.globalAlpha = alpha
      var rect = rects[i]
      ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
    }
    ctx.globalAlpha = 1.0
  }
}
