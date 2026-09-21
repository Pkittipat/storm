interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeId: string
  onChange: (id: string) => void
}

/** The two-tab switcher at the top of the inspector panel (Details / Code). */
export function Tabs({ tabs, activeId, onChange }: TabsProps) {
  return (
    <div role="tablist" className="flex gap-step-3xs pt-0 pr-0 pb-step-2xs pl-0">
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`h-control-md rounded-lg border-0 px-step-md text-body ${
              active ? 'bg-surface-selected font-semibold text-text' : 'bg-transparent font-normal text-text'
            }`}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
