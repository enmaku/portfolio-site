/** Minimum distance (in grid cells) from any map edge for generated nodes. */
export const NODE_MAP_EDGE_MARGIN = 10

/**
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {number} [margin]
 */
export function isNodePlacementCellAllowed(
  x,
  y,
  width,
  height,
  margin = NODE_MAP_EDGE_MARGIN,
) {
  if (width < margin * 2 || height < margin * 2) {
    return false
  }
  return x >= margin && y >= margin && x < width - margin && y < height - margin
}
