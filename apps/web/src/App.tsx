import {
  addBlock as addBlockTo,
  blockStatus,
  connect as connectBlocks,
  diffBoards as computeBoardDiff,
  disconnect,
  findBlock,
  layoutBoard,
  parseBoard,
  removeBlock,
  renameBoard,
  retitleNewBlock,
  toYaml,
  updateBlock,
  validate,
  type BlockPatch,
  type Board,
} from '@stormm/process-model'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, type ProcessDiff, type ProcessSummary, type Project } from './api'
import { Canvas, type CanvasBlock, type CanvasConnection, type Selection, type Viewport } from './canvas/Canvas'
import { ChangeDetail } from './canvas/ChangeDetail'
import { ChangesList } from './canvas/ChangesList'
import { LAYOUT } from './canvas/geometry'
import { Inspector } from './canvas/Inspector'
import { YamlPanel } from './canvas/YamlPanel'
import { Button, Composer, EditableText, Header, IconButton, Sidebar, blockKindLabel, type BlockKind } from './components'
import { ProcessNav } from './ProcessNav'
import { useDraggedPositions } from './useDraggedPositions'
import { useProcess, type SaveState } from './useProcess'

const INITIAL_VIEWPORT: Viewport = { x: 64, y: 88, zoom: 1 }

const SIDEBAR_KEY = 'stormm.sidebarHidden'
const readSidebarHidden = () => {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === 'true'
  } catch {
    return false
  }
}

const processIdFromHash = () => window.location.hash.match(/^#\/p\/([^/]+)/)?.[1] ?? null

const SAVE_LABEL: Record<SaveState, string> = {
  saved: 'Saved',
  saving: 'Saving…',
  failed: 'Not saved',
  conflict: 'Changed elsewhere',
}

function App() {
  const [processes, setProcesses] = useState<ProcessSummary[] | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [sidebarHidden, setSidebarHidden] = useState(readSidebarHidden)
  const [processId, setProcessId] = useState(processIdFromHash)
  const [selection, setSelection] = useState<Selection>(null)
  const [yamlOpen, setYamlOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [diff, setDiff] = useState<ProcessDiff | null>(null)
  const [changeSelection, setChangeSelection] = useState<string | null>(null)
  const [busy, setBusy] = useState<'requesting' | 'accepting' | null>(null)
  const [viewport, setViewport] = useState(INITIAL_VIEWPORT)
  const [reviewViewport, setReviewViewport] = useState(INITIAL_VIEWPORT)
  const [notice, setNotice] = useState<{ text: string; error?: boolean } | null>(null)
  const [renaming, setRenaming] = useState(false)
  /**
   * Blocks added in this session. Their ids still follow their titles; once the page is
   * reloaded they are part of the agreed file and their ids are frozen.
   */
  const fresh = useRef({ processId, blocks: new Set<string>() })
  const freshIds = () => {
    if (fresh.current.processId !== processId) fresh.current = { processId, blocks: new Set() }
    return fresh.current.blocks
  }

  const fail = useCallback((e: unknown) => setNotice({ text: e instanceof Error ? e.message : String(e), error: true }), [])
  const { open, loadError, saveState, edit, reload, setProjectId } = useProcess(processId, fail)
  const board: Board | null = open?.id === processId ? open.board : null

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

  // Switching process starts from a clean view.
  const [viewFor, setViewFor] = useState(processId)
  if (viewFor !== processId) {
    setViewFor(processId)
    setSelection(null)
    setViewport(INITIAL_VIEWPORT)
    setReviewOpen(false)
    setDiff(null)
    setChangeSelection(null)
  }

  useEffect(() => {
    if (!notice) return
    const t = setTimeout(() => setNotice(null), notice.error ? 5000 : 2000)
    return () => clearTimeout(t)
  }, [notice])

  // ── Derived view ─────────────────────────────────────────────────────────

  const layout = useMemo(() => (board ? layoutBoard(board, LAYOUT) : null), [board])
  const ids = useMemo(() => (board ? board.blocks.map((b) => b.id) : null), [board])
  const dragged = useDraggedPositions(processId, ids)
  const issues = useMemo(() => (board ? validate(board) : []), [board])
  const yaml = useMemo(() => (board ? toYaml(board) : ''), [board])

  // Parses the diff's before/after YAML into boards for the review view; falls back to
  // the raw text patch (rendered by ChangesList) if either side doesn't parse.
  const diffPreview = useMemo(() => {
    if (!diff?.beforeYaml || !diff.afterYaml) return null
    const before = parseBoard(diff.beforeYaml).board
    const after = parseBoard(diff.afterYaml).board
    return before && after ? { before, after } : null
  }, [diff])

  const boardDiff = useMemo(() => (diffPreview ? computeBoardDiff(diffPreview.before, diffPreview.after) : null), [diffPreview])

  // Auto-select the first changed block once the diff loads, so ChangeDetail isn't empty.
  useEffect(() => {
    if (!boardDiff || changeSelection) return
    const first = boardDiff.blocks.removed[0] ?? boardDiff.blocks.changed[0]?.after ?? boardDiff.blocks.added[0]
    if (first) setChangeSelection(first.id)
  }, [boardDiff, changeSelection])

  const selectedChange = useMemo(() => {
    if (!changeSelection || !boardDiff) return null
    const added = boardDiff.blocks.added.find((b) => b.id === changeSelection)
    if (added) return { status: 'added' as const, after: added }
    const removed = boardDiff.blocks.removed.find((b) => b.id === changeSelection)
    if (removed) return { status: 'removed' as const, before: removed }
    const changed = boardDiff.blocks.changed.find((c) => c.after.id === changeSelection)
    if (changed) return { status: 'changed' as const, before: changed.before, after: changed.after, changes: changed.changes }
    return null
  }, [changeSelection, boardDiff])

  // The review canvas shows the current (after) state plus any removed blocks, so a
  // deletion is visible rather than just vanishing — one board, one layout, colored by status.
  const reviewLayout = useMemo(() => {
    if (!diffPreview || !boardDiff) return null
    const merged: Board = {
      ...diffPreview.after,
      blocks: [...diffPreview.after.blocks, ...boardDiff.blocks.removed],
      connections: [...diffPreview.after.connections, ...boardDiff.connections.removed],
    }
    return layoutBoard(merged, LAYOUT)
  }, [diffPreview, boardDiff])

  const reviewCanvasBlocks: CanvasBlock[] = useMemo(() => {
    if (!diffPreview || !boardDiff || !reviewLayout) return []
    const statusById = blockStatus(boardDiff)
    return [...diffPreview.after.blocks, ...boardDiff.blocks.removed].map((b) => ({
      id: b.id,
      kind: b.kind,
      title: b.title,
      actor: b.actor,
      hotspots: b.hotspots.length,
      diffStatus: statusById.get(b.id),
      ...(reviewLayout.positions.get(b.id) ?? { x: 0, y: 0 }),
    }))
  }, [diffPreview, boardDiff, reviewLayout])

  const reviewCanvasConnections: CanvasConnection[] = useMemo(() => {
    if (!diffPreview || !boardDiff) return []
    const addedKeys = new Set(boardDiff.connections.added.map((c) => `${c.from}->${c.to}`))
    const removedKeys = new Set(boardDiff.connections.removed.map((c) => `${c.from}->${c.to}`))
    return [...diffPreview.after.connections, ...boardDiff.connections.removed].map((c) => {
      const key = `${c.from}->${c.to}`
      return { id: key, from: c.from, to: c.to, diffStatus: addedKeys.has(key) ? 'added' : removedKeys.has(key) ? 'removed' : undefined }
    })
  }, [diffPreview, boardDiff])

  const canvasBlocks: CanvasBlock[] = useMemo(() => {
    if (!board || !layout) return []
    return board.blocks.map((b) => ({
      id: b.id,
      kind: b.kind,
      title: b.title,
      actor: b.actor,
      hotspots: b.hotspots.length,
      ...(dragged.positions[b.id] ?? layout.positions.get(b.id) ?? { x: 0, y: 0 }),
    }))
  }, [board, layout, dragged.positions])

  const canvasConnections: CanvasConnection[] = useMemo(
    () => (board ? board.connections.map((c) => ({ id: `${c.from}->${c.to}`, from: c.from, to: c.to })) : []),
    [board],
  )

  const selectedBlock = board && selection?.type === 'block' ? findBlock(board, selection.id) : undefined

  // ── Edits ────────────────────────────────────────────────────────────────

  const patchBlock = (id: string, patch: BlockPatch) => {
    let target = id
    if (patch.title !== undefined && freshIds().has(id)) {
      const title = patch.title
      edit((b) => {
        const r = retitleNewBlock(b, id, title)
        target = r.blockId
        return r.board
      })
      if (target !== id) {
        freshIds().delete(id)
        freshIds().add(target)
        dragged.rename(id, target)
        setSelection((s) => (s?.type === 'block' && s.id === id ? { type: 'block', id: target } : s))
      }
      const { title: _, ...rest } = patch
      patch = rest
    }
    if (Object.keys(patch).length) edit((b) => updateBlock(b, target, patch))
  }

  const deleteBlock = (id: string) => {
    setSelection(null)
    edit((b) => removeBlock(b, id))
  }

  const deleteConnection = (key: string) => {
    setSelection(null)
    const [from, to] = key.split('->')
    edit((b) => disconnect(b, from, to))
  }

  const connect = (from: string, to: string) => edit((b) => connectBlocks(b, from, to))

  /** New blocks continue the process: connected from the selected block. */
  const addBlock = (kind: BlockKind) => {
    if (!board) return
    const from = selectedBlock?.id
    let created = ''
    edit((b) => {
      const r = addBlockTo(b, { kind, title: `New ${blockKindLabel[kind].toLowerCase()}` })
      created = r.blockId
      return from ? connectBlocks(r.board, from, r.blockId) : r.board
    })
    if (!created) return
    freshIds().add(created)
    setSelection({ type: 'block', id: created })
  }

  // ── Processes and projects ───────────────────────────────────────────────

  const createProcess = async (projectId: string | null = null) => {
    try {
      const created = await api.createProcess('Untitled process', projectId)
      setProcesses((ps) => [...(ps ?? []), { id: created.board.id, name: created.board.name, projectId: created.projectId }])
      setRenaming(true)
      window.location.hash = `#/p/${created.board.id}`
    } catch (e) {
      fail(e)
    }
  }

  const renameProcess = (name: string) => {
    if (!board) return
    setRenaming(false)
    setProcesses((ps) => ps?.map((p) => (p.id === board.id ? { ...p, name } : p)) ?? ps)
    edit((b) => renameBoard(b, name))
  }

  const moveProcess = (id: string, projectId: string | null) => {
    setProcesses((ps) => ps?.map((p) => (p.id === id ? { ...p, projectId } : p)) ?? ps)
    if (id === processId) setProjectId(projectId)
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
      if (open?.projectId === project.id) setProjectId(null)
    } catch (e) {
      fail(e)
    }
  }

  const deleteProcess = async () => {
    if (!board || !window.confirm(`Delete “${board.name}” and its YAML file?`)) return
    try {
      await api.deleteProcess(board.id)
      const rest = (processes ?? []).filter((p) => p.id !== board.id)
      setProcesses(rest)
      window.location.hash = rest.length ? `#/p/${rest[0].id}` : ''
    } catch (e) {
      fail(e)
    }
  }

  const downloadYaml = () => {
    if (!board) return
    const url = URL.createObjectURL(new Blob([yaml], { type: 'application/yaml' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `${board.id}.yaml` })
    a.click()
    URL.revokeObjectURL(url)
  }

  const copyYaml = () => navigator.clipboard.writeText(yaml).then(() => setNotice({ text: 'YAML copied' }), fail)

  const share = () =>
    navigator.clipboard.writeText(window.location.href).then(() => setNotice({ text: 'Link copied' }), fail)

  const openReview = () => {
    if (!board) return
    setYamlOpen(false)
    setReviewOpen(true)
    setDiff(null)
    setChangeSelection(null)
    setReviewViewport(INITIAL_VIEWPORT)
    api.diffProcess(board.id).then(setDiff, fail)
  }

  const requestChange = async () => {
    if (!board) return
    setBusy('requesting')
    try {
      await api.requestChange(board.id)
      setDiff(await api.diffProcess(board.id))
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  const acceptChanges = async () => {
    if (!board) return
    setBusy('accepting')
    try {
      await api.acceptProcess(board.id)
      setNotice({ text: 'Changes accepted' })
      setReviewOpen(false)
      setChangeSelection(null)
      reload()
    } catch (e) {
      fail(e)
    } finally {
      setBusy(null)
    }
  }

  // Delete/Backspace removes the selection; Escape clears it. Ignored while typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return
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

  const errorCount = issues.filter((i) => i.level === 'error').length
  const hasDrags = Object.keys(dragged.positions).length > 0

  return (
    <div className="flex h-screen overflow-hidden">
      {reviewOpen ? (
        <ChangesList
          diff={diff}
          boardDiff={boardDiff}
          busy={busy}
          selectedId={changeSelection}
          onSelect={setChangeSelection}
          onRequest={requestChange}
          onAccept={acceptChanges}
          onClose={() => setReviewOpen(false)}
        />
      ) : (
        !sidebarHidden && (
          <Sidebar userInitial="F" userName="Fang" onCollapse={() => toggleSidebar(true)}>
            <ProcessNav
              // The open process's name is live (edited in the header) before the list is refetched.
              processes={processes?.map((p) => (p.id === board?.id ? { ...p, name: board.name } : p)) ?? null}
              projects={projects}
              activeId={processId}
              onNewProcess={createProcess}
              onMoveProcess={moveProcess}
              onNewProject={createProject}
              onRenameProject={renameProject}
              onDeleteProject={deleteProject}
            />
          </Sidebar>
        )
      )}

      <main className="flex min-w-0 flex-grow flex-col">
        <Header
          leading={
            !reviewOpen &&
            sidebarHidden && (
              <IconButton size="md" aria-label="Show sidebar" onClick={() => toggleSidebar(false)} icon={<SidebarIcon />} />
            )
          }
          title={
            board ? (
              <EditableText
                key={board.id}
                aria-label="Process name"
                value={board.name}
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
            board && (
              <>
                {notice ? (
                  <span role="status" className={`mr-step-sm text-meta ${notice.error ? 'text-hotspot-text' : 'text-text-muted'}`}>
                    {notice.text}
                  </span>
                ) : (
                  <span role="status" className={`mr-step-sm text-meta ${saveState === 'saved' || saveState === 'saving' ? 'text-text-muted' : 'text-hotspot-text'}`}>
                    {SAVE_LABEL[saveState]}
                  </span>
                )}
                {saveState === 'conflict' && (
                  <Button variant="secondary" onClick={reload}>
                    Reload
                  </Button>
                )}
                <Button variant="secondary" onClick={deleteProcess}>
                  Delete
                </Button>
                <Button variant="secondary" onClick={share}>
                  Share
                </Button>
                <Button variant="secondary" aria-pressed={reviewOpen} onClick={() => (reviewOpen ? setReviewOpen(false) : openReview())}>
                  Review changes
                </Button>
                <Button
                  variant="primary"
                  aria-pressed={yamlOpen}
                  onClick={() => {
                    setReviewOpen(false)
                    setYamlOpen((o) => !o)
                  }}
                >
                  YAML
                  {errorCount > 0 && <span className="rounded-full bg-hotspot-surface px-1.5 text-chip text-hotspot-text">{errorCount}</span>}
                </Button>
              </>
            )
          }
        />

        <div className="flex min-h-0 flex-grow">
          {reviewOpen && diffPreview ? (
            <Canvas
              blocks={reviewCanvasBlocks}
              connections={reviewCanvasConnections}
              selection={changeSelection ? { type: 'block', id: changeSelection } : null}
              viewport={reviewViewport}
              onViewportChange={setReviewViewport}
              onSelect={(s) => setChangeSelection(s?.type === 'block' ? s.id : null)}
            />
          ) : board && layout ? (
            <Canvas
              blocks={canvasBlocks}
              connections={canvasConnections}
              selection={selection}
              viewport={viewport}
              onViewportChange={setViewport}
              onSelect={setSelection}
              onMoveBlock={(id, x, y) => dragged.move(id, { x, y })}
              onConnect={connect}
            >
              {hasDrags && (
                <div className="absolute top-step-2xl right-step-2xl">
                  <Button variant="secondary" onClick={dragged.reset}>
                    Reset layout
                  </Button>
                </div>
              )}
              {/* The strip spans the canvas width; only the composer itself takes clicks. */}
              <div className="pointer-events-none absolute right-0 bottom-step-3xl left-0 flex justify-center px-step-3xl">
                <div className="pointer-events-auto w-full max-w-2xl">
                  <Composer
                    placeholder="Add a block with +, drag the right port to connect"
                    onAddBlock={addBlock}
                  />
                </div>
              </div>
            </Canvas>
          ) : (
            <section aria-label="Process canvas" className="flex flex-grow flex-col items-center justify-center gap-step-lg bg-surface text-body text-text-muted">
              {loadError?.body?.issues ? (
                <div className="max-w-xl">
                  <div className="mb-step-md text-hotspot-text">{loadError.message}</div>
                  <ul className="m-0 flex flex-col gap-step-xs pl-step-xl text-meta">
                    {loadError.body.issues.map((i, n) => (
                      <li key={n}>
                        {i.path && <code className="font-mono">{i.path}: </code>}
                        {i.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : loadError ? (
                <span className="text-hotspot-text">{loadError.message}</span>
              ) : processes === null || processes.length > 0 ? (
                'Loading…'
              ) : (
                'No processes yet.'
              )}
              {processes?.length === 0 && (
                <Button variant="primary" onClick={() => createProcess()}>
                  New process
                </Button>
              )}
            </section>
          )}

          {reviewOpen ? (
            selectedChange && (
              <ChangeDetail
                status={selectedChange.status}
                before={'before' in selectedChange ? selectedChange.before : undefined}
                after={'after' in selectedChange ? selectedChange.after : undefined}
                changes={'changes' in selectedChange ? selectedChange.changes : undefined}
                onClose={() => setChangeSelection(null)}
              />
            )
          ) : board && yamlOpen ? (
            <YamlPanel
              path={`stormm/processes/${board.id}.yaml`}
              yaml={yaml}
              issues={issues}
              onCopy={copyYaml}
              onDownload={downloadYaml}
              onClose={() => setYamlOpen(false)}
            />
          ) : (
            board &&
            selectedBlock && (
              <Inspector
                key={selectedBlock.id}
                block={selectedBlock}
                board={board}
                onChange={(patch) => patchBlock(selectedBlock.id, patch)}
                onDelete={() => deleteBlock(selectedBlock.id)}
                onSelectBlock={(id) => setSelection({ type: 'block', id })}
                onClose={() => setSelection(null)}
              />
            )
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
