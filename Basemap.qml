import QtQuick
import "Model.js" as Model
import "data/Outlines.js" as Outlines

// Bundled country outlines beneath the data layers — cavekit-map-rendering.md R2.
//
// The geometry is a QML .js resource, so it is part of the compilation unit:
// drawing it reads no file and issues no network request. Every stroke uses the
// bar's foreground colour, varied only in width and opacity, which is what
// keeps the map legible under both light and dark themes.
Canvas {
  id: root

  // Bar foreground, injected by the panel. Outlines are drawn in this colour at
  // the opacities the emphasis rule prescribes.
  property color strokeColor: "transparent"

  // Repaint whenever the size or the theme colour changes: the projection is
  // re-derived from the current size on every paint, so a resize needs nothing
  // but a fresh pass.
  onWidthChanged: requestPaint()
  onHeightChanged: requestPaint()
  onStrokeColorChanged: requestPaint()

  function tracePath(ctx, ring) {
    for (var i = 0; i < ring.length; i += 2) {
      var point = Model.projectPoint(ring[i], ring[i + 1], root.width, root.height)
      if (i === 0) ctx.moveTo(point.x, point.y)
      else ctx.lineTo(point.x, point.y)
    }
    ctx.closePath()
  }

  onPaint: {
    var ctx = getContext("2d")
    ctx.reset()
    if (root.width <= 0 || root.height <= 0) return

    ctx.lineJoin = "round"
    ctx.lineCap = "round"

    var regions = Outlines.OUTLINES.regions
    // Water first, then the neighbours, then Moldova, so the emphasized outline
    // is never overdrawn by a neighbour sharing its border.
    var order = ["water", "neighbour", "emphasis"]
    for (var pass = 0; pass < order.length; pass++) {
      for (var r = 0; r < regions.length; r++) {
        var region = regions[r]
        var band = region.kind === "water" ? "water"
                 : (region.emphasis === true ? "emphasis" : "neighbour")
        if (band !== order[pass]) continue

        var style = Model.basemapStyle(region)
        ctx.globalAlpha = style.opacity
        ctx.lineWidth = style.lineWidth
        ctx.strokeStyle = root.strokeColor
        ctx.fillStyle = root.strokeColor

        for (var g = 0; g < region.rings.length; g++) {
          ctx.beginPath()
          tracePath(ctx, region.rings[g])
          if (style.filled) ctx.fill()
          ctx.stroke()
        }
      }
    }

    drawCenterMarker(ctx)
    ctx.globalAlpha = 1.0
  }

  // The Chisinau marker, at the projected centre coordinate. Drawn last so it
  // sits above every outline, and drawn as geometry rather than a label — the
  // map carries no place names at all.
  function drawCenterMarker(ctx) {
    var point = Model.projectPoint(Model.GRID_CENTER.lon, Model.GRID_CENTER.lat,
                                   root.width, root.height)

    ctx.globalAlpha = 1.0
    ctx.strokeStyle = root.strokeColor
    ctx.fillStyle = root.strokeColor

    ctx.beginPath()
    ctx.arc(point.x, point.y, Model.MARKER_DOT_RADIUS, 0, 2 * Math.PI)
    ctx.fill()

    ctx.lineWidth = Model.MARKER_RING_WIDTH
    ctx.beginPath()
    ctx.arc(point.x, point.y, Model.MARKER_RING_RADIUS, 0, 2 * Math.PI)
    ctx.stroke()
  }
}
