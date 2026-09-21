import type { ReactNode } from 'react'

interface HeaderProps {
  /** Plain text, or an inline editor (see EditableText) for a renameable title. */
  title: ReactNode
  /** Rendered before the title — e.g. a "show sidebars" IconButton in focus mode. */
  leading?: ReactNode
  actions?: ReactNode
}

/**
 * The 56px top toolbar: page title on the left, action buttons on the
 * right. Left padding shrinks from 24px to 12px when `leading` is
 * given — the source only ever shows `leading` (a "show sidebars"
 * IconButton) once the sidebar is hidden, at which point the header
 * needs less inset since the button itself provides the edge margin.
 */
export function Header({ title, leading, actions }: HeaderProps) {
  return (
    <header
      className={`flex h-header-height shrink-0 items-center justify-between border-b border-border-subtle bg-surface py-0 pr-step-2xl ${
        leading ? 'pl-step-lg' : 'pl-step-3xl'
      }`}
    >
      <div className="flex min-w-0 items-center gap-step-lg">
        {leading}
        <h1 className="m-0 min-w-0 text-emphasis font-semibold text-text">{title}</h1>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-step-sm whitespace-nowrap">{actions}</div>}
    </header>
  )
}
