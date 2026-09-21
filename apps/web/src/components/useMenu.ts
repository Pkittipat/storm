import { useEffect, useRef, useState } from 'react'

/**
 * Open/close state for a trigger + Menu pair. Wrap both in an element
 * with `ref` (and `position: relative`); a pointer-down outside it or
 * Escape closes the menu.
 */
export function useMenu<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState(false)
  const ref = useRef<T>(null)
  useEffect(() => {
    if (!open) return
    const onPointer = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return { open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false), ref }
}
