interface ZoomControlProps {
  percent: number
  onZoomIn?: () => void
  onZoomOut?: () => void
}

/** The floating zoom stepper pinned to a canvas corner. */
export function ZoomControl({ percent, onZoomIn, onZoomOut }: ZoomControlProps) {
  return (
    <div className="flex h-control-lg items-center gap-step-3xs rounded-node border border-border bg-surface-raised px-step-2xs">
      <button
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="h-control-xs w-control-sm rounded-md border-0 bg-transparent text-base text-text-muted"
      >
        &minus;
      </button>
      <span className="w-11 text-center font-mono text-meta text-text-secondary">{percent}%</span>
      <button
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="h-control-xs w-control-sm rounded-md border-0 bg-transparent text-base text-text-muted"
      >
        +
      </button>
    </div>
  )
}
