const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const isSlug = (id: string) => SLUG.test(id)

/** "Place order" → "place-order"; "Ship (EU)!" → "ship-eu". Falls back when nothing is left. */
export function slugify(text: string, fallback = 'untitled'): string {
  const slug = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || fallback
}

/**
 * A new, frozen id for something titled `text`: its slug, or the slug with the
 * first free `-2`, `-3`, … suffix when that id is already taken.
 */
export function newId(text: string, taken: Iterable<string>, fallback?: string): string {
  const used = new Set(taken)
  const base = slugify(text, fallback)
  if (!used.has(base)) return base
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`
}
