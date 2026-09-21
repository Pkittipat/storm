import { toYaml, type Board, type Issue } from '@stormm/process-model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api } from './api'

export type SaveState = 'saved' | 'saving' | 'failed' | 'conflict'

export interface OpenProcess {
  id: string
  projectId: string | null
  board: Board
  issues: Issue[]
}

const SAVE_DELAY_MS = 300

/**
 * Loads one process file and keeps it saved. Edits apply locally at once and are written as
 * the whole YAML shortly after, one save at a time, each naming the version it builds on.
 * If someone else changed the file meanwhile the save is refused and the state is `conflict`
 * until `reload()` — nothing is silently overwritten.
 */
export function useProcess(processId: string | null, onError: (e: unknown) => void) {
  const [open, setOpen] = useState<OpenProcess | null>(null)
  const [loadError, setLoadError] = useState<ApiError | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')

  // The save loop works on refs so it always sends the latest board for the process it was started for.
  const latest = useRef<{ id: string; board: Board } | null>(null)
  const version = useRef<string>('')
  const saving = useRef(false)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const errorRef = useRef(onError)
  useEffect(() => {
    errorRef.current = onError
  })

  const flush = useCallback(async () => {
    clearTimeout(timer.current)
    if (saving.current) return
    saving.current = true
    try {
      // Edits made while a save is in flight go out right after it, in order.
      while (dirty.current && latest.current) {
        const { id, board } = latest.current
        dirty.current = false
        setSaveState('saving')
        try {
          const saved = await api.saveProcess(id, toYaml(board), version.current)
          if (latest.current?.id !== id) return
          version.current = saved.version
          setOpen((o) => (o?.id === id ? { ...o, issues: saved.issues } : o))
          if (!dirty.current) setSaveState('saved')
        } catch (e) {
          if (latest.current?.id !== id) return
          if (e instanceof ApiError && e.status === 409) {
            setSaveState('conflict')
            return
          }
          const issues = e instanceof ApiError && e.status === 422 ? e.body?.issues : undefined
          if (issues) setOpen((o) => (o?.id === id ? { ...o, issues } : o))
          dirty.current = true // keep the edit; the next change retries
          setSaveState('failed')
          errorRef.current(e)
          return
        }
      }
    } finally {
      saving.current = false
    }
  }, [])

  const load = useCallback(
    (id: string) => {
      let stale = false
      api.getProcess(id).then(
        (file) => {
          if (stale) return
          latest.current = { id, board: file.board }
          version.current = file.version
          dirty.current = false
          setSaveState('saved')
          setOpen({ id, projectId: file.projectId, board: file.board, issues: file.issues })
        },
        (e) => {
          if (stale) return
          setLoadError(e instanceof ApiError ? e : new ApiError(String(e), 0, null))
          errorRef.current(e)
        },
      )
      return () => {
        stale = true
      }
    },
    [],
  )

  // Switching process: write out any pending edit to the old one first, then load the new one.
  const [openFor, setOpenFor] = useState(processId)
  if (openFor !== processId) {
    setOpenFor(processId)
    setOpen(null)
    setLoadError(null)
  }
  useEffect(() => {
    if (!processId) return
    const cancel = load(processId)
    return () => {
      cancel()
      void flush()
    }
  }, [processId, load, flush])

  // Leaving with an unsaved edit asks first.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (dirty.current || saving.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', onLeave)
    return () => window.removeEventListener('beforeunload', onLeave)
  }, [])

  /** Applies a pure edit to the open board and schedules a save. */
  const edit = useCallback(
    (change: (board: Board) => Board) => {
      const current = latest.current
      if (!current || current.id !== processId) return
      const board = change(current.board)
      if (board === current.board) return
      latest.current = { id: current.id, board }
      setOpen((o) => (o?.id === current.id ? { ...o, board } : o))
      dirty.current = true
      if (saveState !== 'conflict') {
        clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS)
      }
    },
    [processId, flush, saveState],
  )

  /** Discards local edits and loads the stored file again (after a conflict, or to refresh). */
  const reload = useCallback(() => {
    if (!processId) return
    clearTimeout(timer.current)
    dirty.current = false
    load(processId)
  }, [processId, load])

  const setProjectId = useCallback((projectId: string | null) => setOpen((o) => (o ? { ...o, projectId } : o)), [])

  return { open, loadError, saveState, edit, reload, setProjectId }
}
