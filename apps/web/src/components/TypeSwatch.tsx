import { blockKindClasses, type BlockKind } from './types'

const sizeClasses = {
  xs: 'h-indicator-xs w-indicator-xs', // 6px — block-card eyebrow label
  sm: 'h-indicator-sm w-indicator-sm', // 7px — inspector "Flow" list rows
  md: 'h-indicator-md w-indicator-md', // 8px — "Add block" menu items
} as const

interface TypeSwatchProps {
  kind: BlockKind
  size?: keyof typeof sizeClasses
}

/**
 * The small square color-swatch that identifies a block's domain type.
 * Usage: block-card eyebrow labels (`xs`), the inspector's Flow list (`sm`),
 * and Add-block menu items (`md`). Always `rounded-xs` — never a circle
 * (circles are reserved for status/connector dots, see the Dot pattern
 * inlined in BlockCard/NavItem).
 */
export function TypeSwatch({ kind, size = 'xs' }: TypeSwatchProps) {
  return <span aria-hidden="true" className={`shrink-0 rounded-xs ${sizeClasses[size]} ${blockKindClasses[kind].swatch}`} />
}
