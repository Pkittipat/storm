/** Canvas geometry, in world (unzoomed) pixels, mirroring BlockCard's layout. */
export const BLOCK_WIDTH = 140
/** Eyebrow label (11px × 1.4 line-height) + 4px gap + 104px card. */
export const BLOCK_HEIGHT = 123
/** Vertical centre of the left/right ports, from the block's top-left (eyebrow + top-11.75 + half the 9px dot). */
export const PORT_Y = 71
export const GRID = 20

export const snap = (v: number) => Math.round(v / GRID) * GRID

/** Derived-layout spacing, in world pixels: columns follow the connections, one band of rows per connected group. */
export const LAYOUT = {
  columnWidth: BLOCK_WIDTH + 64,
  rowHeight: BLOCK_HEIGHT + 28,
  groupGap: 48,
  originX: 0,
  originY: 0,
}

export interface Point {
  x: number
  y: number
}

/**
 * A left-to-right cubic curve from a right port to a left port. The handles
 * reach half the horizontal gap, which gives a soft, even S; a larger fixed
 * bend makes short gaps with a big vertical drop hook sharply.
 */
export function connectorPath(from: Point, to: Point): string {
  const bend = Math.max(24, Math.abs(to.x - from.x) / 2)
  return `M ${from.x} ${from.y} C ${from.x + bend} ${from.y}, ${to.x - bend} ${to.y}, ${to.x} ${to.y}`
}
