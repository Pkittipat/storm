import { describe, expect, it } from 'vitest'
import { hasErrors, parseBoard, scalar, toYaml, type Board } from '../src'
import { CHECKOUT_YAML, checkout } from './fixture'

describe('toYaml', () => {
  it('writes the canonical form byte for byte', () => {
    expect(toYaml(checkout())).toBe(CHECKOUT_YAML)
  })

  it('round-trips through parseBoard unchanged', () => {
    const board = checkout()
    expect(parseBoard(toYaml(board)).board).toEqual(board)
  })

  it('writes invariants after the actor and before hotspots and fields', () => {
    const board: Board = {
      schemaVersion: 1,
      id: 'p',
      name: 'P',
      blocks: [{ id: 'job', kind: 'aggregate', title: 'Job', invariants: ['A job can only be published once'], hotspots: ['Can a closed job reopen?'], fields: [{ name: 'status', type: 'string' }] }],
      connections: [],
    }
    expect(toYaml(board)).toContain(
      '  - id: job\n    kind: aggregate\n    title: Job\n    invariants:\n      - A job can only be published once\n    hotspots:\n      - Can a closed job reopen?\n    fields:\n',
    )
    expect(parseBoard(toYaml(board)).board).toEqual(board)
  })

  it('rejects an invariant that is not text', () => {
    const { issues } = parseBoard('schemaVersion: 1\nid: p\nname: P\nblocks:\n  - { id: job, kind: aggregate, title: Job, invariants: [{ rule: x }] }\n')
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', message: 'Each invariant must be text.' }))
  })

  it('omits empty connections and writes empty blocks explicitly', () => {
    const board: Board = { schemaVersion: 1, id: 'empty', name: 'Empty', blocks: [], connections: [] }
    expect(toYaml(board)).toBe('schemaVersion: 1\nid: empty\nname: Empty\n\nblocks: []\n')
  })

  it.each([
    ['Cart', 'Cart'],
    ['What if the cart is empty?', 'What if the cart is empty?'],
    ['CartItem[]', '"CartItem[]"'],
    ['yes', '"yes"'],
    ['No', '"No"'],
    ['null', '"null"'],
    ['123', '"123"'],
    ['2026-09-22', '"2026-09-22"'],
    ['a: b', '"a: b"'],
    ['price, total', '"price, total"'],
    ['# note', '"# note"'],
    [' padded', '" padded"'],
    ['trailing ', '"trailing "'],
    ['line\nbreak', '"line\\nbreak"'],
    ['say "hi"', '"say \\"hi\\""'],
    ['Crème brûlée', '"Crème brûlée"'],
  ])('quotes %j only when needed', (value, expected) => {
    expect(scalar(value)).toBe(expected)
  })

  it('reads every written scalar back as the same string', () => {
    const tricky = ['yes', '123', 'a: b', '{x}', '[y]', 'line\nbreak', 'tab\there', '~', "it's", 'a  b', '-dash', 'Crème']
    const board = checkout()
    board.blocks[0].hotspots = tricky
    expect(parseBoard(toYaml(board)).board?.blocks[0].hotspots).toEqual(tricky)
  })
})

describe('parseBoard', () => {
  it('accepts hand-formatted YAML and normalizes it', () => {
    const text = `
schemaVersion: 1
id: checkout
name: "Checkout"
blocks:
- {id: cart, kind: readmodel, title: Cart, hotspots: [], actor: ""}
- id: place-order
  title: Place order
  kind: command
connections: [{from: cart, to: place-order}]
`
    const { board, issues } = parseBoard(text)
    expect(issues).toEqual([])
    expect(board?.blocks).toEqual([
      { id: 'cart', kind: 'readmodel', title: 'Cart', invariants: [], hotspots: [], fields: [] },
      { id: 'place-order', kind: 'command', title: 'Place order', invariants: [], hotspots: [], fields: [] },
    ])
    expect(toYaml(board!)).toContain('  - { id: cart, kind: readmodel, title: Cart }')
  })

  it('ignores unknown keys with a warning, so newer optional keys still load', () => {
    const text = CHECKOUT_YAML.replace('  - { from: cart, to: place-order }', '  - { from: cart, to: place-order, note: async }')
    const { board, issues } = parseBoard(text)
    expect(board).not.toBeNull()
    expect(issues).toEqual([expect.objectContaining({ level: 'warning', code: 'unknown-key', path: 'connections[0].note' })])
  })

  it('refuses a newer schemaVersion', () => {
    const { board, issues } = parseBoard(CHECKOUT_YAML.replace('schemaVersion: 1', 'schemaVersion: 2'))
    expect(board).toBeNull()
    expect(issues[0]).toMatchObject({ level: 'error', code: 'schema-version' })
  })

  it.each([
    ['missing schemaVersion', 'id: x\nname: X\nblocks: []\n', 'schema-version'],
    ['text schemaVersion', 'schemaVersion: "1"\nid: x\nname: X\nblocks: []\n', 'schema-version'],
    ['not a mapping', '- a\n- b\n', 'not-a-mapping'],
    ['bad YAML', 'schemaVersion: 1\nid: [unclosed\n', 'yaml-syntax'],
    ['missing blocks', 'schemaVersion: 1\nid: x\nname: X\n', 'required'],
    ['blocks not a list', 'schemaVersion: 1\nid: x\nname: X\nblocks: nope\n', 'type'],
    ['block without title', 'schemaVersion: 1\nid: x\nname: X\nblocks:\n  - { id: a, kind: event }\n', 'required'],
    ['duplicate key', 'schemaVersion: 1\nid: x\nid: y\nname: X\nblocks: []\n', 'yaml-syntax'],
  ])('rejects %s', (_, text, code) => {
    const { board, issues } = parseBoard(text)
    expect(board).toBeNull()
    expect(hasErrors(issues)).toBe(true)
    expect(issues.map((i) => i.code)).toContain(code)
  })
})
