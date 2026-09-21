import type { ButtonHTMLAttributes, ReactNode } from 'react'

const sizeClasses = {
  // 28px / rounded-md — dense inline actions (sidebar search/filter, inspector "add field").
  sm: 'h-control-xs w-control-xs rounded-md',
  // 32px / rounded-lg — chrome-level actions (collapse sidebar, settings, close inspector).
  md: 'h-control-md w-control-md rounded-lg',
} as const

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: keyof typeof sizeClasses
  icon: ReactNode
  /** Required — icon-only buttons must have an accessible name. */
  'aria-label': string
}

/**
 * A borderless, transparent square icon button. Always `text-text-muted`
 * at rest (the source never shows a hover/active fill — background stays
 * transparent). Use `size="sm"` for actions embedded inside a dense row
 * and `size="md"` for standalone chrome actions. For the composer's
 * 40px add-block button or its 36px circular send button, build those
 * inline in Composer — they use radius-node/rounded-full instead of
 * this component's sizes and aren't reused elsewhere.
 */
export function IconButton({ size = 'md', icon, className = '', ...props }: IconButtonProps) {
  return (
    <button
      className={`flex items-center justify-center border-0 bg-transparent text-text-muted ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {icon}
    </button>
  )
}
