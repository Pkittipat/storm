/** One block, several blocks (box selection or Shift+click), or one connection. */
export type Selection = { type: 'block'; id: string } | { type: 'blocks'; ids: string[] } | { type: 'connection'; id: string } | null

export const selectedBlockIds = (s: Selection): string[] => (s?.type === 'block' ? [s.id] : s?.type === 'blocks' ? s.ids : [])

/** Normalises a set of block ids into a selection: none, one block, or several. */
export const selectBlocks = (ids: string[]): Selection => (ids.length === 0 ? null : ids.length === 1 ? { type: 'block', id: ids[0] } : { type: 'blocks', ids })
