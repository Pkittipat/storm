import { newId } from './ids.js'
import { SCHEMA_VERSION, type Block, type BlockKind, type Board, type Connection, type Field } from './model.js'

/**
 * Pure board edits. Each returns a new board (or the same one when nothing changes) and
 * never reuses or changes an existing id, so the file stays diffable.
 */

export function newBoard(name: string, takenBoardIds: Iterable<string> = []): Board {
  return { schemaVersion: SCHEMA_VERSION, id: newId(name, takenBoardIds, 'process'), name, blocks: [], connections: [] }
}

export const renameBoard = (board: Board, name: string): Board => ({ ...board, name })

export const findBlock = (board: Board, id: string): Block | undefined => board.blocks.find((b) => b.id === id)

/** Appends a block. Its id is a slug of the title, unique in the process, and frozen from here on. */
export function addBlock(board: Board, init: { kind: BlockKind; title: string }): { board: Board; blockId: string } {
  const blockId = newId(init.title, board.blocks.map((b) => b.id), init.kind)
  return { board: { ...board, blocks: [...board.blocks, { id: blockId, kind: init.kind, title: init.title, invariants: [], hotspots: [], fields: [] }] }, blockId }
}

export interface BlockPatch {
  kind?: BlockKind
  title?: string
  /** Empty or null clears it. */
  actor?: string | null
  invariants?: string[]
  hotspots?: string[]
  fields?: Field[]
}

/** Changes a block's content. The id never changes, even when the title does. */
export function updateBlock(board: Board, id: string, patch: BlockPatch): Board {
  return {
    ...board,
    blocks: board.blocks.map((b) => {
      if (b.id !== id) return b
      const { actor, ...rest } = patch
      const next: Block = { ...b, ...rest }
      if (actor !== undefined) {
        delete next.actor
        if (actor && actor.trim()) next.actor = actor
      }
      return next
    }),
  }
}

/**
 * Renames a block that has not reached the agreed version yet, re-deriving its id from the
 * new title (so a block added as "New policy" and named "Reserve stock" gets `reserve-stock`,
 * not `new-policy`). Its connections follow. Use `updateBlock` for blocks that already
 * exist on main — their ids are frozen.
 */
export function retitleNewBlock(board: Board, id: string, title: string): { board: Board; blockId: string } {
  const found = findBlock(board, id)
  if (!found) return { board, blockId: id }
  const blockId = newId(title, board.blocks.map((b) => b.id).filter((x) => x !== id), found.kind)
  const rename = (x: string) => (x === id ? blockId : x)
  return {
    board: {
      ...board,
      blocks: board.blocks.map((b) => (b.id === id ? { ...b, id: blockId, title } : b)),
      connections: board.connections.map((c) => ({ from: rename(c.from), to: rename(c.to) })),
    },
    blockId,
  }
}

/** Removes the block and every connection touching it. */
export function removeBlock(board: Board, id: string): Board {
  return {
    ...board,
    blocks: board.blocks.filter((b) => b.id !== id),
    connections: board.connections.filter((c) => c.from !== id && c.to !== id),
  }
}

/** Adds `from → to` unless it exists, is a self-link, or names a missing block. */
export function connect(board: Board, from: string, to: string): Board {
  if (from === to || !findBlock(board, from) || !findBlock(board, to)) return board
  if (board.connections.some((c) => c.from === from && c.to === to)) return board
  return { ...board, connections: [...board.connections, { from, to }] }
}

export function disconnect(board: Board, from: string, to: string): Board {
  const keep = (c: Connection) => !(c.from === from && c.to === to)
  return { ...board, connections: board.connections.filter(keep) }
}

/** The selected blocks and the connections between them, as a process of their own: what a copy puts on the clipboard. */
export function extractBlocks(board: Board, ids: Iterable<string>): Board {
  const keep = new Set(ids)
  return {
    ...board,
    blocks: board.blocks.filter((b) => keep.has(b.id)),
    connections: board.connections.filter((c) => keep.has(c.from) && keep.has(c.to)),
  }
}

/**
 * Appends another process's blocks and their connections (a paste). Each block gets a fresh id
 * where its own is taken; `ids` maps each pasted block's old id to its new one.
 */
export function pasteBlocks(board: Board, fragment: Board): { board: Board; ids: Map<string, string> } {
  const taken = new Set(board.blocks.map((b) => b.id))
  const ids = new Map<string, string>()
  const blocks = fragment.blocks.map((b) => {
    const id = taken.has(b.id) ? newId(b.id, taken, b.kind) : b.id
    taken.add(id)
    ids.set(b.id, id)
    return { ...b, id }
  })
  const connections = fragment.connections.flatMap((c) => {
    const from = ids.get(c.from)
    const to = ids.get(c.to)
    return from && to ? [{ from, to }] : []
  })
  return { board: { ...board, blocks: [...board.blocks, ...blocks], connections: [...board.connections, ...connections] }, ids }
}
