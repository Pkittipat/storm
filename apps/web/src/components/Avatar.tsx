interface AvatarProps {
  /** A single character — the source only ever shows one initial. */
  initial: string
}

/** The 30px circular user-initial avatar shown at the foot of the sidebar. */
export function Avatar({ initial }: AvatarProps) {
  return (
    <div
      aria-hidden="true"
      className="flex h-control-sm w-control-sm shrink-0 items-center justify-center rounded-full bg-text text-label font-semibold text-surface"
    >
      {initial}
    </div>
  )
}
