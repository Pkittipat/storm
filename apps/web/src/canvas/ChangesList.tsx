import type { BoardDiff } from '@stormm/process-model'
import type { ProcessDiff } from '../api'
import { Avatar, Button, IconButton } from '../components'

interface ChangeRow {
  id: string
  status: 'added' | 'removed' | 'changed'
  kind: string
  title: string
}

const swatchClasses: Record<ChangeRow['status'], string> = {
  added: 'border-diff-add bg-diff-add-surface',
  changed: 'border-diff-change bg-diff-change-surface',
  removed: 'border-hotspot-text bg-hotspot-surface border-dashed',
}

function rowsFrom(boardDiff: BoardDiff): ChangeRow[] {
  return [
    ...boardDiff.blocks.removed.map((b): ChangeRow => ({ id: b.id, status: 'removed', kind: b.kind, title: b.title })),
    ...boardDiff.blocks.changed.map(({ after }): ChangeRow => ({ id: after.id, status: 'changed', kind: after.kind, title: after.title })),
    ...boardDiff.blocks.added.map((b): ChangeRow => ({ id: b.id, status: 'added', kind: b.kind, title: b.title })),
  ]
}

interface ChangesListProps {
  diff: ProcessDiff | null
  boardDiff: BoardDiff | null
  busy: 'requesting' | 'accepting' | null
  selectedId: string | null
  onSelect: (id: string) => void
  onRequest: () => void
  onAccept: () => void
  onClose: () => void
}

/**
 * Replaces the process-list sidebar while reviewing: one row per changed block (like a
 * VS Code source-control changes list), colored by whether it was added, changed, or
 * removed. Selecting a row shows that block's field-level diff in ChangeDetail, and the
 * same block highlights on the canvas. Connection changes list below, unselectable —
 * there's no per-connection detail to show.
 */
export function ChangesList({ diff, boardDiff, busy, selectedId, onSelect, onRequest, onAccept, onClose }: ChangesListProps) {
  const rows = boardDiff ? rowsFrom(boardDiff) : []

  return (
    <nav aria-label="Changes" className="flex w-sidebar-width shrink-0 flex-col gap-step-2xs border-r border-border bg-surface-sunken p-step-lg">
      <div className="flex items-center justify-between py-0 pr-step-2xs pb-step-lg pl-step-md">
        <span className="text-heading font-semibold tracking-heading text-text">Changes</span>
        <IconButton size="md" aria-label="Close changes" onClick={onClose} icon={<span aria-hidden="true">&times;</span>} />
      </div>

      <div className="flex items-center justify-between px-step-md pb-step-md">
        <span className="text-meta text-text-muted">
          {diff === null ? 'Loading…' : !diff.hasChanges ? 'No changes' : `${rows.length} block${rows.length === 1 ? '' : 's'}`}
        </span>
        {diff?.hasChanges &&
          (diff.requested ? (
            <Button variant="primary" onClick={onAccept} disabled={busy !== null} className="h-7! px-step-md!">
              {busy === 'accepting' ? 'Accepting…' : 'Accept'}
            </Button>
          ) : (
            <Button variant="primary" onClick={onRequest} disabled={busy !== null} className="h-7! px-step-md!">
              {busy === 'requesting' ? 'Requesting…' : 'Request change'}
            </Button>
          ))}
      </div>

      <div className="-mx-step-lg flex min-h-0 flex-grow flex-col gap-px overflow-y-auto px-step-lg pb-step-lg">
        {rows.map((row) => (
          <button
            key={row.id}
            type="button"
            onClick={() => onSelect(row.id)}
            aria-pressed={selectedId === row.id}
            className={`flex items-center gap-step-sm rounded-lg px-step-md py-step-xs text-left text-meta ${
              selectedId === row.id ? 'bg-surface-selected text-text' : 'text-text hover:bg-surface-hover'
            }`}
          >
            <span className={`h-3 w-3 shrink-0 rounded-sm border-[1.5px] ${swatchClasses[row.status]}`} aria-hidden="true" />
            <span className="flex-grow truncate">{row.title}</span>
            <span className="shrink-0 font-mono text-micro text-text-muted uppercase">{row.kind}</span>
          </button>
        ))}

        {boardDiff && (boardDiff.connections.added.length > 0 || boardDiff.connections.removed.length > 0) && (
          <div className="mt-step-md flex flex-col gap-step-2xs px-step-md">
            <div className="font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">Connections</div>
            {boardDiff.connections.added.map((c) => (
              <div key={`+${c.from}->${c.to}`} className="flex items-center gap-step-sm text-meta text-diff-add">
                <span aria-hidden="true">+</span>
                {c.from} → {c.to}
              </div>
            ))}
            {boardDiff.connections.removed.map((c) => (
              <div key={`-${c.from}->${c.to}`} className="flex items-center gap-step-sm text-meta text-hotspot-text">
                <span aria-hidden="true">−</span>
                {c.from} → {c.to}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-auto flex items-center gap-step-md border-t border-border p-step-sm pt-step-md">
        <Avatar initial="F" />
        <span className="flex-grow text-body font-medium text-text">Fang</span>
      </div>
    </nav>
  )
}
