import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { BlockCard, ZoomControl, type BlockKind } from '../components'
import { BLOCK_HEIGHT, BLOCK_WIDTH, PORT_Y, connectorPath, snap, type Point } from './geometry'

export type Selection = { type: 'block'; id: string } | { type: 'connection'; id: string } | null

export interface Viewport {
  x: number
  y: number
  zoom: number
}

/** A block where it currently sits: its derived position, or where this viewer dragged it. */
export interface CanvasBlock {
  id: string
  kind: BlockKind
  title: string
  actor?: string
  hotspots: number
  x: number
  y: number
}

export interface CanvasConnection {
  /** `from->to`, stable across saves. */
  id: string
  from: string
  to: string
}

interface CanvasProps {
  blocks: CanvasBlock[]
  connections: CanvasConnection[]
  selection: Selection
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  /** Omit all three (a read-only diff view) to disable selecting, dragging and connecting — panning/zooming still work. */
  onSelect?: (s: Selection) => void
  onMoveBlock?: (id: string, x: number, y: number) => void
  onConnect?: (sourceId: string, targetId: string) => void
  /** Double-clicking a block edits its title in place. */
  onRenameBlock?: (id: string, title: string) => void
  /** Floating overlays (composer, empty state) rendered above the world, unscaled. */
  children?: ReactNode
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2

type Gesture =
  | { type: 'pan'; start: Point; origin: Viewport; moved: boolean }
  | { type: 'drag'; id: string; start: Point; origin: Point; moved: boolean }
  | { type: 'connect'; sourceId: string }

/** How long the viewport must stay still before it's reported to the parent. */
const SETTLE_MS = 150

/**
 * The process canvas: a pannable, zoomable world of blocks and
 * connectors. Owns only transient gesture state (a block mid-drag, a
 * connector mid-draw, the live viewport while panning/zooming); every
 * committed change goes out through the callbacks.
 */
export function Canvas({
  blocks,
  connections,
  selection,
  viewport,
  onViewportChange,
  onSelect,
  onMoveBlock,
  onConnect,
  onRenameBlock,
  children,
}: CanvasProps) {
  const ref = useRef<HTMLElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string } & Point | null>(null)
  const [pending, setPending] = useState<{ sourceId: string; to: Point } | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // The live viewport. Panning and wheel-scrolling update it every frame but only re-render
  // the canvas; the parent hears about it once the view settles (reporting every frame would
  // re-render the whole app per pointer move, which is what made panning stutter).
  const [view, setLive] = useState(viewport)
  const [synced, setSynced] = useState(viewport)
  const [reported, setReported] = useState(viewport)
  if (viewport !== synced) {
    setSynced(viewport)
    // Adopt changes from outside (switching process); ignore our own report coming back.
    if (viewport !== reported) setLive(viewport)
  }
  const settle = useRef<ReturnType<typeof setTimeout>>(undefined)
  const report = (v: Viewport) => {
    clearTimeout(settle.current)
    setReported(v)
    onViewportChange(v)
  }
  const setView = (v: Viewport, when: 'settled' | 'now' = 'settled') => {
    setLive(v)
    clearTimeout(settle.current)
    if (when === 'now') report(v)
    else settle.current = setTimeout(() => report(v), SETTLE_MS)
  }
  useEffect(() => () => clearTimeout(settle.current), [])
  // Event listeners registered once read the current view and setter through refs.
  const live = useRef({ view, setView })
  useLayoutEffect(() => {
    live.current = { view, setView }
  })

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - view.x) / view.zoom, y: (clientY - rect.top - view.y) / view.zoom }
  }

  const blockAt = (p: Point) =>
    [...blocks].reverse().find((b) => p.x >= b.x && p.x <= b.x + BLOCK_WIDTH && p.y >= b.y && p.y <= b.y + BLOCK_HEIGHT)

  const zoomAround = (from: Viewport, next: number, cx: number, cy: number): Viewport => {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    const k = zoom / from.zoom
    return { zoom, x: cx - (cx - from.x) * k, y: cy - (cy - from.y) * k }
  }

  const zoomStep = (dir: 1 | -1) => {
    const rect = ref.current!.getBoundingClientRect()
    setView(zoomAround(view, Math.round((view.zoom + dir * 0.1) * 10) / 10, rect.width / 2, rect.height / 2), 'now')
  }

  // Wheel needs a non-passive listener to preventDefault the browser's page zoom/scroll. Registered
  // once; several wheel events can land in one frame, so each builds on the latest view, not the render's.
  useEffect(() => {
    const el = ref.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { view: v, setView: set } = live.current
      const rect = el.getBoundingClientRect()
      const next =
        e.ctrlKey || e.metaKey
          ? zoomAround(v, v.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
          : { ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }
      live.current.view = next
      set(next)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Pan just enough to bring a newly selected block into view (e.g. one just added, or picked from the inspector's Connections list).
  const revealed = useRef<string | null>(null)
  useEffect(() => {
    const id = selection?.type === 'block' ? selection.id : null
    if (id === revealed.current) return
    revealed.current = id
    const b = blocks.find((x) => x.id === id)
    if (!b || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const pad = 48
    const { view: v, setView: set } = live.current
    const left = b.x * v.zoom + v.x
    const top = b.y * v.zoom + v.y
    const right = left + BLOCK_WIDTH * v.zoom
    const bottom = top + BLOCK_HEIGHT * v.zoom
    const dx = right > width - pad ? width - pad - right : left < pad ? pad - left : 0
    const dy = bottom > height - pad ? height - pad - bottom : top < pad ? pad - top : 0
    if (dx || dy) set({ ...v, x: v.x + dx, y: v.y + dy }, 'now')
  }, [selection, blocks])

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.type === 'pan') {
      const dx = e.clientX - g.start.x
      const dy = e.clientY - g.start.y
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
      setView({ ...g.origin, x: g.origin.x + dx, y: g.origin.y + dy })
    } else if (g.type === 'drag') {
      const dx = (e.clientX - g.start.x) / view.zoom
      const dy = (e.clientY - g.start.y) / view.zoom
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
      // Follow the pointer exactly; snapping to the grid happens on drop.
      if (g.moved) setDragPos({ id: g.id, x: g.origin.x + dx, y: g.origin.y + dy })
    } else {
      setPending({ sourceId: g.sourceId, to: toWorld(e.clientX, e.clientY) })
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.type === 'pan') {
      if (g.moved) setView(view, 'now')
      else onSelect?.(null)
    }
    if (g.type === 'drag') {
      const x = dragPos && snap(dragPos.x)
      const y = dragPos && snap(dragPos.y)
      if (onMoveBlock && g.moved && x !== null && y !== null && (x !== g.origin.x || y !== g.origin.y)) onMoveBlock(g.id, x, y)
      setDragPos(null)
    }
    if (g.type === 'connect') {
      const target = blockAt(toWorld(e.clientX, e.clientY))
      if (onConnect && target && target.id !== g.sourceId) onConnect(g.sourceId, target.id)
      setPending(null)
    }
  }

  const capture = (e: ReactPointerEvent) => ref.current!.setPointerCapture(e.pointerId)

  const positioned = blocks.map((b) => (dragPos?.id === b.id ? { ...b, x: dragPos.x, y: dragPos.y } : b))
  const byId = new Map(positioned.map((b) => [b.id, b]))
  const rightPort = (b: CanvasBlock) => ({ x: b.x + BLOCK_WIDTH, y: b.y + PORT_Y })
  const leftPort = (b: CanvasBlock) => ({ x: b.x, y: b.y + PORT_Y })

  return (
    <section
      ref={ref}
      aria-label="Process canvas"
      className={`relative flex-grow touch-none overflow-hidden bg-surface select-none ${pending ? 'cursor-crosshair' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(var(--color-canvas-dot) 1px, transparent 1px)',
        backgroundSize: `${20 * view.zoom}px ${20 * view.zoom}px`,
        backgroundPosition: `${view.x}px ${view.y}px`,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return
        capture(e)
        gesture.current = { type: 'pan', start: { x: e.clientX, y: e.clientY }, origin: view, moved: false }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      // Pointer capture retargets clicks to the canvas itself, so find the block under the pointer here.
      onDoubleClick={(e) => {
        if (!onRenameBlock || (e.target as HTMLElement).closest('textarea')) return
        const target = blockAt(toWorld(e.clientX, e.clientY))
        if (target) setEditingId(target.id)
      }}
    >
      <div
        className="pointer-events-none absolute top-0 left-0 origin-top-left will-change-transform"
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}
      >
        <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-label="Connections">
          {connections.map((c) => {
            const source = byId.get(c.from)
            const target = byId.get(c.to)
            if (!source || !target) return null
            const d = connectorPath(rightPort(source), leftPort(target))
            const selected = selection?.type === 'connection' && selection.id === c.id
            const stroke = selected ? 'var(--color-accent)' : 'var(--color-connector)'
            return (
              <g key={c.id}>
                <path d={d} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" />
                {/* Wide invisible twin so the 1.5px line is clickable. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onSelect?.({ type: 'connection', id: c.id })
                  }}
                />
              </g>
            )
          })}
          {pending && byId.get(pending.sourceId) && (
            <path d={connectorPath(rightPort(byId.get(pending.sourceId)!), pending.to)} fill="none" stroke="var(--color-accent)" strokeWidth={1.5} strokeDasharray="4 4" />
          )}
        </svg>

        {positioned.map((b) => (
          <div
            key={b.id}
            data-block-id={b.id}
            className={`pointer-events-auto absolute ${onMoveBlock ? (dragPos?.id === b.id ? 'cursor-grabbing' : 'cursor-grab') : onSelect ? 'cursor-pointer' : ''}`}
            style={{ left: b.x, top: b.y }}
            onPointerDown={(e) => {
              if (e.button !== 0 || !onSelect) return
              e.stopPropagation()
              capture(e)
              onSelect({ type: 'block', id: b.id })
              if (onMoveBlock) gesture.current = { type: 'drag', id: b.id, start: { x: e.clientX, y: e.clientY }, origin: { x: b.x, y: b.y }, moved: false }
            }}
          >
            <BlockCard
              kind={b.kind}
              title={b.title}
              actor={b.actor}
              hotspots={b.hotspots}
              selected={selection?.type === 'block' && selection.id === b.id}
              editing={editingId === b.id}
              onTitleCommit={(title) => onRenameBlock?.(b.id, title)}
              onEditEnd={() => setEditingId(null)}
              onConnectStart={
                onConnect &&
                ((e) => {
                  if (e.button !== 0) return
                  e.stopPropagation()
                  capture(e)
                  gesture.current = { type: 'connect', sourceId: b.id }
                  setPending({ sourceId: b.id, to: toWorld(e.clientX, e.clientY) })
                })
              }
            />
          </div>
        ))}
      </div>

      <div className="absolute top-step-2xl left-step-2xl">
        <ZoomControl percent={Math.round(view.zoom * 100)} onZoomIn={() => zoomStep(1)} onZoomOut={() => zoomStep(-1)} />
      </div>

      {children}
    </section>
  )
}
