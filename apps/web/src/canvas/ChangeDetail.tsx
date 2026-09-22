import type { Block, BlockChange, ChangeStatus } from '@stormm/process-model'
import { IconButton, TypeSwatch, blockKindLabel } from '../components'

const ALL_CHANGES: BlockChange[] = ['title', 'kind', 'actor', 'hotspots', 'fields']

const FIELD_LABEL: Record<BlockChange, string> = {
  title: 'Title',
  kind: 'Kind',
  actor: 'Actor',
  hotspots: 'Hotspots',
  fields: 'Fields',
}

function formatValue(field: BlockChange, block: Block | undefined): string {
  if (!block) return '—'
  switch (field) {
    case 'title':
      return block.title
    case 'kind':
      return blockKindLabel[block.kind]
    case 'actor':
      return block.actor ?? '—'
    case 'hotspots':
      return block.hotspots.length ? block.hotspots.join('; ') : '—'
    case 'fields':
      return block.fields.length ? block.fields.map((f) => `${f.name}: ${f.type}`).join(', ') : '—'
  }
}

interface ChangeDetailProps {
  status: ChangeStatus
  before?: Block
  after?: Block
  /** Which fields differ — only present (and only relevant) when `status` is `'changed'`. */
  changes?: BlockChange[]
  onClose: () => void
}

const STATUS_LABEL: Record<ChangeStatus, string> = { added: 'New block', removed: 'Removed block', changed: 'Updated block' }

/**
 * Docked detail panel: the field-level diff for one block selected in ChangesList. An
 * added/removed block shows all its fields (nothing to compare against); a changed block
 * shows only the fields that actually differ, before → after.
 */
export function ChangeDetail({ status, before, after, changes, onClose }: ChangeDetailProps) {
  const block = after ?? before!
  const fields = status === 'changed' ? (changes ?? []) : ALL_CHANGES.filter((f) => f !== 'kind')

  return (
    <aside aria-label="Change detail" className="box-border flex h-full w-[420px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface-sunken p-step-lg">
      <div className="flex items-center justify-between pt-step-2xs pr-step-2xs pb-0 pl-step-md">
        <div className="flex items-center gap-step-xs font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">
          <TypeSwatch kind={block.kind} />
          {blockKindLabel[block.kind]}
        </div>
        <IconButton size="sm" aria-label="Close" onClick={onClose} icon={<span aria-hidden="true">&times;</span>} />
      </div>
      <div className="px-step-md pt-step-2xs pb-step-2xs text-heading font-semibold text-text">{block.title}</div>
      <div className="px-step-md pb-step-lg text-meta text-text-muted">{STATUS_LABEL[status]}</div>

      <div className="-mx-step-lg min-h-0 flex-grow overflow-y-auto px-step-lg">
        {fields.length === 0 ? (
          <div className="px-step-md py-step-xs text-meta text-text-muted">No field changes — only its position or connections changed.</div>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-step-md p-0">
            {fields.map((field) => (
              <li key={field} className="flex flex-col gap-step-2xs rounded-lg border border-border-subtle bg-surface-raised px-step-md py-step-sm">
                <span className="font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">{FIELD_LABEL[field]}</span>
                {status === 'changed' ? (
                  <div className="flex flex-col gap-step-2xs text-meta">
                    <span className="text-hotspot-text line-through decoration-1">{formatValue(field, before)}</span>
                    <span className="text-diff-add">{formatValue(field, after)}</span>
                  </div>
                ) : (
                  <span className={`text-meta ${status === 'removed' ? 'text-hotspot-text' : 'text-diff-add'}`}>{formatValue(field, block)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}
