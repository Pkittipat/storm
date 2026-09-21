/** The six event-storming domain concepts every canvas block belongs to. */
export type BlockKind = 'readmodel' | 'command' | 'aggregate' | 'event' | 'policy' | 'system'

export const blockKindLabel: Record<BlockKind, string> = {
  readmodel: 'Read model',
  command: 'Command',
  aggregate: 'Aggregate',
  event: 'Event',
  policy: 'Policy',
  system: 'System',
}

/**
 * Tailwind class pairs per block kind — literal strings so Tailwind's
 * scanner can find them (never build these with template interpolation).
 * `text` is for the inspector eyebrow label. Only Command's `text` value
 * is directly observed in the source (`--color-accent-text`, a darkened
 * tint chosen for legibility on white — the raw accent is a lighter
 * blue that needs it); the other five use their own accent color
 * directly, which is dark/saturated enough to stay legible without a
 * dedicated tint.
 */
export const blockKindClasses: Record<BlockKind, { swatch: string; surface: string; line: string; text: string }> = {
  readmodel: { swatch: 'bg-readmodel', surface: 'bg-readmodel-surface', line: 'border-readmodel-line', text: 'text-readmodel' },
  command: { swatch: 'bg-command', surface: 'bg-command-surface', line: 'border-command-line', text: 'text-accent-text' },
  aggregate: { swatch: 'bg-aggregate', surface: 'bg-aggregate-surface', line: 'border-aggregate-line', text: 'text-aggregate' },
  event: { swatch: 'bg-event', surface: 'bg-event-surface', line: 'border-event-line', text: 'text-event' },
  policy: { swatch: 'bg-policy', surface: 'bg-policy-surface', line: 'border-policy-line', text: 'text-policy' },
  system: { swatch: 'bg-system', surface: 'bg-system-surface', line: 'border-system-line', text: 'text-system' },
}
