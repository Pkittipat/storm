import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import type { Block, Connection } from '../api'
import { BlockCard, ZoomControl } from '../components'
import { BLOCK_HEIGHT, BLOCK_WIDTH, PORT_Y, connectorPath, snap, type Point } from './geometry'

export type Selection = { type: 'block'; id: string } | { type: 'connection'; id: string } | null

export interface Viewport {
  x: number
  y: number
  zoom: number
}

interface CanvasProps {
  blocks: Block[]
  connections: Connection[]
  selection: Selection
  viewport: Viewport
  onViewportChange: (v: Viewport) => void
  onSelect: (s: Selection) => void
  onMoveBlock: (id: string, x: number, y: number) => void
  onConnect: (sourceId: string, targetId: string) => void
  /** Floating overlays (composer, empty state) rendered above the world, unscaled. */
  children?: ReactNode
}

const ZOOM_MIN = 0.25
const ZOOM_MAX = 2

type Gesture =
  | { type: 'pan'; start: Point; origin: Viewport; moved: boolean }
  | { type: 'drag'; id: string; start: Point; origin: Point; moved: boolean }
  | { type: 'connect'; sourceId: string }

/**
 * The process canvas: a pannable, zoomable world of blocks and
 * connectors. Owns only transient gesture state (a block mid-drag, a
 * connector mid-draw); every committed change goes out through the
 * callbacks.
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
  children,
}: CanvasProps) {
  const ref = useRef<HTMLElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const [dragPos, setDragPos] = useState<{ id: string } & Point | null>(null)
  const [pending, setPending] = useState<{ sourceId: string; to: Point } | null>(null)

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = ref.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - viewport.x) / viewport.zoom, y: (clientY - rect.top - viewport.y) / viewport.zoom }
  }

  const blockAt = (p: Point) =>
    [...blocks].reverse().find((b) => p.x >= b.x && p.x <= b.x + BLOCK_WIDTH && p.y >= b.y && p.y <= b.y + BLOCK_HEIGHT)

  const zoomAround = (next: number, cx: number, cy: number) => {
    const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next))
    const k = zoom / viewport.zoom
    onViewportChange({ zoom, x: cx - (cx - viewport.x) * k, y: cy - (cy - viewport.y) * k })
  }

  const zoomStep = (dir: 1 | -1) => {
    const rect = ref.current!.getBoundingClientRect()
    zoomAround(Math.round((viewport.zoom + dir * 0.1) * 10) / 10, rect.width / 2, rect.height / 2)
  }

  // Wheel needs a non-passive listener to preventDefault the browser's page zoom/scroll.
  useEffect(() => {
    const el = ref.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        zoomAround(viewport.zoom * Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top)
      } else {
        onViewportChange({ ...viewport, x: viewport.x - e.deltaX, y: viewport.y - e.deltaY })
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  // Pan just enough to bring a newly selected block into view (e.g. one just added, or picked from the inspector's Flow list).
  const revealed = useRef<string | null>(null)
  useEffect(() => {
    const id = selection?.type === 'block' ? selection.id : null
    if (id === revealed.current) return
    revealed.current = id
    const b = blocks.find((x) => x.id === id)
    if (!b || !ref.current) return
    const { width, height } = ref.current.getBoundingClientRect()
    const pad = 48
    const left = b.x * viewport.zoom + viewport.x
    const top = b.y * viewport.zoom + viewport.y
    const right = left + BLOCK_WIDTH * viewport.zoom
    const bottom = top + BLOCK_HEIGHT * viewport.zoom
    const dx = right > width - pad ? width - pad - right : left < pad ? pad - left : 0
    const dy = bottom > height - pad ? height - pad - bottom : top < pad ? pad - top : 0
    if (dx || dy) onViewportChange({ ...viewport, x: viewport.x + dx, y: viewport.y + dy })
  }, [selection, blocks, viewport, onViewportChange])

  const onPointerMove = (e: ReactPointerEvent) => {
    const g = gesture.current
    if (!g) return
    if (g.type === 'pan') {
      const dx = e.clientX - g.start.x
      const dy = e.clientY - g.start.y
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
      onViewportChange({ ...g.origin, x: g.origin.x + dx, y: g.origin.y + dy })
    } else if (g.type === 'drag') {
      const dx = (e.clientX - g.start.x) / viewport.zoom
      const dy = (e.clientY - g.start.y) / viewport.zoom
      if (Math.abs(dx) + Math.abs(dy) > 3) g.moved = true
      if (g.moved) setDragPos({ id: g.id, x: snap(g.origin.x + dx), y: snap(g.origin.y + dy) })
    } else {
      setPending({ sourceId: g.sourceId, to: toWorld(e.clientX, e.clientY) })
    }
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gesture.current
    gesture.current = null
    if (!g) return
    if (g.type === 'pan' && !g.moved) onSelect(null)
    if (g.type === 'drag') {
      if (g.moved && dragPos && (dragPos.x !== g.origin.x || dragPos.y !== g.origin.y)) {
        onMoveBlock(g.id, dragPos.x, dragPos.y)
      }
      setDragPos(null)
    }
    if (g.type === 'connect') {
      const target = blockAt(toWorld(e.clientX, e.clientY))
      if (target && target.id !== g.sourceId) onConnect(g.sourceId, target.id)
      setPending(null)
    }
  }

  const capture = (e: ReactPointerEvent) => ref.current!.setPointerCapture(e.pointerId)

  const positioned = blocks.map((b) => (dragPos?.id === b.id ? { ...b, x: dragPos.x, y: dragPos.y } : b))
  const byId = new Map(positioned.map((b) => [b.id, b]))
  const rightPort = (b: Block) => ({ x: b.x + BLOCK_WIDTH, y: b.y + PORT_Y })
  const leftPort = (b: Block) => ({ x: b.x, y: b.y + PORT_Y })

  return (
    <section
      ref={ref}
      aria-label="Process canvas"
      className={`relative flex-grow touch-none overflow-hidden bg-surface select-none ${pending ? 'cursor-crosshair' : ''}`}
      style={{
        backgroundImage: 'radial-gradient(var(--color-canvas-dot) 1px, transparent 1px)',
        backgroundSize: `${20 * viewport.zoom}px ${20 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={(e) => {
        if (e.button !== 0 || e.target !== e.currentTarget) return
        capture(e)
        gesture.current = { type: 'pan', start: { x: e.clientX, y: e.clientY }, origin: viewport, moved: false }
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <div
        className="pointer-events-none absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        <svg className="absolute top-0 left-0 overflow-visible" width="1" height="1" aria-label="Connections">
          {connections.map((c) => {
            const source = byId.get(c.sourceId)
            const target = byId.get(c.targetId)
            if (!source || !target) return null
            const d = connectorPath(rightPort(source), leftPort(target))
            const selected = selection?.type === 'connection' && selection.id === c.id
            return (
              <g key={c.id}>
                <path d={d} fill="none" stroke={selected ? 'var(--color-accent)' : 'var(--color-connector)'} strokeWidth={1.5} strokeLinecap="round" />
                {/* Wide invisible twin so the 1.5px line is clickable. */}
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={12}
                  className="pointer-events-auto cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    onSelect({ type: 'connection', id: c.id })
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
            className={`pointer-events-auto absolute ${dragPos?.id === b.id ? 'cursor-grabbing' : 'cursor-grab'}`}
            style={{ left: b.x, top: b.y }}
            onPointerDown={(e) => {
              if (e.button !== 0) return
              e.stopPropagation()
              capture(e)
              onSelect({ type: 'block', id: b.id })
              gesture.current = { type: 'drag', id: b.id, start: { x: e.clientX, y: e.clientY }, origin: { x: b.x, y: b.y }, moved: false }
            }}
          >
            <BlockCard
              kind={b.kind}
              title={b.title}
              actor={b.actor}
              hotspots={b.hotspots.length}
              selected={selection?.type === 'block' && selection.id === b.id}
              onConnectStart={(e) => {
                if (e.button !== 0) return
                e.stopPropagation()
                capture(e)
                gesture.current = { type: 'connect', sourceId: b.id }
                setPending({ sourceId: b.id, to: toWorld(e.clientX, e.clientY) })
              }}
            />
          </div>
        ))}
      </div>

      <div className="absolute top-step-2xl left-step-2xl">
        <ZoomControl percent={Math.round(viewport.zoom * 100)} onZoomIn={() => zoomStep(1)} onZoomOut={() => zoomStep(-1)} />
      </div>

      {children}
    </section>
  )
}
