import type { CSSProperties } from 'react'

interface SkeletonProps {
  className?: string
  style?: CSSProperties
}

/** Base shimmer block. Shimmer is a single sweeping highlight — used sparingly. */
export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div className={`relative overflow-hidden rounded bg-slate-800/60 ${className}`} style={style}>
      <div className="absolute inset-0 -translate-x-full shimmer-mask animate-shimmer" />
    </div>
  )
}

/** KPI card placeholder. */
export function KPISkeleton() {
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-9 w-32" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-7 w-20" />
      </div>
    </div>
  )
}

/** Generic chart panel placeholder. */
export function ChartSkeleton({ height = 220 }: { height?: number }) {
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="w-full rounded" style={{ height }} />
    </div>
  )
}

/** Table placeholder with N rows. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="panel flex flex-col gap-3 p-4">
      <Skeleton className="h-3 w-32" />
      <div className="flex flex-col gap-2.5">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-3 w-12" />
            <Skeleton className="h-3 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}
