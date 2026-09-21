import type { Issue } from '@stormm/process-model'
import { Button, IconButton, PanelSection } from '../components'

interface YamlPanelProps {
  path: string
  yaml: string
  issues: Issue[]
  onCopy: () => void
  onDownload: () => void
  onClose: () => void
}

/**
 * The docked YAML view: the exact file a developer reviews (canonical, as stored), with the
 * validation result. Errors block saving; warnings are advice.
 */
export function YamlPanel({ path, yaml, issues, onCopy, onDownload, onClose }: YamlPanelProps) {
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')

  return (
    <aside aria-label="Process YAML" className="box-border flex h-full w-[420px] shrink-0 flex-col overflow-hidden border-l border-border bg-surface-sunken p-step-lg">
      <div className="flex items-center justify-between pt-step-2xs pr-step-2xs pb-0 pl-step-md">
        <div className="font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">YAML</div>
        <IconButton size="sm" aria-label="Close YAML" onClick={onClose} icon={<span aria-hidden="true">&times;</span>} />
      </div>
      <div className="truncate px-step-md pt-step-2xs pb-step-lg font-mono text-label text-text" title={path}>
        {path}
      </div>

      <div className="-mx-step-lg min-h-0 flex-grow overflow-y-auto px-step-lg">
        <PanelSection label={`Validation · ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}, ${warnings.length} ${warnings.length === 1 ? 'warning' : 'warnings'}`}>
          {issues.length === 0 && <div className="px-step-md py-step-xs text-meta text-text-muted">No problems found</div>}
          <ul className="m-0 flex list-none flex-col gap-step-xs p-0">
            {[...errors, ...warnings].map((issue, i) => (
              <li key={i} className="flex gap-step-sm rounded-lg px-step-md py-step-xs text-meta">
                <span className={`shrink-0 font-medium ${issue.level === 'error' ? 'text-hotspot-text' : 'text-text-secondary'}`}>
                  {issue.level === 'error' ? 'Error' : 'Warning'}
                </span>
                <span className="text-text">{issue.message}</span>
              </li>
            ))}
          </ul>
        </PanelSection>

        <PanelSection
          label="File"
          action={
            <div className="flex gap-step-2xs">
              <Button onClick={onCopy} className="h-7! px-step-md!">
                Copy
              </Button>
              <Button onClick={onDownload} className="h-7! px-step-md!">
                Download
              </Button>
            </div>
          }
        >
          <pre aria-label="YAML source" className="m-0 overflow-x-auto rounded-lg border border-border-subtle bg-surface-raised p-step-md font-mono text-[11px] leading-relaxed text-text">
            {yaml}
          </pre>
        </PanelSection>
      </div>
    </aside>
  )
}
