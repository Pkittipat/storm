import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'

interface MenuProps {
  'aria-label': string
  /** Positioning against the trigger's wrapper, e.g. `top-full left-0 mt-step-2xs`. */
  className?: string
  /** Inline position, e.g. a context menu's cursor coordinates (with `className="fixed"`). */
  style?: CSSProperties
  children: ReactNode
}

/** The floating "elevation 2" dropdown shell shared by every sidebar/header menu (same chrome as AddBlockMenu). */
export function Menu({ className = '', children, ...props }: MenuProps) {
  return (
    <div
      role="menu"
      {...props}
      className={`z-20 flex w-menu-width flex-col gap-0 rounded-xl border border-border-elevated bg-surface-raised p-step-2xs shadow-float-md ${className.includes('fixed') ? '' : 'absolute'} ${className}`}
    >
      {children}
    </div>
  )
}

/** A muted heading inside a Menu, e.g. "Sort by". */
export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="px-step-sm pt-1.25 pb-step-2xs text-chip font-medium text-text-muted">{children}</div>
}

interface MenuItemProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Makes it a radio item with a check mark when true (false = unchecked radio, undefined = plain item). */
  checked?: boolean
  danger?: boolean
}

export function MenuItem({ checked, danger, children, className = '', ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role={checked === undefined ? 'menuitem' : 'menuitemradio'}
      aria-checked={checked}
      className={`flex h-control-sm shrink-0 items-center gap-step-md rounded-md border-0 bg-transparent px-step-sm text-left text-label outline-none hover:bg-surface-sunken focus-visible:bg-surface-sunken ${
        danger ? 'text-hotspot-text' : 'text-text'
      } ${className}`}
      {...props}
    >
      <span className="min-w-0 flex-grow truncate">{children}</span>
      {checked && <CheckIcon />}
    </button>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-text-muted">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
