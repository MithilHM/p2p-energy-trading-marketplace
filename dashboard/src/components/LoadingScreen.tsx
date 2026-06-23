import { ChartSkeleton, KPISkeleton, TableSkeleton } from './primitives/Skeleton'

/** Full-page skeleton mirroring the real layout so the transition to live data
 *  has no layout shift. */
export function LoadingScreen() {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <KPISkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-12">
        <div className="flex flex-col gap-3 lg:col-span-1 xl:col-span-3">
          <ChartSkeleton height={200} />
          <ChartSkeleton height={170} />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-1 xl:col-span-6">
          <ChartSkeleton height={240} />
          <TableSkeleton rows={5} />
        </div>
        <div className="flex flex-col gap-3 lg:col-span-2 xl:col-span-3">
          <TableSkeleton rows={6} />
          <TableSkeleton rows={4} />
        </div>
      </div>
    </div>
  )
}
