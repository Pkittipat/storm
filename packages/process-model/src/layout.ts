import type { Board } from './model.js'

export interface LayoutOptions {
  /** Horizontal distance between column starts. */
  columnWidth: number
  /** Vertical distance between row starts inside a group. */
  rowHeight: number
  /** Extra space between one group's last row and the next group. */
  groupGap: number
  originX: number
  originY: number
}

export const DEFAULT_LAYOUT: LayoutOptions = { columnWidth: 180, rowHeight: 140, groupGap: 40, originX: 0, originY: 0 }

export interface Point {
  x: number
  y: number
}

/** A band of rows holding one chain of connected blocks (or, last, every unconnected block). */
export interface LayoutGroup {
  blockIds: string[]
  y: number
  height: number
  columns: number
}

export interface BoardLayout {
  positions: Map<string, Point>
  groups: LayoutGroup[]
}

/**
 * Derived positions — never stored. Blocks connected to each other form a group; groups
 * stack top to bottom in the order their first block appears in the file. Within a group a
 * block's column is its longest path from the group's start blocks (back edges of loops are
 * ignored for ranking) and rows follow file order. Unconnected blocks share one last row.
 */
export function layoutBoard(board: Board, options: Partial<LayoutOptions> = {}): BoardLayout {
  const o = { ...DEFAULT_LAYOUT, ...options }
  const ids = [...new Set(board.blocks.map((b) => b.id))]
  const order = new Map(ids.map((id, i) => [id, i]))
  const edges = board.connections.filter((c) => order.has(c.from) && order.has(c.to) && c.from !== c.to)

  // Connected groups (ignoring direction), in file order of their first block.
  const neighbours = new Map<string, string[]>(ids.map((id) => [id, []]))
  for (const e of edges) {
    neighbours.get(e.from)!.push(e.to)
    neighbours.get(e.to)!.push(e.from)
  }
  const seen = new Set<string>()
  const groups: string[][] = []
  for (const id of ids) {
    if (seen.has(id) || neighbours.get(id)!.length === 0) continue
    const members: string[] = []
    const stack = [id]
    seen.add(id)
    while (stack.length) {
      const cur = stack.pop()!
      members.push(cur)
      for (const n of neighbours.get(cur)!) {
        if (seen.has(n)) continue
        seen.add(n)
        stack.push(n)
      }
    }
    groups.push(members.sort((a, b) => order.get(a)! - order.get(b)!))
  }
  const loose = ids.filter((id) => neighbours.get(id)!.length === 0)

  const positions = new Map<string, Point>()
  const out: LayoutGroup[] = []
  let top = o.originY
  for (const members of groups) {
    const inGroup = new Set(members)
    const columnOf = rank(members, edges.filter((e) => inGroup.has(e.from)))
    const columns = new Map<number, string[]>()
    for (const id of members) {
      const col = columnOf.get(id)!
      if (!columns.has(col)) columns.set(col, [])
      columns.get(col)!.push(id)
    }
    let rows = 1
    for (const [col, colIds] of columns) {
      rows = Math.max(rows, colIds.length)
      colIds.forEach((id, row) => positions.set(id, { x: o.originX + col * o.columnWidth, y: top + row * o.rowHeight }))
    }
    const height = rows * o.rowHeight
    out.push({ blockIds: members, y: top, height, columns: Math.max(...columns.keys()) + 1 })
    top += height + o.groupGap
  }
  if (loose.length) {
    loose.forEach((id, col) => positions.set(id, { x: o.originX + col * o.columnWidth, y: top }))
    out.push({ blockIds: loose, y: top, height: o.rowHeight, columns: loose.length })
  }

  return { positions, groups: out }
}

/** Longest-path column per block, after dropping the edges that close a loop. */
function rank(ids: string[], edges: { from: string; to: string }[]): Map<string, number> {
  const out = new Map<string, string[]>(ids.map((id) => [id, []]))
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]))
  for (const e of edges) {
    out.get(e.from)!.push(e.to)
    indegree.set(e.to, indegree.get(e.to)! + 1)
  }

  // Depth-first from start blocks (no incoming edges) in file order, then from anything
  // left over (a loop with no way in); an edge to a block still on the stack closes a loop.
  const state = new Map<string, 'active' | 'done'>()
  const incoming = new Map<string, string[]>(ids.map((id) => [id, []]))
  const visit = (id: string) => {
    state.set(id, 'active')
    for (const next of out.get(id)!) {
      if (state.get(next) === 'active') continue
      incoming.get(next)!.push(id)
      if (!state.has(next)) visit(next)
    }
    state.set(id, 'done')
  }
  for (const id of ids) if (indegree.get(id) === 0 && !state.has(id)) visit(id)
  for (const id of ids) if (!state.has(id)) visit(id)

  // Longest path over the remaining (acyclic) edges.
  const column = new Map<string, number>()
  const depth = (id: string): number => {
    const known = column.get(id)
    if (known !== undefined) return known
    const best = Math.max(0, ...incoming.get(id)!.map((from) => depth(from) + 1))
    column.set(id, best)
    return best
  }
  for (const id of ids) depth(id)
  return column
}
