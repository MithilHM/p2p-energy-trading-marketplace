import { useId } from 'react'
import { motion } from 'framer-motion'

interface RangeTabsProps<T extends string> {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  className?: string
}

/**
 * Compact segmented control for chart time-ranges. The active pill slides
 * between options via a shared layoutId — a small, tasteful motion accent.
 */
export function RangeTabs<T extends string>({ options, value, onChange, className = '' }: RangeTabsProps<T>) {
  const layoutId = useId()
  return (
    <div className={`inline-flex items-center gap-0.5 rounded border border-slate-700/60 bg-slate-900/60 p-0.5 ${className}`}>
      {options.map((opt) => {
        const active = opt === value
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`relative rounded px-2 py-0.5 text-2xs font-medium uppercase tracking-wide transition-colors ${
              active ? 'text-slate-100' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded bg-slate-700/70"
                transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{opt}</span>
          </button>
        )
      })}
    </div>
  )
}
