import type { MouseEvent, ReactNode } from 'react'

interface NavProjectProps {
  /** The group name, or an inline EditableText while renaming. */
  name: ReactNode
  /** Plain-text name for the toggle's accessible label. */
  label: string
  expanded: boolean
  onToggle: () => void
  /** Double-clicking the heading renames it. */
  onRename?: () => void
  /** Right-clicking the heading (e.g. a Rename/Delete menu). */
  onContextMenu?: (e: MouseEvent<HTMLElement>) => void
  /** Always-visible buttons on the heading's right edge (e.g. "+" new process in this group). */
  actions?: ReactNode
  /** Its NavItems, shown only while expanded. */
  children?: ReactNode
}

/**
 * A collapsible group in the sidebar: a muted 32px heading — the name
 * followed by a chevron (always shown while collapsed, on hover or
 * keyboard focus while expanded) — over its NavItems. It owns no
 * state; the app decides which groups are expanded.
 */
export function NavProject({ name, label, expanded, onToggle, onRename, onContextMenu, actions, children }: NavProjectProps) {
  return (
    <div className="flex flex-col gap-px">
      <div onContextMenu={onContextMenu} className="group relative flex h-control-md shrink-0 items-center rounded-lg text-body font-medium text-text-muted">
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={`${label} group`}
          onClick={onToggle}
          onDoubleClick={onRename && ((e) => (e.preventDefault(), onRename()))}
          className="peer absolute inset-0 rounded-lg border-0 bg-transparent"
        />
        <span className="pointer-events-none flex min-w-0 flex-grow items-center gap-step-2xs px-step-md">
          <span className="min-w-0 truncate [&_input]:pointer-events-auto">{name}</span>
          <ChevronIcon
            className={`shrink-0 transition-transform ${
              expanded ? 'opacity-0 group-hover:opacity-100 peer-focus-visible:opacity-100' : '-rotate-90'
            }`}
          />
        </span>
        {actions && <span className="relative flex shrink-0 items-center gap-px pr-step-2xs">{actions}</span>}
      </div>
      {expanded && children}
    </div>
  )
}

function ChevronIcon({ className }: { className: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}
