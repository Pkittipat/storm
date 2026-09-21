import type { Block, Board, Connection, Field } from './model.js'

/**
 * Canonical YAML for a process: fixed key order, fixed indentation and quoting,
 * empty optional keys left out. The same board always gives the same bytes, so
 * a PR diff only ever shows real changes.
 */
export function toYaml(board: Board): string {
  const out: string[] = [`schemaVersion: ${board.schemaVersion}`, `id: ${scalar(board.id)}`, `name: ${scalar(board.name)}`, '']
  if (board.blocks.length === 0) out.push('blocks: []')
  else {
    out.push('blocks:')
    for (const block of board.blocks) out.push(...blockLines(block, '  '))
  }
  if (board.connections.length) {
    out.push('', 'connections:')
    for (const c of board.connections) out.push(`  - ${connection(c)}`)
  }
  return out.join('\n') + '\n'
}

/** A block without hotspots or fields fits on one line; otherwise it is written out key by key. */
function blockLines(block: Block, indent: string): string[] {
  const head: [string, string][] = [
    ['id', block.id],
    ['kind', block.kind],
    ['title', block.title],
  ]
  if (block.actor) head.push(['actor', block.actor])
  if (!block.hotspots.length && !block.fields.length) return [`${indent}- ${inline(head)}`]

  const out = head.map(([k, v], i) => `${indent}${i === 0 ? '- ' : '  '}${k}: ${scalar(v)}`)
  if (block.hotspots.length) {
    out.push(`${indent}  hotspots:`)
    for (const h of block.hotspots) out.push(`${indent}    - ${scalar(h)}`)
  }
  if (block.fields.length) {
    out.push(`${indent}  fields:`)
    for (const f of block.fields) out.push(`${indent}    - ${field(f)}`)
  }
  return out
}

const connection = (c: Connection) => inline([['from', c.from], ['to', c.to]])
const field = (f: Field) => inline([['name', f.name], ['type', f.type]])
const inline = (pairs: [string, string][]) => `{ ${pairs.map(([k, v]) => `${k}: ${scalar(v)}`).join(', ')} }`

// Words YAML 1.1/1.2 readers turn into booleans or null when left unquoted.
const RESERVED = /^(?:true|false|yes|no|on|off|y|n|null|~)$/i
// Plain scalars: start with a letter or underscore, no characters that mean something
// in YAML flow or block context (: # , [ ] { } quotes, etc.), no edge whitespace.
const PLAIN = /^[A-Za-z_][A-Za-z0-9 _.\/()'&?!+-]*$/

/** A string as a plain scalar when that reads back unchanged, else JSON-style double-quoted (valid YAML). */
export function scalar(value: string): string {
  const plain = PLAIN.test(value) && !/\s$/.test(value) && !/\s\s/.test(value) && !RESERVED.test(value)
  return plain ? value : JSON.stringify(value)
}
