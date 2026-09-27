import { connectionKey, type Block, type Board, type Connection } from './model.js'

export type BlockChange = 'title' | 'kind' | 'actor' | 'invariants' | 'hotspots' | 'fields'

export interface BoardDiff {
  name?: { from: string; to: string }
  blocks: {
    added: Block[]
    removed: Block[]
    changed: { before: Block; after: Block; changes: BlockChange[] }[]
  }
  connections: { added: Connection[]; removed: Connection[] }
}

export type ChangeStatus = 'added' | 'removed' | 'changed'

/** What changed from `before` (e.g. `main`) to `after` (a draft), matched by id. */
export function diffBoards(before: Board, after: Board): BoardDiff {
  const blocksBefore = new Map(before.blocks.map((b) => [b.id, b]))
  const blocksAfter = new Map(after.blocks.map((b) => [b.id, b]))
  const connsBefore = new Set(before.connections.map(connectionKey))
  const connsAfter = new Set(after.connections.map(connectionKey))

  return {
    ...(before.name !== after.name && { name: { from: before.name, to: after.name } }),
    blocks: {
      added: after.blocks.filter((b) => !blocksBefore.has(b.id)),
      removed: before.blocks.filter((b) => !blocksAfter.has(b.id)),
      changed: after.blocks.flatMap((b) => {
        const a = blocksBefore.get(b.id)
        if (!a) return []
        const changes: BlockChange[] = []
        if (a.title !== b.title) changes.push('title')
        if (a.kind !== b.kind) changes.push('kind')
        if ((a.actor ?? '') !== (b.actor ?? '')) changes.push('actor')
        if (!sameJson(a.invariants, b.invariants)) changes.push('invariants')
        if (!sameJson(a.hotspots, b.hotspots)) changes.push('hotspots')
        if (!sameJson(a.fields, b.fields)) changes.push('fields')
        return changes.length ? [{ before: a, after: b, changes }] : []
      }),
    },
    connections: {
      added: after.connections.filter((c) => !connsBefore.has(connectionKey(c))),
      removed: before.connections.filter((c) => !connsAfter.has(connectionKey(c))),
    },
  }
}

export function isEmptyDiff(d: BoardDiff): boolean {
  return (
    !d.name &&
    !d.blocks.added.length &&
    !d.blocks.removed.length &&
    !d.blocks.changed.length &&
    !d.connections.added.length &&
    !d.connections.removed.length
  )
}

/** Per-block highlight for a before/after canvas: look up after-board ids and before-board ids in one map. */
export function blockStatus(d: BoardDiff): Map<string, ChangeStatus> {
  const status = new Map<string, ChangeStatus>()
  for (const b of d.blocks.added) status.set(b.id, 'added')
  for (const b of d.blocks.removed) status.set(b.id, 'removed')
  for (const { after } of d.blocks.changed) status.set(after.id, 'changed')
  return status
}

/** Plain-language change list, e.g. for a PR description: “Added policy “Reserve stock””. */
export function summarize(d: BoardDiff, before: Board, after: Board): string[] {
  const title = (id: string) => after.blocks.find((b) => b.id === id)?.title ?? before.blocks.find((b) => b.id === id)?.title ?? id
  const lines: string[] = []
  if (d.name) lines.push(`Renamed process “${d.name.from}” to “${d.name.to}”`)
  for (const b of d.blocks.added) lines.push(`Added ${b.kind} “${b.title}”`)
  for (const b of d.blocks.removed) lines.push(`Removed ${b.kind} “${b.title}”`)
  for (const c of d.blocks.changed) {
    const renamed = c.changes.includes('title') ? ` (was “${c.before.title}”)` : ''
    lines.push(`Changed “${c.after.title}”${renamed} — ${c.changes.join(', ')}`)
  }
  for (const c of d.connections.added) lines.push(`Connected “${title(c.from)}” → “${title(c.to)}”`)
  for (const c of d.connections.removed) lines.push(`Disconnected “${title(c.from)}” → “${title(c.to)}”`)
  return lines
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
