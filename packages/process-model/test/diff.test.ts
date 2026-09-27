import { describe, expect, it } from 'vitest'
import { addBlock, blockStatus, connect, diffBoards, isEmptyDiff, removeBlock, summarize, updateBlock } from '../src'
import { checkout } from './fixture'

describe('diffBoards', () => {
  it('is empty for identical boards', () => {
    expect(isEmptyDiff(diffBoards(checkout(), checkout()))).toBe(true)
  })

  it('shows the acceptance test: Reserve stock added and connected', () => {
    const before = checkout()
    const { board, blockId } = addBlock(before, { kind: 'policy', title: 'Reserve stock' })
    const after = connect(board, 'order-placed', blockId)

    const d = diffBoards(before, after)
    expect(d.blocks.added).toEqual([expect.objectContaining({ id: 'reserve-stock', title: 'Reserve stock' })])
    expect(d.connections.added).toEqual([{ from: 'order-placed', to: 'reserve-stock' }])
    expect(d.blocks.removed).toEqual([])
    expect(d.blocks.changed).toEqual([])
    expect(summarize(d, before, after)).toEqual(['Added policy “Reserve stock”', 'Connected “Order placed” → “Reserve stock”'])
  })

  it('reports changed invariants', () => {
    const before = checkout()
    const after = updateBlock(before, 'order', { invariants: ['An order needs at least one item', 'An order is placed only once'] })
    expect(diffBoards(before, after).blocks.changed).toEqual([expect.objectContaining({ changes: ['invariants'] })])
  })

  it('treats a rename as a change, not a remove and add', () => {
    const before = checkout()
    const after = updateBlock(before, 'place-order', { title: 'Submit order', actor: null })
    const d = diffBoards(before, after)
    expect(d.blocks.added).toEqual([])
    expect(d.blocks.changed).toEqual([expect.objectContaining({ changes: ['title', 'actor'] })])
    expect(blockStatus(d).get('place-order')).toBe('changed')
    expect(summarize(d, before, after)).toEqual(['Changed “Submit order” (was “Place order”) — title, actor'])
  })

  it('reports removed blocks with their connections', () => {
    const before = checkout()
    const after = removeBlock(before, 'ship-when-placed')
    const d = diffBoards(before, after)
    expect(d.blocks.removed.map((b) => b.id)).toEqual(['ship-when-placed'])
    expect(d.connections.removed).toEqual([
      { from: 'order-placed', to: 'ship-when-placed' },
      { from: 'ship-when-placed', to: 'ship-order' },
    ])
    expect(blockStatus(d).get('ship-when-placed')).toBe('removed')
  })
})
