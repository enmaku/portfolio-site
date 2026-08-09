/**
 * @typedef {{ x: number, y: number }} Point2
 */

/**
 * Rasterize a closed polygon into a cell mask.
 * A cell is filled when its center lies inside the polygon.
 * @param {Uint8Array} mask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Point2[]} vertices
 */
export function fillPolygonMask(mask, gridWidth, gridHeight, vertices) {
  if (vertices.length === 0) return

  if (vertices.length === 1) {
    stampCellFromPoint(mask, gridWidth, gridHeight, vertices[0])
    return
  }

  if (vertices.length === 2) {
    fillPolylineMask(mask, gridWidth, gridHeight, vertices[0], vertices[1])
    return
  }

  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const vertex of vertices) {
    minX = Math.min(minX, vertex.x)
    minY = Math.min(minY, vertex.y)
    maxX = Math.max(maxX, vertex.x)
    maxY = Math.max(maxY, vertex.y)
  }

  const xStart = Math.max(0, Math.floor(minX))
  const yStart = Math.max(0, Math.floor(minY))
  const xEnd = Math.min(gridWidth - 1, Math.floor(maxX))
  const yEnd = Math.min(gridHeight - 1, Math.floor(maxY))

  for (let y = yStart; y <= yEnd; y += 1) {
    for (let x = xStart; x <= xEnd; x += 1) {
      if (isPointInsidePolygon(x + 0.5, y + 0.5, vertices)) {
        mask[y * gridWidth + x] = 1
      }
    }
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {Point2[]} vertices
 * @returns {boolean}
 */
function isPointInsidePolygon(x, y, vertices) {
  let inside = false

  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i, i += 1) {
    const xi = vertices[i].x
    const yi = vertices[i].y
    const xj = vertices[j].x
    const yj = vertices[j].y
    const intersects = yi > y !== yj > y
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }

  return inside
}

/**
 * @param {Uint8Array} mask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Point2} a
 * @param {Point2} b
 */
export function fillPolylineMask(mask, gridWidth, gridHeight, a, b) {
  let x0 = Math.round(a.x - 0.5)
  let y0 = Math.round(a.y - 0.5)
  const x1 = Math.round(b.x - 0.5)
  const y1 = Math.round(b.y - 0.5)
  const dx = Math.abs(x1 - x0)
  const dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1
  const sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (true) {
    if (x0 >= 0 && y0 >= 0 && x0 < gridWidth && y0 < gridHeight) {
      mask[y0 * gridWidth + x0] = 1
    }
    if (x0 === x1 && y0 === y1) break
    const err2 = err * 2
    if (err2 > -dy) {
      err -= dy
      x0 += sx
    }
    if (err2 < dx) {
      err += dx
      y0 += sy
    }
  }
}

/**
 * @param {Uint8Array} mask
 * @param {number} gridWidth
 * @param {number} gridHeight
 * @param {Point2} point
 */
function stampCellFromPoint(mask, gridWidth, gridHeight, point) {
  const x = Math.floor(point.x)
  const y = Math.floor(point.y)
  if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) return
  mask[y * gridWidth + x] = 1
}
