import { diffBoards, type Board, type Field } from '@stormm/process-model'
import { KIND_LABEL, buildContract, names, type Arrow, type Unit } from './contract.js'
import { unitLine } from './render.js'

export interface WorkItem {
  /** add | remove | rename | change | connect | disconnect */
  action: string
  text: string
  unitId?: string
}

const fieldKey = (f: Field) => `${f.name}: ${f.type}`

/**
 * What changed in the storm since the code was last written, as work for an engineer.
 * `before` is null when the storm is new: everything is work to add.
 */
export function changes(before: Board | null, after: Board): WorkItem[] {
  const base: Board = before ?? { ...after, blocks: [], connections: [] }
  const d = diffBoards(base, after)
  const now = buildContract(after)
  const then = buildContract(base)
  const unitNow = new Map(now.units.map((u) => [u.id, u]))
  const unitThen = new Map(then.units.map((u) => [u.id, u]))
  const items: WorkItem[] = []
  const label = (u: Unit) => `${KIND_LABEL[u.kind]} ${u.title} (\`${u.names.pascal}\`)`

  for (const b of d.blocks.added) {
    const u = unitNow.get(b.id)!
    items.push({ action: 'add', unitId: u.id, text: `Add ${KIND_LABEL[u.kind]} ${unitLine(u)}` })
  }
  for (const b of d.blocks.removed) {
    const u = unitThen.get(b.id)!
    items.push({ action: 'remove', unitId: u.id, text: `Remove ${label(u)} and the code for its arrows.` })
  }
  for (const { before: a, after: b, changes: what } of d.blocks.changed) {
    const u = unitNow.get(b.id)!
    if (what.includes('title')) {
      const old = names(a.title).pascal
      items.push({
        action: 'rename',
        unitId: u.id,
        text: old === u.names.pascal
          ? `Title of ${KIND_LABEL[u.kind]} \`${old}\` changed from "${a.title}" to "${b.title}"; the code name stays.`
          : `Rename ${KIND_LABEL[u.kind]} \`${old}\` → \`${u.names.pascal}\` ("${a.title}" → "${b.title}"), everywhere it is used.`,
      })
    }
    if (what.includes('kind'))
      items.push({ action: 'change', unitId: u.id, text: `"${b.title}" was a ${KIND_LABEL[a.kind]} and is now a ${KIND_LABEL[b.kind]}: move and reshape its code.` })
    if (what.includes('actor'))
      items.push({ action: 'change', unitId: u.id, text: `Actor of ${label(u)}: ${a.actor ?? 'none'} → ${b.actor ?? 'none'}.` })
    if (what.includes('fields')) {
      const was = new Set(a.fields.map(fieldKey))
      const is = new Set(b.fields.map(fieldKey))
      const added = b.fields.map(fieldKey).filter((f) => !was.has(f))
      const removed = a.fields.map(fieldKey).filter((f) => !is.has(f))
      items.push({
        action: 'change',
        unitId: u.id,
        text: `Fields of ${label(u)}:${added.length ? ` add ${added.join(', ')}.` : ''}${removed.length ? ` remove ${removed.join(', ')}.` : ''}`,
      })
    }
    if (what.includes('hotspots')) {
      const added = b.hotspots.filter((h) => !a.hotspots.includes(h))
      const resolved = a.hotspots.filter((h) => !b.hotspots.includes(h))
      for (const h of added) items.push({ action: 'change', unitId: u.id, text: `New hotspot on ${label(u)}: ${h}` })
      for (const h of resolved) items.push({ action: 'change', unitId: u.id, text: `Hotspot resolved on ${label(u)}: ${h} (check any TODO left for it).` })
    }
  }

  const arrow = (list: Arrow[], from: string, to: string) => list.find((a) => a.from === from && a.to === to)!
  for (const c of d.connections.added) items.push({ action: 'connect', text: `New arrow: ${arrow(now.arrows, c.from, c.to).text}.` })
  for (const c of d.connections.removed) items.push({ action: 'disconnect', text: `Removed arrow: ${arrow(then.arrows, c.from, c.to).text}; remove the code that realizes it.` })
  return items
}

export function renderChanges(items: WorkItem[], since: string | null, gaps: string[]) {
  const out = [`# Storm changes ${since ? `since ${since}` : '(new storm: everything is new)'}`, '']
  if (!items.length) out.push('Nothing changed.')
  items.forEach((it, i) => out.push(`${i + 1}. ${it.text}`))
  out.push('', '## Gaps in the storm now', '', ...(gaps.length ? gaps.map((g) => `- ${g}`) : ['- none']), '')
  return out.join('\n')
}
