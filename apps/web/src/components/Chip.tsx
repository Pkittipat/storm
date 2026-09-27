import type { ReactNode } from 'react'

const variantClasses = {
  // The actor/"Customer" tag attached to a block.
  actor: 'bg-actor text-actor-text',
  // The hotspot-count tag attached to a block: solid red so open questions stand out.
  hotspot: 'bg-hotspot text-hotspot-on',
  // The invariant-count tag attached to an aggregate.
  invariant: 'bg-aggregate-line text-text',
} as const

interface ChipProps {
  variant: keyof typeof variantClasses
  icon?: ReactNode
  children: ReactNode
  'aria-label'?: string
}

/**
 * A compact 22px-tall pill shown inside a BlockCard's footer row. Uses
 * the dedicated `text-chip` (11.5px) size token, not `text-meta` or
 * `text-micro` — those read wrong at this pill height. Not a general-
 * purpose badge; only these variants exist.
 */
export function Chip({ variant, icon, children, ...rest }: ChipProps) {
  return (
    <span
      className={`flex h-control-2xs items-center gap-step-2xs rounded-md px-chip-inset text-chip font-medium ${variantClasses[variant]}`}
      {...rest}
    >
      {icon}
      {children}
    </span>
  )
}
