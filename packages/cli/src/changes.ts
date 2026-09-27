import { diffBoards, type Block, type Board, type BoardDiff, type Field } from '@stormm/process-model'

/**
 * What differs between two versions of a storm, matched by block id, in the YAML's own terms:
 * ids, kinds, titles, actors, fields, hotspots and connections. No interpretation is added;
 * the reader takes the meaning from the storm itself.
 * `before` is null when the storm is new: everything in it is added.
 */
export function changes(before: Board | null, after: Board): BoardDiff {
  return diffBoards(before ?? { ...after, name: after.name, blocks: [], connections: [] }, after)
}

const field = (f: Field) => `${f.name}: ${f.type}`
const quote = (s: string) => JSON.stringify(s)

function blockLine(b: Block) {
  const parts = [`title: ${b.title}`]
  if (b.actor) parts.push(`actor: ${b.actor}`)
  if (b.invariants.length) parts.push(`invariants: ${b.invariants.map(quote).join(', ')}`)
  if (b.fields.length) parts.push(`fields: ${b.fields.map(field).join(', ')}`)
  if (b.hotspots.length) parts.push(`hotspots: ${b.hotspots.map(quote).join(', ')}`)
  return `- \`${b.id}\` (${b.kind}) ${parts.join('; ')}`
}

function fieldChanges(a: Field[], b: Field[]): string[] {
  const was = new Map(a.map((f) => [f.name, f.type]))
  const is = new Map(b.map((f) => [f.name, f.type]))
  const out: string[] = []
  for (const f of b) {
    if (!was.has(f.name)) out.push(`field added: ${field(f)}`)
    else if (was.get(f.name) !== f.type) out.push(`field type: ${f.name}: ${was.get(f.name)} → ${f.type}`)
  }
  for (const f of a) if (!is.has(f.name)) out.push(`field removed: ${field(f)}`)
  // Same fields, different order.
  if (!out.length && a.length === b.length) out.push(`field order: ${b.map((f) => f.name).join(', ')}`)
  return out
}

export function renderChanges(d: BoardDiff, before: Board | null, after: Board, since: string) {
  const title = (id: string) => after.blocks.find((b) => b.id === id)?.title ?? before?.blocks.find((b) => b.id === id)?.title ?? id
  const out = [
    before ? `# Storm changes since ${since}` : `# Storm changes since ${since}: the file is new there, so everything is added`,
    '',
    'What differs between the two versions of the YAML, matched by block id. The YAML itself is the design; read it for the whole picture.',
    '',
  ]
  const section = (heading: string, lines: string[]) => lines.length && out.push(`## ${heading}`, '', ...lines, '')

  if (d.name) section('Process name', [`- ${d.name.from} → ${d.name.to}`])
  section('Blocks added', d.blocks.added.map(blockLine))
  section('Blocks removed', d.blocks.removed.map(blockLine))
  section(
    'Blocks changed',
    d.blocks.changed.map(({ before: a, after: b, changes: what }) => {
      const lines: string[] = []
      if (what.includes('title')) lines.push(`title: ${a.title} → ${b.title}`)
      if (what.includes('kind')) lines.push(`kind: ${a.kind} → ${b.kind}`)
      if (what.includes('actor')) lines.push(`actor: ${a.actor ?? '(none)'} → ${b.actor ?? '(none)'}`)
      if (what.includes('invariants')) {
        for (const r of b.invariants.filter((r) => !a.invariants.includes(r))) lines.push(`invariant added: ${quote(r)}`)
        for (const r of a.invariants.filter((r) => !b.invariants.includes(r))) lines.push(`invariant removed: ${quote(r)}`)
      }
      if (what.includes('fields')) lines.push(...fieldChanges(a.fields, b.fields))
      if (what.includes('hotspots')) {
        for (const h of b.hotspots.filter((h) => !a.hotspots.includes(h))) lines.push(`hotspot added: ${quote(h)}`)
        for (const h of a.hotspots.filter((h) => !b.hotspots.includes(h))) lines.push(`hotspot removed: ${quote(h)}`)
      }
      return `- \`${b.id}\` (${b.kind}) ${b.title}\n${lines.map((l) => `  - ${l}`).join('\n')}`
    }),
  )
  const conn = (c: { from: string; to: string }) => `- \`${c.from}\` → \`${c.to}\` (${title(c.from)} → ${title(c.to)})`
  section('Connections added', d.connections.added.map(conn))
  section('Connections removed', d.connections.removed.map(conn))
  if (out.length === 4) out.push('Nothing changed.', '')
  return out.join('\n')
}
