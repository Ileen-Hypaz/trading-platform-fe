// ---------------------------------------------------------------------------
// Skeleton loading primitives — animate-pulse shimmer for all data panels
// ---------------------------------------------------------------------------

interface SkeletonLineProps {
  className?: string
}

export function SkeletonLine({ className }: SkeletonLineProps) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-700/60 ${className ?? ''}`}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Stat card skeleton (matches Dashboard summary cards)
// ---------------------------------------------------------------------------

export function SkeletonStatCard() {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-xl p-5"
      aria-hidden="true"
    >
      <SkeletonLine className="h-3 w-20 mb-3" />
      <SkeletonLine className="h-8 w-28" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Table row skeleton (configurable column count + optional first-col width)
// ---------------------------------------------------------------------------

interface SkeletonTableRowProps {
  cols: number
  /** Tailwind width class for the first (non-right-aligned) column. Default "w-16". */
  firstColWidth?: string
}

export function SkeletonTableRow({ cols, firstColWidth = 'w-16' }: SkeletonTableRowProps) {
  return (
    <tr aria-hidden="true">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <SkeletonLine
            className={`h-4 ${i === 0 ? firstColWidth : 'w-14 ml-auto'}`}
          />
        </td>
      ))}
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Signal card skeleton (matches Suggestions signal cards)
// ---------------------------------------------------------------------------

export function SkeletonSignalCard() {
  return (
    <div
      className="bg-surface-card border border-surface-border rounded-xl p-5 flex flex-col gap-4"
      aria-hidden="true"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <SkeletonLine className="h-6 w-14" />
          <SkeletonLine className="h-5 w-12 rounded-full" />
          <SkeletonLine className="h-5 w-28 rounded-full" />
        </div>
        <SkeletonLine className="h-4 w-32" />
      </div>
      {/* Rationale lines */}
      <div className="space-y-2">
        <SkeletonLine className="h-3.5 w-full" />
        <SkeletonLine className="h-3.5 w-5/6" />
        <SkeletonLine className="h-3.5 w-4/6" />
      </div>
      {/* Action buttons */}
      <div className="flex gap-2">
        <SkeletonLine className="h-9 w-28 rounded-lg" />
        <SkeletonLine className="h-9 w-20 rounded-lg" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Chart area skeleton (matches PriceChart body)
// ---------------------------------------------------------------------------

export function SkeletonChartArea() {
  return (
    <div
      className="h-52 flex flex-col justify-end gap-2 px-2 pb-2"
      aria-hidden="true"
    >
      {/* Simulate bar graph columns */}
      <div className="flex items-end gap-1 h-40">
        {[55, 70, 45, 80, 60, 90, 65, 75, 50, 85, 60, 70].map((h, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm animate-pulse bg-slate-700/60"
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      {/* X-axis line */}
      <SkeletonLine className="h-px w-full" />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Watchlist item skeleton row
// ---------------------------------------------------------------------------

export function SkeletonWatchlistItem() {
  return (
    <li className="flex items-center justify-between py-2.5 gap-3" aria-hidden="true">
      <div className="flex items-center gap-2">
        <SkeletonLine className="h-4 w-12" />
        <SkeletonLine className="h-3 w-24" />
      </div>
      <SkeletonLine className="h-3 w-14" />
    </li>
  )
}
