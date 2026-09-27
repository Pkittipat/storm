import { describe, expect, it } from 'vitest'
import { addBlock, connect, disconnect, extractBlocks, newBoard, newId, pasteBlocks, removeBlock, retitleNewBlock, slugify, updateBlock, validate } from '../src'
import { checkout } from './fixture'

describe('ids', () => {
  it.each([
    ['Place order', 'place-order'],
    ['  Ship (EU)! ', 'ship-eu'],
    ['Crème brûlée', 'creme-brulee'],
    ['???', 'untitled'],
  ])('slugify(%j) = %j', (text, slug) => expect(slugify(text)).toBe(slug))

  it('suffixes collisions', () => {
    expect(newId('Order', ['order', 'order-2'])).toBe('order-3')
  })
})

describe('edits', () => {
  it('starts an empty process with a fresh id', () => {
    expect(newBoard('Place order', ['place-order'])).toEqual({ schemaVersion: 1, id: 'place-order-2', name: 'Place order', blocks: [], connections: [] })
  })

  it('gives a repeated concept its own id', () => {
    expect(addBlock(checkout(), { kind: 'aggregate', title: 'Order' }).blockId).toBe('order-2')
  })

  it('keeps the id when the title changes, and clears an empty actor', () => {
    const b = updateBlock(checkout(), 'place-order', { title: 'Submit order', actor: '' })
    expect(b.blocks[1]).toMatchObject({ id: 'place-order', title: 'Submit order' })
    expect(b.blocks[1]).not.toHaveProperty('actor')
  })

  it('connects once, and ignores self-links and missing blocks', () => {
    const b = connect(checkout(), 'order-shipped', 'cart')
    expect(b.connections.at(-1)).toEqual({ from: 'order-shipped', to: 'cart' })
    expect(connect(b, 'cart', 'place-order')).toBe(b)
    expect(connect(b, 'cart', 'cart')).toBe(b)
    expect(connect(b, 'cart', 'ghost')).toBe(b)
    expect(disconnect(b, 'order-shipped', 'cart').connections).toEqual(checkout().connections)
  })

  it('removing a block takes its connections', () => {
    const b = removeBlock(checkout(), 'order')
    expect(b.connections.some((c) => c.from === 'order' || c.to === 'order')).toBe(false)
    expect(validate(b).filter((i) => i.level === 'error')).toEqual([])
  })

  it('re-derives the id of a block that is still new, carrying its connections', () => {
    let b = addBlock(checkout(), { kind: 'policy', title: 'New policy' }).board
    b = connect(b, 'order-placed', 'new-policy')
    const { board, blockId } = retitleNewBlock(b, 'new-policy', 'Reserve stock')
    expect(blockId).toBe('reserve-stock')
    expect(board.blocks.at(-1)).toMatchObject({ id: 'reserve-stock', title: 'Reserve stock' })
    expect(board.connections.at(-1)).toEqual({ from: 'order-placed', to: 'reserve-stock' })
    expect(retitleNewBlock(board, 'reserve-stock', 'Reserve stock').blockId).toBe('reserve-stock')
    expect(retitleNewBlock(board, 'reserve-stock', 'Order').blockId).toBe('order-2')
    expect(validate(board)).toEqual([])
  })
})

describe('copy and paste', () => {
  it('copies the selected blocks with only the connections between them', () => {
    const part = extractBlocks(checkout(), ['place-order', 'order', 'shipment'])
    expect(part.blocks.map((b) => b.id)).toEqual(['place-order', 'order', 'shipment'])
    expect(part.connections).toEqual([{ from: 'place-order', to: 'order' }])
  })

  it('pastes with fresh ids where taken, keeping the connections between the pasted blocks', () => {
    const board = checkout()
    const { board: after, ids } = pasteBlocks(board, extractBlocks(board, ['place-order', 'order']))
    expect(Object.fromEntries(ids)).toEqual({ 'place-order': 'place-order-2', order: 'order-2' })
    expect(after.blocks.slice(-2).map((b) => [b.id, b.title])).toEqual([['place-order-2', 'Place order'], ['order-2', 'Order']])
    expect(after.connections.at(-1)).toEqual({ from: 'place-order-2', to: 'order-2' })
    expect(validate(after).filter((i) => i.level === 'error')).toEqual([])
  })

  it('keeps ids that are free', () => {
    const empty = newBoard('Empty')
    const { board, ids } = pasteBlocks(empty, extractBlocks(checkout(), ['cart']))
    expect(ids.get('cart')).toBe('cart')
    expect(board.blocks.map((b) => b.id)).toEqual(['cart'])
  })
})
