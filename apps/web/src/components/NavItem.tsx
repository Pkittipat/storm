import type { AnchorHTMLAttributes, ReactNode } from 'react'

interface NavItemProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  active?: boolean
  children: ReactNode
}

/**
 * A leaf link in the sidebar process list — a 32px row with a leading
 * status dot. `active` fills the row with surface-selected, bumps the
 * label to semibold, and fills the dot; inactive rows get an outlined
 * dot instead. The 30px left indent is a raw value, not a spacing
 * token — it's a one-off alignment offset (clears the group label's
 * bullet above it), not a reused rhythm, so it stays literal.
 */
export function NavItem({ active = false, children, className = '', ...props }: NavItemProps) {
  return (
    <a
      aria-current={active ? 'page' : undefined}
      className={`flex h-control-md items-center gap-step-lg rounded-lg py-0 pr-step-md pl-7.5 text-body no-underline ${
        active ? 'bg-surface-selected font-semibold text-text' : 'font-normal text-text'
      } ${className}`}
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
}

/** An uppercase 11px group heading above a run of NavItems (e.g. "No project"). */
export function NavGroupLabel({ children }: { children: ReactNode }) {
  return (
    <div className="px-step-md pb-step-xs text-micro font-medium tracking-label text-text-muted uppercase">{children}</div>
  )
}
