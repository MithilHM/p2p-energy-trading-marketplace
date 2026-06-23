import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface SectionHeaderProps {
  icon?: LucideIcon
  /** small kicker above the title */
  kicker?: string
  title: string
  description?: string
  accent?: string // tailwind text color class, e.g. 'text-production'
  actions?: ReactNode
}

/**
 * Top-of-section heading with an accent rule, used to delineate the major
 * analytical zones (Markets, Forecasting, Operations).
 */
export function SectionHeader({
  icon: Icon,
  kicker,
  title,
  description,
  accent = 'text-slate-300',
  actions,
}: SectionHeaderProps) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-700/60 bg-slate-900/60">
            <Icon className={`h-4 w-4 ${accent}`} strokeWidth={1.75} />
          </div>
        )}
        <div>
          {kicker && (
            <div className={`eyebrow mb-1 ${accent}`}>{kicker}</div>
          )}
          <h2 className="text-lg font-semibold leading-tight tracking-tight text-slate-100">
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 max-w-xl text-xs text-slate-400">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
