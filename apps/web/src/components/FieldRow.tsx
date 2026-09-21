import type { ReactNode } from 'react'

interface FieldRowProps {
  name: string
  fieldType: string
}

/** A mono key/value row in the inspector's Fields section (e.g. `cartID CartID`). */
export function FieldRow({ name, fieldType }: FieldRowProps) {
  return (
    <div className="flex h-control-md items-center justify-between rounded-lg px-step-md font-mono text-mono-field text-text">
      <span>{name}</span>
      <span className="text-text-muted">{fieldType}</span>
    </div>
  )
}

/** A section heading inside the inspector, with a top divider and optional trailing action. */
export function PanelSection({
  label,
  action,
  children,
}: {
  label: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mt-step-xl flex flex-col gap-px border-t border-border pt-step-lg">
      <div className="flex h-control-xs items-center justify-between pt-0 pr-step-2xs pb-step-2xs pl-step-md text-label font-medium text-text-muted">
        <span>{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}
