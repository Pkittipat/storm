import { Button, IconButton, PanelSection } from '../components'
import type { ProcessDiff } from '../api'

interface ChangesPanelProps {
  diff: ProcessDiff | null
  accepting: boolean
  onAccept: () => void
  onClose: () => void
}

/**
 * Docked review panel: the diff between the current user's in-progress edit and the
 * agreed version on `main`, with an Accept action that merges it in. `diff` is `null`
 * while the request is in flight.
 */
export function ChangesPanel({ diff, accepting, onAccept, onClose }: ChangesPanelProps) {
  return (
    <aside aria-label="Review changes" className="box-border flex h-full w-[420px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface-sunken p-step-lg">
      <div className="flex items-center justify-between pt-step-2xs pr-step-2xs pb-0 pl-step-md">
        <div className="font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">Review changes</div>
        <IconButton size="sm" aria-label="Close review" onClick={onClose} icon={<span aria-hidden="true">&times;</span>} />
      </div>

      <div className="-mx-step-lg min-h-0 flex-grow overflow-y-auto px-step-lg">
        {diff === null ? (
          <div className="px-step-md py-step-lg text-meta text-text-muted">Loading…</div>
        ) : !diff.hasChanges ? (
          <div className="px-step-md py-step-lg text-meta text-text-muted">No changes to review — this matches the agreed version.</div>
        ) : (
          <PanelSection
            label={`Changes · +${diff.additions ?? 0} -${diff.deletions ?? 0}`}
            action={
              <Button variant="primary" onClick={onAccept} disabled={accepting} className="h-7! px-step-md!">
                {accepting ? 'Accepting…' : 'Accept'}
              </Button>
            }
          >
            {diff.patch ? (
              <pre aria-label="Diff" className="m-0 overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-step-md font-mono text-[11px] leading-relaxed">
                {diff.patch.split('\n').map((line, i) => (
                  <div
                    key={i}
                    className={
                      line.startsWith('+') && !line.startsWith('+++')
                        ? 'bg-diff-add-surface text-diff-add'
                        : line.startsWith('-') && !line.startsWith('---')
                          ? 'bg-hotspot-surface text-hotspot-text'
                          : 'text-text'
                    }
                  >
                    {line || ' '}
                  </div>
                ))}
              </pre>
            ) : (
              <div className="px-step-md py-step-xs text-meta text-text-muted">No preview available for this change.</div>
            )}
          </PanelSection>
        )}
      </div>
    </aside>
  )
}
