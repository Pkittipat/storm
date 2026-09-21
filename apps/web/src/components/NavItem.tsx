import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean
  /**
   * Hover/focus-revealed buttons on the row's right edge (e.g. a ⋮ menu).
   * They sit beside the link, never inside it — a button can't nest in an <a>.
   */
  actions?: ReactNode
  children: ReactNode
}

/**
 * A leaf link in the sidebar process list — a 32px row with a leading
 * status dot. `active` fills the row with surface-selected, bumps the
 * label to semibold, and fills the dot; inactive rows get an outlined
 * dot instead. The 16px left inset (step-2xl) sets the dot just
 * inside its NavProject heading's name, which starts at step-md.
 */
export function NavItem({ active = false, actions, children, className = '', ...props }: NavItemProps) {
  const link = (
    <a
      aria-current={active ? 'page' : undefined}
      className={`flex h-control-md shrink-0 items-center gap-step-lg rounded-lg py-0 text-body no-underline ${actions ? 'pr-control-xs' : 'pr-step-md'} pl-step-2xl ${active ? 'bg-surface-selected font-semibold text-text' : 'font-normal text-text group-hover:bg-surface-hover hover:bg-surface-hover'} ${className}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className={
          active
            ? 'h-indicator-xs w-indicator-xs shrink-0 rounded-full bg-text'
            : 'h-indicator-xs w-indicator-xs shrink-0 rounded-full border border-border-dot box-border'
        }
      />
      {children}
    </a>
  )
  if (!actions) return link
  return (
    <div className="group relative flex shrink-0 flex-col">
      {link}
      <span className="absolute inset-y-0 right-0 flex items-center pr-step-2xs opacity-0 group-hover:opacity-100 focus-within:opacity-100 has-[[aria-expanded=true]]:opacity-100">
        {actions}
      </span>
    </div>
  )
}

/** An uppercase 11px group heading above a run of NavItems (e.g. "No project"). */
export function NavGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-step-md pb-step-xs text-micro font-medium tracking-label text-text-muted uppercase">{children}</div>
  )
}
