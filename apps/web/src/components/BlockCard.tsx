import { useRef, useState, type PointerEvent } from 'react'
import { Chip } from './Chip'
import { TypeSwatch } from './TypeSwatch'
import { blockKindClasses, blockKindLabel, type BlockKind } from './types'

interface BlockCardProps {
  kind: BlockKind
  title: string
  selected?: boolean
  /** Who performs this step (e.g. "Customer") — an attribute of the block, never a block of its own. */
  actor?: string | null
  hotspots?: number
  /** Shows the title as a text box (double-click on the canvas); Enter or blur commits, Escape cancels. */
  editing?: boolean
  onTitleCommit?: (title: string) => void
  onEditEnd?: () => void
  /** Makes the right-hand port a drag handle for drawing an outgoing connection. */
  onConnectStart?: (e: PointerEvent<HTMLSpanElement>) => void
  /** Absolutely-positions the card on a canvas. Omit to let it flow inline (as in a palette/showcase). */
  position?: { left: number; top: number }
}

/**
 * The core unit of the process canvas — a 140×104 card representing one
 * of the five domain concepts. Selection is accent-driven, not type-
 * driven: a selected card always gets a 1.5px accent border + a
 * ring-accent/[14%] glow, regardless of `kind` (its own `-line` border
 * is dropped while selected). Connector ports (the small circles on the
 * left/right edge) switch from --color-port to --color-accent the same
 * way. Renders inline by default; pass `position` to place it
 * absolutely on a canvas surface (the parent must be `position:
 * relative`).
 */
export function BlockCard({ kind, title, selected = false, actor, hotspots, editing, onTitleCommit, onEditEnd, onConnectStart, position }: BlockCardProps) {
  const { surface, line } = blockKindClasses[kind]
  const portClass = selected ? 'border-accent' : 'border-port'
  const border = selected ? 'border-[1.5px] border-accent' : line
  const ring = selected ? 'ring-4 ring-accent/[14%]' : ''

  return (
    <div className="flex flex-col gap-step-2xs" style={position ? { position: 'absolute', left: position.left, top: position.top } : undefined}>
      <div className="flex items-center gap-step-xs px-step-2xs font-mono text-micro font-medium tracking-mono-label text-text-muted uppercase">
        <TypeSwatch kind={kind} />
        {blockKindLabel[kind]}
      </div>
      <div className={`relative box-border flex h-node-height w-node-width flex-col gap-step-xs rounded-node border p-step-lg ${surface} ${border} ${ring}`}>
        {editing ? (
          <TitleEditor title={title} onCommit={(t) => onTitleCommit?.(t)} onDone={() => onEditEnd?.()} />
        ) : (
          <div className="line-clamp-2 text-emphasis font-semibold break-words text-text">{title}</div>
        )}
        {actor || hotspots ? (
          <div className="mt-auto flex gap-step-2xs">
            {actor && <Chip variant="actor">{actor}</Chip>}
            {hotspots ? <Chip variant="hotspot" aria-label={`${hotspots} hotspot`}>{hotspots}</Chip> : null}
          </div>
        ) : null}
        <Port className={portClass} side="left" />
        <Port className={portClass} side="right" onPointerDown={onConnectStart} />
      </div>
    </div>
  )
}

/** The card's title as a two-line text box; the pointer stays in it (no drag or pan while editing). */
function TitleEditor({ title, onCommit, onDone }: { title: string; onCommit: (title: string) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(title)
  // Enter/Escape end it; the blur that follows as it unmounts must not commit a second time.
  const done = useRef(false)
  const finish = (commit: boolean) => {
    if (done.current) return
    done.current = true
    const next = draft.trim()
    if (commit && next && next !== title) onCommit(next)
    onDone()
  }
  return (
    <textarea
      aria-label="Block title"
      autoFocus
      rows={2}
      value={draft}
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setDraft(e.target.value.replace(/\n/g, ' '))}
      onPointerDown={(e) => e.stopPropagation()}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') {
          e.preventDefault()
          finish(true)
        }
        if (e.key === 'Escape') finish(false)
      }}
      className="-mx-1 -my-0.5 resize-none rounded-md border-0 bg-surface-raised px-1 py-0.5 font-sans text-emphasis font-semibold text-text ring-1 ring-border-input outline-none"
    />
  )
}

function Port({
  side,
  className,
  onPointerDown,
}: {
  side: 'left' | 'right'
  className: string
  onPointerDown?: (e: PointerEvent<HTMLSpanElement>) => void
}) {
  return (
    <span
      aria-hidden="true"
      data-port={side}
      onPointerDown={onPointerDown}
      className={`absolute top-11.75 ${
        // An invisible 25px hit area around the 9px dot, so it's grabbable.
        onPointerDown ? "cursor-crosshair before:absolute before:-inset-2 before:content-['']" : ''
      } box-border h-indicator-lg w-indicator-lg rounded-full border-[1.5px] bg-surface-raised ${
        side === 'left' ? '-left-indicator-offset' : '-right-indicator-offset'
      } ${className}`}
    />
  )
}
