import { describe, expect, it } from 'vitest'
import { addBlock, connect, layoutBoard, removeBlock, type Board } from '../src'
import { checkout } from './fixture'

const opts = { columnWidth: 100, rowHeight: 10, groupGap: 5, originX: 0, originY: 0 }

/** Block id → [column, y]. */
function grid(board: Board) {
  const out: Record<string, [number, number]> = {}
  for (const [id, p] of layoutBoard(board, opts).positions) out[id] = [p.x / opts.columnWidth, p.y]
  return out
}

const block = (id: string, kind: Board['blocks'][number]['kind'] = 'event') => ({ id, kind, title: id, invariants: [], hotspots: [], fields: [] })

describe('layoutBoard', () => {
  it('ranks a connected process left to right', () => {
    expect(grid(checkout())).toEqual({
      cart: [0, 0],
      'place-order': [1, 0],
      order: [2, 0],
      'order-placed': [3, 0],
      'ship-when-placed': [4, 0],
      'ship-order': [5, 0],
      shipment: [6, 0],
      'order-shipped': [7, 0],
    })
  })

  it('puts a new branch below its sibling without moving anything else (the acceptance test)', () => {
    const before = grid(checkout())
    let b = addBlock(checkout(), { kind: 'policy', title: 'Reserve stock' }).board
    b = connect(b, 'order-placed', 'reserve-stock')
    const after = grid(b)
    expect(after['reserve-stock']).toEqual([4, 10])
    for (const id of Object.keys(before)) expect(after[id]).toEqual(before[id])
  })

  it('stacks separate chains as groups in file order, unconnected blocks last in one row', () => {
    const board: Board = {
      schemaVersion: 1,
      id: 'x',
      name: 'X',
      blocks: [block('a'), block('lonely'), block('b'), block('c'), block('d'), block('e'), block('stray')],
      connections: [
        { from: 'a', to: 'b' },
        { from: 'a', to: 'e' },
        { from: 'c', to: 'd' },
      ],
    }
    expect(grid(board)).toEqual({
      a: [0, 0],
      b: [1, 0],
      e: [1, 10],
      c: [0, 25],
      d: [1, 25],
      lonely: [0, 40],
      stray: [1, 40],
    })
    expect(layoutBoard(board, opts).groups.map((g) => g.blockIds)).toEqual([['a', 'b', 'e'], ['c', 'd'], ['lonely', 'stray']])
  })

  it("lines a block up with its predecessor so branches don't cross", () => {
    // Job created → two policies; each policy's command sits beside it, whatever the file order.
    const board: Board = {
      schemaVersion: 1,
      id: 'job',
      name: 'Job',
      blocks: [
        block('job-created'),
        block('log-activity', 'policy'),
        block('notify-member-policy', 'policy'),
        block('notify-member', 'command'),
        block('create-activity-log', 'command'),
      ],
      connections: [
        { from: 'job-created', to: 'log-activity' },
        { from: 'job-created', to: 'notify-member-policy' },
        { from: 'notify-member-policy', to: 'notify-member' },
        { from: 'log-activity', to: 'create-activity-log' },
      ],
    }
    expect(grid(board)).toMatchObject({
      'log-activity': [1, 0],
      'notify-member-policy': [1, 10],
      'create-activity-log': [2, 0],
      'notify-member': [2, 10],
    })
  })

  it('splits into two groups when the link between them is removed', () => {
    const b = removeBlock(checkout(), 'ship-when-placed')
    expect(grid(b)['ship-order']).toEqual([0, 15])
  })

  it('ignores loop-closing edges when ranking', () => {
    const b = connect(checkout(), 'order-shipped', 'ship-when-placed')
    expect(grid(b)['ship-when-placed']).toEqual([4, 0])
    expect(grid(b)['order-shipped']).toEqual([7, 0])
  })

  it('lays out a loop with no way in from its first block in file order', () => {
    const board: Board = {
      schemaVersion: 1,
      id: 'loop',
      name: 'Loop',
      blocks: [block('p', 'policy'), block('c', 'command')],
      connections: [
        { from: 'p', to: 'c' },
        { from: 'c', to: 'p' },
      ],
    }
    expect(grid(board)).toEqual({ p: [0, 0], c: [1, 0] })
  })
})
