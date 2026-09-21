import type { Block, BlockPatch, Board, Field } from '@stormm/process-model'
import { useState } from 'react'
import { EditableText, IconButton, Panel, PanelSection, TypeSwatch } from '../components'

interface InspectorProps {
  block: Block
  board: Board
  onChange: (patch: BlockPatch) => void
  onDelete: () => void
  onSelectBlock: (id: string) => void
  onClose: () => void
}

/** The docked block inspector: edit a block's title, actor, hotspots and fields, and see what it connects to. */
export function Inspector({ block, board, onChange, onDelete, onSelectBlock, onClose }: InspectorProps) {
  // The row just added via "+", focused with its placeholder selected.
  const [fresh, setFresh] = useState<'hotspot' | 'field' | null>(null)
  const byId = new Map(board.blocks.map((b) => [b.id, b]))
  const links = board.connections.flatMap((c) => {
    const id = `${c.from}->${c.to}`
    if (c.from === block.id) return byId.has(c.to) ? [{ id, block: byId.get(c.to)!, dir: 'to' }] : []
    if (c.to === block.id) return byId.has(c.from) ? [{ id, block: byId.get(c.from)!, dir: 'from' }] : []
    return []
  })

  const setFields = (fields: Field[]) => onChange({ fields })
  const setHotspots = (hotspots: string[]) => onChange({ hotspots })

  return (
    <Panel
      kind={block.kind}
      title={
        <EditableText
          key={block.id}
          aria-label="Block title"
          value={block.title}
          required
          onCommit={(title) => onChange({ title })}
          className="-mx-1 w-full px-1"
        />
      }
      onClose={onClose}
    >
      <div className="-mx-step-lg min-h-0 flex-grow overflow-y-auto px-step-lg">
            <PanelSection label="Actor">
              <EditableText
                aria-label="Actor"
                value={block.actor ?? ''}
                placeholder="Who does this? e.g. Customer"
                onCommit={(actor) => onChange({ actor })}
                className="h-control-md px-step-md text-body text-text"
              />
            </PanelSection>

            <PanelSection label="Hotspots" action={<AddButton label="Add hotspot" onClick={() => {
                setFresh('hotspot')
                setHotspots([...block.hotspots, 'Open question'])
              }} />}>
              {block.hotspots.length === 0 && <Empty>No open questions</Empty>}
              {block.hotspots.map((h, i) => (
                <Row key={i} onRemove={() => setHotspots(block.hotspots.filter((_, j) => j !== i))} removeLabel="Remove hotspot">
                  <span aria-hidden="true" className="h-indicator-sm w-indicator-sm shrink-0 rounded-full bg-hotspot-dot" />
                  <EditableText
                    aria-label={`Hotspot ${i + 1}`}
                    value={h}
                    required
                    autoFocus={fresh === 'hotspot' && i === block.hotspots.length - 1}
                    onBlur={() => setFresh(null)}
                    onCommit={(v) => setHotspots(block.hotspots.map((x, j) => (j === i ? v : x)))}
                    className="h-control-sm flex-grow px-1 text-body text-text"
                  />
                </Row>
              ))}
            </PanelSection>

            <PanelSection label="Fields" action={<AddButton label="Add field" onClick={() => {
                setFresh('field')
                setFields([...block.fields, { name: 'field', type: 'string' }])
              }} />}>
              {block.fields.length === 0 && <Empty>No fields yet</Empty>}
              {block.fields.map((f, i) => (
                <Row key={i} onRemove={() => setFields(block.fields.filter((_, j) => j !== i))} removeLabel={`Remove field ${f.name}`}>
                  <EditableText
                    aria-label="Field name"
                    value={f.name}
                    required
                    autoFocus={fresh === 'field' && i === block.fields.length - 1}
                    onBlur={() => setFresh(null)}
                    onCommit={(name) => setFields(block.fields.map((x, j) => (j === i ? { ...x, name } : x)))}
                    className="h-control-sm w-0 flex-grow px-1 font-mono text-mono-field text-text"
                  />
                  <EditableText
                    aria-label={`Type of ${f.name}`}
                    value={f.type}
                    required
                    onCommit={(type) => setFields(block.fields.map((x, j) => (j === i ? { ...x, type } : x)))}
                    className="h-control-sm w-0 flex-grow px-1 text-right font-mono text-mono-field text-text-muted"
                  />
                </Row>
              ))}
            </PanelSection>

            <PanelSection label="Connections">
              {links.length === 0 && <Empty>Drag from the right port to connect</Empty>}
              {links.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => onSelectBlock(f.block.id)}
                  className="flex h-control-md items-center gap-step-lg rounded-lg border-0 bg-transparent px-step-md text-left text-body text-text"
                >
                  <TypeSwatch kind={f.block.kind} size="sm" />
                  <span className="flex-grow truncate">{f.block.title}</span>
                  <span className="text-meta text-text-muted">{f.dir}</span>
                </button>
              ))}
            </PanelSection>

            <div className="mt-step-xl border-t border-border pt-step-lg">
              <button type="button" onClick={onDelete} className="h-control-md w-full rounded-lg border-0 bg-transparent px-step-md text-left text-body text-hotspot-text">
                Delete block
              </button>
            </div>
      </div>
    </Panel>
  )
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <IconButton size="sm" aria-label={label} onClick={onClick} icon={<span className="text-base">+</span>} />
}

function Row({ children, onRemove, removeLabel }: { children: React.ReactNode; onRemove: () => void; removeLabel: string }) {
  return (
    <div className="group flex h-control-md items-center gap-step-sm rounded-lg pl-step-md">
      {children}
      <IconButton size="sm" aria-label={removeLabel} onClick={onRemove} className="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100" icon={<span aria-hidden="true">&times;</span>} />
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-step-md py-step-xs text-meta text-text-muted">{children}</div>
}
