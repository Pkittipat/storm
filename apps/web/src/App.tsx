import { useState } from 'react'
import {
  BlockCard,
  Button,
  Composer,
  FieldRow,
  Header,
  NavGroupLabel,
  NavItem,
  Panel,
  PanelSection,
  Sidebar,
  Tabs,
  ZoomControl,
  type BlockKind,
} from './components'

interface CanvasBlock {
  kind: BlockKind
  title: string
  left: number
  actor?: boolean
  hotspots?: number
}

const canvasBlocks: CanvasBlock[] = [
  { kind: 'readmodel', title: 'Cart', left: 20, actor: true },
  { kind: 'command', title: 'Place Order', left: 192, actor: true, hotspots: 1 },
  { kind: 'aggregate', title: 'Order', left: 364 },
  { kind: 'event', title: 'Order Placed', left: 536 },
]

function App() {
  const [selected, setSelected] = useState<BlockKind | null>('command')
  const [tab, setTab] = useState('details')

  const selectedBlock = canvasBlocks.find((b) => b.kind === selected)

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar userInitial="F" userName="Fang">
        <NavGroupLabel>Processes</NavGroupLabel>
        <NavItem href="#" active>
          Place Order
        </NavItem>
        <NavItem href="#">Cancel Order</NavItem>

        <div className="mt-nav-group-gap">
          <NavGroupLabel>No project</NavGroupLabel>
          <NavItem href="#">Register Customer</NavItem>
        </div>
      </Sidebar>

      <main className="flex min-w-0 flex-grow flex-col">
        <Header
          title="Place Order"
          actions={
            <>
              <Button variant="secondary">Share</Button>
              <Button variant="primary">Generate code</Button>
            </>
          }
        />

        <div className="flex min-h-0 flex-grow">
          <section
            aria-label="Process canvas"
            className="relative flex-grow overflow-hidden bg-surface"
            style={{
              backgroundImage: 'radial-gradient(var(--color-canvas-dot) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <div className="absolute top-step-2xl left-step-2xl">
              <ZoomControl percent={100} />
            </div>

            {canvasBlocks.map((block) => (
              <button
                key={block.kind}
                type="button"
                onClick={() => setSelected(block.kind)}
                className="absolute cursor-pointer border-0 bg-transparent p-0 text-left"
                style={{ left: block.left, top: 300 }}
              >
                <BlockCard
                  kind={block.kind}
                  title={block.title}
                  actor={block.actor}
                  hotspots={block.hotspots}
                  selected={block.kind === selected}
                />
              </button>
            ))}

            <div className="absolute right-0 bottom-step-3xl left-0 flex justify-center px-step-3xl">
              <div className="w-full max-w-2xl">
                <Composer onAddBlock={(kind) => setSelected(kind)} />
              </div>
            </div>
          </section>

          {selectedBlock && (
            <Panel kind={selectedBlock.kind} title={selectedBlock.title} onClose={() => setSelected(null)}>
              <Tabs
                tabs={[
                  { id: 'details', label: 'Details' },
                  { id: 'code', label: 'Code' },
                ]}
                activeId={tab}
                onChange={setTab}
              />

              {tab === 'details' ? (
                <>
                  <PanelSection label="Fields">
                    <FieldRow name="cartID" fieldType="CartID" />
                    <FieldRow name="customerID" fieldType="CustomerID" />
                    <FieldRow name="shippingAddress" fieldType="Address" />
                  </PanelSection>
                  <PanelSection label="Flow">
                    <div className="flex h-control-md items-center gap-step-lg rounded-lg px-step-md text-body text-text">
                      <span className="h-indicator-sm w-indicator-sm shrink-0 rounded-xs bg-aggregate" />
                      <span className="flex-grow">Order</span>
                      <span className="text-meta text-text-muted">handled by</span>
                    </div>
                  </PanelSection>
                </>
              ) : (
                <PanelSection label="Generated files" action={<span className="font-mono text-chip text-text-muted">Go</span>}>
                  <pre className="m-0 overflow-hidden rounded-lg bg-surface p-step-md font-mono text-[11px] leading-relaxed text-text">
                    {`type PlaceOrder struct {\n    CartID          CartID\n    CustomerID      CustomerID\n    ShippingAddress Address\n}`}
                  </pre>
                </PanelSection>
              )}
            </Panel>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
