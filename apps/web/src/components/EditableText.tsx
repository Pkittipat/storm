import { useState, type InputHTMLAttributes } from 'react'

interface EditableTextProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string
  /** Called on blur/Enter with the trimmed draft, only when it changed. */
  onCommit: (value: string) => void
  /** Reject an empty draft (revert instead of committing). */
  required?: boolean
}

/**
 * A borderless text input that looks like the text it edits — inherit
 * the surrounding type style via `className`. Edits are local until
 * blur/Enter so a keystroke never becomes a network write; Escape reverts.
 */
export function EditableText({ value, onCommit, required, className = '', onBlur, onFocus, ...props }: EditableTextProps) {
  const [draft, setDraft] = useState(value)
  // Adopt a new value from outside (e.g. a server resync) — React's "adjust state on prop change" pattern.
  const [synced, setSynced] = useState(value)
  if (value !== synced) {
    setSynced(value)
    setDraft(value)
  }

  const commit = () => {
    const next = draft.trim()
    if (required && !next) return setDraft(value)
    if (next !== value) onCommit(next)
    else setDraft(value)
  }

  return (
    <input
      type="text"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => {
        // An auto-focused field is a fresh placeholder (new hotspot, new process…) — select it so typing replaces it.
        if (props.autoFocus) e.currentTarget.select()
        onFocus?.(e)
      }}
      onBlur={(e) => {
        commit()
        onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          setDraft(value)
          requestAnimationFrame(() => e.currentTarget?.blur())
        }
      }}
      className={`min-w-0 rounded-md border-0 bg-transparent outline-none focus:bg-surface-raised focus:ring-1 focus:ring-border-input ${className}`}
      {...props}
    />
  )
}
