import type { Board, Issue } from '@stormm/process-model'
import { useCallback, useEffect, useRef, useState } from 'react'
import { StorageError, storage } from './storage'

export type SaveState = 'saved' | 'failed'

export interface OpenProcess {
  id: string
  projectId: string | null
  board: Board
  issues: Issue[]
}

/**
 * Loads one process from this browser's storage and keeps it saved: every edit applies at
 * once and is written straight back as the whole YAML. If storage refuses the write (full,
 * blocked) the state is `failed` and the next edit retries.
 */
export function useProcess(processId: string | null, onError: (e: unknown) => void) {
  const [open, setOpen] = useState<OpenProcess | null>(null)
  const [loadError, setLoadError] = useState<StorageError | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('saved')

  const latest = useRef<{ id: string; board: Board } | null>(null)
  const errorRef = useRef(onError)
  useEffect(() => {
    errorRef.current = onError
  })

  const [openFor, setOpenFor] = useState<string | null>(null)
  if (openFor !== processId) {
    setOpenFor(processId)
    setOpen(null)
    setLoadError(null)
    setSaveState('saved')
    if (processId) {
      try {
        setOpen({ id: processId, ...storage.getProcess(processId) })
      } catch (e) {
        setLoadError(e instanceof StorageError ? e : new StorageError(String(e)))
      }
    }
  }

  // Edits build on the last edited board (several can land before a re-render), else on the loaded one.
  useEffect(() => {
    latest.current = null
  }, [processId])

  /** Applies a pure edit to the open board and saves it. */
  const edit = useCallback(
    (change: (board: Board) => Board) => {
      const current = latest.current ?? (open?.id === processId ? { id: open.id, board: open.board } : null)
      if (!current || current.id !== processId) return
      const board = change(current.board)
      if (board === current.board) return
      latest.current = { id: current.id, board }
      setOpen((o) => (o?.id === current.id ? { ...o, board } : o))
      try {
        storage.saveProcess(board)
        setSaveState('saved')
      } catch (e) {
        setSaveState('failed')
        errorRef.current(e)
      }
    },
    [processId, open],
  )

  const setProjectId = useCallback((projectId: string | null) => setOpen((o) => (o ? { ...o, projectId } : o)), [])

  return { open, loadError, saveState, edit, setProjectId }
}
