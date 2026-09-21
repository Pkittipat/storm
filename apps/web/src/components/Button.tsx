import type { ButtonHTMLAttributes } from 'react'

const variantClasses = {
  // "Share" — a bordered control resting on surface-raised.
  secondary: 'border border-border-input bg-surface-raised text-text',
  // The one filled/inverted button in the system.
  primary: 'border-0 bg-text text-surface',
} as const

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof variantClasses
}

/**
 * The header/toolbar text button (36px tall, 9px radius — the one place
 * that radius is used). Use `variant="primary"` for the single primary
 * action in a toolbar (e.g. "YAML") and `variant="secondary"`
 * for everything else next to it (e.g. "Share"). Not for icon-only
 * buttons — use IconButton for those.
 */
export function Button({ variant = 'secondary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      className={`flex h-control-lg items-center gap-step-sm rounded-toolbar px-step-xl text-label font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
