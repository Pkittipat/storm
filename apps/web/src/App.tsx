import { useCallback, useEffect, useState } from 'react'
import { api, type Block, type BlockPatch, type Process, type ProcessSummary, type Project } from './api'
import { Canvas, type Selection, type Viewport } from './canvas/Canvas'
import { BLOCK_HEIGHT, BLOCK_WIDTH } from './canvas/geometry'
import { Inspector } from './canvas/Inspector'
import { generateProcess, goIdent } from './codegen'
import {
  Button,
  Composer,
  EditableText,
  Header,
  IconButton,
  Sidebar,
  blockKindLabel,
  type BlockKind,
} from './components'
import { ProcessNav } from './ProcessNav'

const INITIAL_VIEWPORT: Viewport = { x: 40, y: 80, zoom: 1 }
const STEP_X = 180
const STEP_Y = 160

const SIDEBAR_KEY = 'stormm.sidebarHidden'
const readSidebarHidden = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  } catch {
    return false
  }
}

const processIdFromHash = () => window.location.hash.match(/^#\/p\/([^/]+)/)?.[1] ?? null

function App() {
  const [processes, setProcesses] = useState<ProcessSummary[] | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sidebarHidden, setSidebarHidden] = useState(readSidebarHidden)
  const [processId, setProcessId] = useState(processIdFromHash)
  const [process, setProcess] = useState<Process | null>(null)
  const [selection, setSelection] = useState<Selection>(null)
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [renaming, setRenaming] = useState(false)

  const fail = useCallback((e: unknown) => setNotice({ text: e instanceof Error ? e.message : String(e), error: true }), [])

  useEffect(() => {
    const onHash = () => setProcessId(processIdFromHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  useEffect(() => {
    api.listProcesses().then(setProcesses, fail)
    api.listProjects().then(setProjects, fail)
  }, [fail])

  const toggleSidebar = (hidden: boolean) => {
    setSidebarHidden(hidden)
    try {
      localStorage.setItem(SIDEBAR_KEY, String(hidden))
    } catch {
      // Not persisted — stays for this page load.
    }
  }

  // With no process in the URL, open the first one.
  useEffect(() => {
    if (!processId && processes?.length) window.location.hash = `#/p/${processes[0].id}`
  }, [processId, processes])

  const reload = useCallback(() => {
    if (!processId) return
    api.getProcess(processId).then(
      (p) => setProcess((cur) => (cur === null || cur.id === p.id ? p : cur)),
      fail,
    )
  }, [processId, fail])

  // Switching process starts from a clean view (and never shows the previous process while loading).
  const [viewFor, setViewFor] = useState(processId)
  if (viewFor !== processId) {
    setViewFor(processId)
    setProcess(null)
    setSelection(null)
    setViewport(INITIAL_VIEWPORT)
  }

  useEffect(() => {
    if (!processId) return
    let stale = false
    api.getProcess(processId).then(
      (p) => !stale && setProcess(p),
      (e) => {
        if (stale) return
        fail(e)
        // A dead link falls back to the first process.
        window.location.hash = ''
      },
    )
    return () => {
      stale = true
    }
  }, [processId, fail])

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.error ? 5000 : 2000)
    return () => clearTimeout(t)
  }, [notice])

  /** Apply a change locally now, persist it, and resync from the server if persisting fails. */
  const optimistic = useCallback(
    (update: (p: Process) => Process, persist: () => Promise<unknown>) => {
      setProcess((p) => (p ? update(p) : p))
      persist().catch((e) => {
        fail(e)
        reload()
      })
    },
    [fail, reload],
  )

  const patchBlock = (id: string, patch: BlockPatch) =>
    optimistic(
      (p) => ({
        ...p,
        blocks: p.blocks.map((b) =>
          b.id === id ? { ...b, ...patch, actor: patch.actor === undefined ? b.actor : patch.actor || null } : b,
        ),
      }),
      () => api.updateBlock(id, patch),
    )

  const deleteBlock = (id: string) => {
    setSelection(null)
    optimistic(
      (p) => ({
        ...p,
        blocks: p.blocks.filter((b) => b.id !== id),
        connections: p.connections.filter((c) => c.sourceId !== id && c.targetId !== id),
      }),
      () => api.deleteBlock(id),
    )
  }

  const deleteConnection = (id: string) => {
    setSelection(null)
    optimistic((p) => ({ ...p, connections: p.connections.filter((c) => c.id !== id) }), () => api.deleteConnection(id))
  }

  const connect = async (sourceId: string, targetId: string) => {
    if (!process) return
    if (process.connections.some((c) => c.sourceId === sourceId && c.targetId === targetId)) return
    try {
      const connection = await api.createConnection(process.id, sourceId, targetId)
      setProcess((p) => (p ? { ...p, connections: [...p.connections, connection] } : p))
    } catch (e) {
      fail(e)
    }
  }

  /**
   * New blocks continue the flow: placed one step right of the selected
   * block (and connected from it), else right of the rightmost block,
   * nudged down until the spot is free.
   */
  const addBlock = async (kind: BlockKind) => {
    if (!process) return
    const selected = selection?.type === 'block' ? process.blocks.find((b) => b.id === selection.id) : undefined
    const anchor = selected ?? [...process.blocks].sort((a, b) => b.x - a.x)[0]
    let x = anchor ? anchor.x + STEP_X : 80
    let y = anchor ? anchor.y : 200
    const occupied = (bx: number, by: number) =>
      process.blocks.some((b) => Math.abs(b.x - bx) < BLOCK_WIDTH && Math.abs(b.y - by) < BLOCK_HEIGHT)
    while (occupied(x, y)) y += STEP_Y
    try {
      const block = await api.createBlock(process.id, { kind, title: `New ${blockKindLabel[kind].toLowerCase()}`, x, y })
      setProcess((p) => (p ? { ...p, blocks: [...p.blocks, block] } : p))
      setSelection({ type: 'block', id: block.id })
      if (selected) await connect(selected.id, block.id)
    } catch (e) {
      fail(e)
    }
  }

  const createProcess = async (projectId: string | null = null) => {
    try {
      const created = await api.createProcess('Untitled process', projectId)
      setProcesses((ps) => [...(ps ?? []), created])
      setRenaming(true)
      window.location.hash = `#/p/${created.id}`
    } catch (e) {
      fail(e)
    }
  }

  const renameProcess = (name: string) => {
    if (!process) return
    setRenaming(false)
    setProcesses((ps) => ps?.map((p) => (p.id === process.id ? { ...p, name } : p)) ?? ps)
    optimistic((p) => ({ ...p, name }), () => api.renameProcess(process.id, name))
  }

  const moveProcess = (id: string, projectId: string | null) => {
    setProcesses((ps) => ps?.map((p) => (p.id === id ? { ...p, projectId } : p)) ?? ps)
    setProcess((p) => (p?.id === id ? { ...p, projectId } : p))
    api.moveProcess(id, projectId).catch((e) => {
      fail(e)
      api.listProcesses().then(setProcesses, fail)
    })
  }

  const createProject = async () => {
    try {
      const project = await api.createProject('Untitled project')
      setProjects((ps) => [...ps, project])
      return project
    } catch (e) {
      fail(e)
    }
  }

  const renameProject = (id: string, name: string) => {
    setProjects((ps) => ps.map((p) => (p.id === id ? { ...p, name } : p)))
    api.renameProject(id, name).catch((e) => {
      fail(e)
      api.listProjects().then(setProjects, fail)
    })
  }

  /** Its processes are kept and move to "No project". */
  const deleteProject = async (project: Project) => {
    if (!window.confirm(`Delete the “${project.name}” project? Its processes move to No project.`)) return
    try {
      await api.deleteProject(project.id)
      setProjects((ps) => ps.filter((p) => p.id !== project.id))
      setProcesses((ps) => ps?.map((p) => (p.projectId === project.id ? { ...p, projectId: null } : p)) ?? ps)
      setProcess((p) => (p?.projectId === project.id ? { ...p, projectId: null } : p))
    } catch (e) {
      fail(e)
    }
  }

  const deleteProcess = async () => {
    if (!process || !window.confirm(`Delete “${process.name}” and all its blocks?`)) return
    try {
      await api.deleteProcess(process.id)
      const rest = (processes ?? []).filter((p) => p.id !== process.id)
      setProcesses(rest)
      window.location.hash = rest.length ? `#/p/${rest[0].id}` : ''
    } catch (e) {
      fail(e)
    }
  }

  const downloadCode = () => {
    if (!process) return
    const url = URL.createObjectURL(new Blob([generateProcess(process)], { type: 'text/x-go' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${goIdent(process.name).toLowerCase()}.go` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const share = () =>
    navigator.clipboard.writeText(window.location.href).then(() => setNotice({ text: 'Link copied' }), fail)

  // Delete/Backspace removes the selection; Escape clears it. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, [contenteditable="true"]')) return
      if (e.key === 'Escape') setSelection(null)
      if ((e.key === 'Delete' || e.key === 'Backspace') && selection) {
        e.preventDefault()
        if (selection.type === 'block') deleteBlock(selection.id)
        else deleteConnection(selection.id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const selectedBlock: Block | undefined =
    selection?.type === 'block' ? process?.blocks.find((b) => b.id === selection.id) : undefined

  return (
    <div className="flex h-screen overflow-hidden">
      {!sidebarHidden && (
        <Sidebar userInitial="F" userName="Fang" onCollapse={() => toggleSidebar(true)}>
          <ProcessNav
            // The open process's name is live (edited in the header) before the list is refetched.
            processes={processes?.map((p) => (p.id === process?.id ? { ...p, name: process.name } : p)) ?? null}
            projects={projects}
            activeId={processId}
            onNewProcess={createProcess}
            onMoveProcess={moveProcess}
            onNewProject={createProject}
            onRenameProject={renameProject}
            onDeleteProject={deleteProject}
          />
        </Sidebar>
      )}

      <main className="flex min-w-0 flex-grow flex-col">
        <Header
          leading={
            sidebarHidden && (
              <IconButton size="md" aria-label="Show sidebar" onClick={() => toggleSidebar(false)} icon={<SidebarIcon />} />
            )
          }
          title={
            process ? (
              <EditableText
                key={process.id}
                aria-label="Process name"
                value={process.name}
                required
                autoFocus={renaming}
                onCommit={renameProcess}
                onBlur={() => setRenaming(false)}
                className="-mx-1 w-96 max-w-full px-1"
              />
            ) : (
              'Stormm'
            )
          }
          actions={
            process && (
              <>
                {notice && (
                  <span role="status" className={`mr-step-sm text-meta ${notice.error ? 'text-hotspot-text' : 'text-text-muted'}`}>
                    {notice.text}
                  </span>
                )}
                <Button variant="secondary" onClick={deleteProcess}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={share}>
                  Share
                </Button>
                <Button variant="primary" onClick={downloadCode} disabled={!process.blocks.length}>
                  Generate code
                </Button>
              </>
            )
          }
        />

        <div className="flex min-h-0 flex-grow">
          {process ? (
            <Canvas
              blocks={process.blocks}
              connections={process.connections}
              selection={selection}
              viewport={viewport}
              onViewportChange={setViewport}
              onSelect={setSelection}
              onMoveBlock={(id, x, y) => patchBlock(id, { x, y })}
              onConnect={connect}
            >
              {process.blocks.length === 0 && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-body text-text-muted">
                  Add the first block with + below
                </div>
              )}
              <div className="absolute right-0 bottom-step-3xl left-0 flex justify-center px-step-3xl">
                <div className="w-full max-w-2xl">
                  <Composer
                    placeholder="Add a block with +, drag the right port to connect"
                    onAddBlock={addBlock}
                  />
                </div>
              </div>
            </Canvas>
          ) : (
            <section aria-label="Process canvas" className="flex flex-grow flex-col items-center justify-center gap-step-lg bg-surface text-body text-text-muted">
              {notice?.error ? <span className="text-hotspot-text">{notice.text}</span> : null}
              {processes === null || processes.length > 0 ? 'Loading…' : 'No processes yet.'}
              {processes?.length === 0 && (
                <Button variant="primary" onClick={() => createProcess()}>
                  New process
                </Button>
              )}
            </section>
          )}

          {process && selectedBlock && (
            <Inspector
              key={selectedBlock.id}
              block={selectedBlock}
              process={process}
              onChange={(patch) => patchBlock(selectedBlock.id, patch)}
              onDelete={() => deleteBlock(selectedBlock.id)}
              onSelectBlock={(id) => setSelection({ type: 'block', id })}
              onClose={() => setSelection(null)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function SidebarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16" />
    </svg>
  )
}

export default App
