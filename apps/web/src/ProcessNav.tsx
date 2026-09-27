import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ProcessSummary, Project } from './storage'
import {
  EditableText,
  IconButton,
  Menu,
  MenuItem,
  MenuLabel,
  NavItem,
  NavProject,
  useMenu,
} from './components'

type Sort = 'created' | 'name'

/** Per-browser sidebar preferences; storage can be unavailable (private mode), so every access is guarded. */
function stored<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}
function store(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not persisted — the preference just lasts for this page load.
  }
}

interface ProcessNavProps {
  processes: ProcessSummary[] | null
  projects: Project[]
  activeId: string | null
  /** Creates a process in that project (null = "No project"). */
  onNewProcess: (projectId: string | null) => void
  onMoveProcess: (processId: string, projectId: string | null) => void
  /** Resolves with the created project so its name opens for editing. */
  onNewProject: () => Promise<Project | undefined>
  onRenameProject: (id: string, name: string) => void
  onDeleteProject: (project: Project) => void
}

/**
 * The sidebar's nav tree: a "New" (process) row, the Projects heading
 * (new project, search, sort), then one collapsible NavProject per
 * project and a last
 * "No project" group, each with a "+" that creates a process in it.
 * A process's ⋮ button or right-click moves it to a project or a new
 * one; right-clicking a project heading renames or deletes it.
 */
export function ProcessNav({
  processes,
  projects,
  activeId,
  onNewProcess,
  onMoveProcess,
  onNewProject,
  onRenameProject,
  onDeleteProject,
}: ProcessNavProps) {
  const [collapsed, setCollapsed] = useState(() => new Set(stored<string[]>('stormm.collapsedProjects', [])))
  const [sort, setSort] = useState<Sort>(() => stored<Sort>('stormm.processSort', 'created'))
  const [query, setQuery] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [context, setContext] = useState<{ process: ProcessSummary; x: number; y: number } | null>(null)
  const [projectContext, setProjectContext] = useState<{ project: Project; x: number; y: number } | null>(null)
  const closeContext = useCallback(() => setContext(null), [])
  const closeProjectContext = useCallback(() => setProjectContext(null), [])

  const toggle = (id: string) => {
    const next = new Set(collapsed)
    if (!next.delete(id)) next.add(id)
    setCollapsed(next)
    store('stormm.collapsedProjects', [...next])
  }

  // Opening a process (or creating one inside a collapsed project) reveals it: expand its project.
  const activeProjectId = processes?.find((p) => p.id === activeId)?.projectId ?? null
  const [revealed, setRevealed] = useState<string | null>(null)
  if (activeProjectId !== revealed) {
    setRevealed(activeProjectId)
    if (activeProjectId && collapsed.has(activeProjectId)) toggle(activeProjectId)
  }
  const changeSort = (s: Sort) => {
    setSort(s)
    store('stormm.processSort', s)
  }

  const needle = query?.trim().toLowerCase() ?? ''
  const searching = needle !== ''
  const matches = (name: string) => name.toLowerCase().includes(needle)
  const sorted = <T extends { name: string }>(items: T[]) =>
    sort === 'name' ? [...items].sort((a, b) => a.name.localeCompare(b.name)) : items

  const all = processes ?? []
  const groups = sorted(projects)
    .map((project) => {
      const own = sorted(all.filter((p) => p.projectId === project.id))
      // A matching project name keeps all of its processes; otherwise only matching processes show.
      const items = !searching || matches(project.name) ? own : own.filter((p) => matches(p.name))
      return { project, items }
    })
    .filter(({ project, items }) => !searching || items.length > 0 || matches(project.name))
  const known = new Set(projects.map((p) => p.id))
  const loose = sorted(all.filter((p) => !p.projectId || !known.has(p.projectId))).filter((p) => !searching || matches(p.name))

  const moveTo = (processId: string, projectId: string | null) => {
    if (projectId && collapsed.has(projectId)) toggle(projectId)
    onMoveProcess(processId, projectId)
  }
  const newProject = async () => {
    const project = await onNewProject()
    if (project) setRenamingId(project.id)
  }
  const moveToNewProject = async (processId: string) => {
    const project = await onNewProject()
    if (!project) return
    moveTo(processId, project.id)
    setRenamingId(project.id)
  }

  const item = (p: ProcessSummary) => (
    <NavItem
      key={p.id}
      href={`#/p/${p.id}`}
      active={p.id === activeId}
      onContextMenu={(e) => {
        e.preventDefault()
        // The keyboard's context-menu key reports 0,0 — anchor to the row instead.
        const row = e.currentTarget.getBoundingClientRect()
        setContext({ process: p, x: e.clientX || row.left + 24, y: e.clientY || row.bottom })
      }}
      actions={
        <IconButton
          size="sm"
          aria-label={`${p.name} options`}
          aria-haspopup="menu"
          aria-expanded={context?.process.id === p.id}
          icon={<MoreIcon />}
          // Keep the pointer-down from reaching the open menu's outside-click handler, so a second click toggles it shut.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            if (context?.process.id === p.id) return setContext(null)
            const button = e.currentTarget.getBoundingClientRect()
            // Right-aligned under the button (menu-width is 184px), so it opens inside the sidebar.
            setContext({ process: p, x: Math.max(8, button.right - 184), y: button.bottom + 4 })
          }}
        />
      }
    >
      <span className="truncate">{p.name}</span>
    </NavItem>
  )

  return (
    <>
      <button
        type="button"
        onClick={() => onNewProcess(null)}
        className="flex h-control-lg w-full shrink-0 items-center gap-step-lg rounded-lg border-0 bg-transparent px-step-md text-left text-body font-medium text-text hover:bg-surface-hover"
      >
        <PlusIcon size={16} />
        New
      </button>

      <div className="mt-nav-section-gap flex h-control-xs shrink-0 items-center justify-between py-0 pr-step-2xs pl-step-md">
        {query === null ? (
          <>
            <span className="text-label font-medium text-text-muted">Projects</span>
            <div className="flex items-center gap-step-3xs">
              <IconButton size="sm" aria-label="New project" icon={<PlusIcon size={16} />} onClick={newProject} />
              <IconButton size="sm" aria-label="Search processes" icon={<SearchIcon />} onClick={() => setQuery('')} />
              <SortMenu sort={sort} onChange={changeSort} />
            </div>
          </>
        ) : (
          <label className="-ml-step-md flex h-control-xs flex-grow items-center gap-step-sm rounded-md bg-surface-raised px-step-sm text-text-muted ring-1 ring-border-input">
            <SearchIcon />
            <span className="sr-only">Search processes</span>
            <input
              autoFocus
              type="search"
              value={query}
              placeholder="Search processes"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setQuery(null)}
              onBlur={() => !query.trim() && setQuery(null)}
              className="min-w-0 flex-grow border-0 bg-transparent text-label text-text outline-none placeholder:text-text-muted [&::-webkit-search-cancel-button]:hidden"
            />
            <button type="button" aria-label="Close search" onMouseDown={(e) => e.preventDefault()} onClick={() => setQuery(null)} className="border-0 bg-transparent p-0 text-text-muted">
              <CloseIcon />
            </button>
          </label>
        )}
      </div>

      <div className="mt-step-2xs flex flex-col gap-step-xl">
        {groups.map(({ project, items }) => (
          <NavProject
            key={project.id}
            label={project.name}
            expanded={searching || !collapsed.has(project.id)}
            onToggle={() => toggle(project.id)}
            onRename={() => setRenamingId(project.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              const row = e.currentTarget.getBoundingClientRect()
              setProjectContext({ project, x: e.clientX || row.left + 24, y: e.clientY || row.bottom })
            }}
            name={
              renamingId === project.id ? (
                <EditableText
                  aria-label="Project name"
                  value={project.name}
                  required
                  autoFocus
                  onCommit={(name) => onRenameProject(project.id, name)}
                  onBlur={() => setRenamingId(null)}
                  className="-mx-1 w-full px-1 text-body font-medium text-text"
                />
              ) : (
                project.name
              )
            }
            actions={<NewInGroup name={project.name} onClick={() => onNewProcess(project.id)} />}
          >
            {items.length ? items.map(item) : <Empty>No processes</Empty>}
          </NavProject>
        ))}
        {loose.length > 0 && (
          <NavProject
            label="No project"
            name="No project"
            expanded={searching || !collapsed.has(NO_PROJECT)}
            onToggle={() => toggle(NO_PROJECT)}
            actions={<NewInGroup name="No project" onClick={() => onNewProcess(null)} />}
          >
            {loose.map(item)}
          </NavProject>
        )}
      </div>

      {processes && searching && !groups.length && !loose.length && <Empty>No matches</Empty>}

      {projectContext && (
        <FloatingMenu {...projectContext} label={`${projectContext.project.name} options`} rows={2} onClose={closeProjectContext}>
          {(pick) => (
            <>
              <MenuItem onClick={pick(() => setRenamingId(projectContext.project.id))}>Rename</MenuItem>
              <MenuItem danger onClick={pick(() => onDeleteProject(projectContext.project))}>
                Delete project
              </MenuItem>
            </>
          )}
        </FloatingMenu>
      )}

      {context && (
        <ProcessContextMenu
          {...context}
          projects={sorted(projects)}
          onMove={(projectId) => moveTo(context.process.id, projectId)}
          onNewProject={() => moveToNewProject(context.process.id)}
          onClose={closeContext}
        />
      )}
    </>
  )
}

/** Collapse key for the "No project" group (project ids are cuids, so it can't collide). */
const NO_PROJECT = 'none'

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-control-md shrink-0 items-center pl-step-2xl text-label text-text-muted">{children}</div>
}

function NewInGroup({ name, onClick }: { name: string; onClick: () => void }) {
  return <IconButton size="sm" aria-label={`New process in ${name}`} icon={<PlusIcon size={16} />} onClick={onClick} />
}

interface FloatingMenuProps {
  label: string
  x: number
  y: number
  /** Item rows it will hold (30px each), to keep it on screen. */
  rows: number
  onClose: () => void
  /** `pick(action)` makes a click handler that closes the menu, then runs the action. */
  children: (pick: (action: () => void) => () => void) => ReactNode
}

/** A Menu pinned at a point (cursor or button); closes on a click outside, Escape, a scroll or a resize. */
function FloatingMenu({ label, x, y, rows, onClose, children }: FloatingMenuProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointer = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && onClose()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', onClose)
    document.addEventListener('scroll', onClose, true)
    ref.current?.querySelector<HTMLElement>('[role^=menuitem]')?.focus()
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', onClose)
      document.removeEventListener('scroll', onClose, true)
    }
  }, [onClose])

  const pick = (action: () => void) => () => {
    onClose()
    action()
  }
  // Rows are 30px, plus room for a label, a divider and the padding.
  const height = rows * 30 + 44
  const style = { left: Math.min(x, window.innerWidth - 192), top: Math.max(8, Math.min(y, window.innerHeight - height - 8)) }

  return (
    <div ref={ref}>
      <Menu aria-label={label} className="fixed" style={style}>
        {children(pick)}
      </Menu>
    </div>
  )
}

interface ProcessContextMenuProps {
  process: ProcessSummary
  x: number
  y: number
  projects: Project[]
  onMove: (projectId: string | null) => void
  onNewProject: () => void
  onClose: () => void
}

/** A sidebar process's menu (⋮ or right-click): move it to a project, "No project", or a new project. */
function ProcessContextMenu({ process, x, y, projects, onMove, onNewProject, onClose }: ProcessContextMenuProps) {
  return (
    <FloatingMenu label={`${process.name} options`} x={x} y={y} rows={projects.length + 2} onClose={onClose}>
      {(pick) => (
        <>
          <MenuLabel>Move to</MenuLabel>
          {projects.map((p) => (
            <MenuItem key={p.id} checked={p.id === process.projectId} onClick={pick(() => p.id !== process.projectId && onMove(p.id))}>
              {p.name}
            </MenuItem>
          ))}
          <MenuItem checked={!process.projectId} onClick={pick(() => process.projectId && onMove(null))}>
            No project
          </MenuItem>
          <div role="separator" className="mx-step-sm my-step-2xs h-px shrink-0 bg-border" />
          <MenuItem onClick={pick(onNewProject)}>
            <span className="flex items-center gap-step-sm">
              <PlusIcon size={14} />
              New project
            </span>
          </MenuItem>
        </>
      )}
    </FloatingMenu>
  )
}

function SortMenu({ sort, onChange }: { sort: Sort; onChange: (s: Sort) => void }) {
  const { ref, open, toggle, close } = useMenu()
  const pick = (s: Sort) => {
    close()
    onChange(s)
  }
  return (
    <div ref={ref} className="relative">
      <IconButton size="sm" aria-label="Sort processes" aria-haspopup="menu" aria-expanded={open} icon={<SlidersIcon />} onClick={toggle} />
      {open && (
        <Menu aria-label="Sort processes" className="top-full right-0 mt-step-2xs">
          <MenuLabel>Sort by</MenuLabel>
          <MenuItem checked={sort === 'created'} onClick={() => pick('created')}>
            Date created
          </MenuItem>
          <MenuItem checked={sort === 'name'} onClick={() => pick('name')}>
            Name
          </MenuItem>
        </Menu>
      )}
    </div>
  )
}

const icon = { fill: 'none', stroke: 'currentColor', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function PlusIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth="1.8" {...icon}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...icon} className="shrink-0">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function SlidersIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="1.8" {...icon}>
      <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
      <circle cx="16" cy="7" r="2" />
      <circle cx="10" cy="17" r="2" />
    </svg>
  )
}

function MoreIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" strokeWidth="2.4" {...icon}>
      <path d="M12 5h.01M12 12h.01M12 19h.01" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" strokeWidth="2" {...icon}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}
