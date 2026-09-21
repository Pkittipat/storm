import { useState } from 'react'
import type { Block, BlockField, BlockPatch, Process } from '../api'
import { EditableText, IconButton, Panel, PanelSection, Tabs, TypeSwatch } from '../components'
import { generateBlock } from '../codegen'

interface InspectorProps {
  block: Block
  process: Process
  onChange: (patch: BlockPatch) => void
  onDelete: () => void
  onSelectBlock: (id: string) => void
  onClose: () => void
}

/** The docked block inspector: edit a block's title, actor, hotspots and fields; preview its generated Go. */
export function Inspector({ block, process, onChange, onDelete, onSelectBlock, onClose }: InspectorProps) {
  const [tab, setTab] = useState('details')
  // The row just added via "+", focused with its placeholder selected.
  const [fresh, setFresh] = useState<'hotspot' | 'field' | null>(null)
  const byId = new Map(process.blocks.map((b) => [b.id, b]))
  const flow = process.connections.flatMap((c) => {
    if (c.sourceId === block.id) return byId.has(c.targetId) ? [{ id: c.id, block: byId.get(c.targetId)!, dir: 'to' }] : []
    if (c.targetId === block.id) return byId.has(c.sourceId) ? [{ id: c.id, block: byId.get(c.sourceId)!, dir: 'from' }] : []
    return []
  })

  const setFields = (fields: BlockField[]) => onChange({ fields })
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
      <Tabs
        tabs={[
          { id: 'details', label: 'Details' },
          { id: 'code', label: 'Code' },
        ]}
        activeId={tab}
        onChange={setTab}
      />

      <div className="-mx-step-lg min-h-0 flex-grow overflow-y-auto px-step-lg">
        {tab === 'details' ? (
          <>
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

            <PanelSection label="Flow">
              {flow.length === 0 && <Empty>Drag from the right port to connect</Empty>}
              {flow.map((f) => (
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
          </>
        ) : (
          <PanelSection label="Generated code" action={<span className="font-mono text-chip text-text-muted">Go</span>}>
            <pre className="m-0 overflow-x-auto rounded-lg bg-surface p-step-md font-mono text-[11px] leading-relaxed text-text">{generateBlock(block, process)}</pre>
          </PanelSection>
        )}
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
