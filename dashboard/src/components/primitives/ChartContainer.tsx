import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import type { LucideIcon } from 'lucide-react'
import { riseIn } from '../../lib/motion'

interface ChartContainerProps {
  title: string
  icon?: LucideIcon
  accent?: string // tailwind text color class for the icon/title rule
  /** right-aligned meta — legend, range tabs, current value */
  meta?: ReactNode
  /** optional footer strip (legend / annotations) */
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
  /** participates in stagger when true (default) */
  animate?: boolean
}

/**
 * The canonical card surface for any data viz. Provides the title row, accent
 * rule, optional meta + footer, and hover elevation — so individual charts
 * only own their plotting logic.
 */
export function ChartContainer({
  title,
  icon: Icon,
  accent = 'text-slate-400',
  meta,
  footer,
  children,
  className = '',
  bodyClassName = '',
  animate = true,
}: ChartContainerProps) {
  return (
    <motion.section
      variants={animate ? riseIn : undefined}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
      className={`panel group flex flex-col overflow-hidden transition-colors hover:border-slate-600/70 ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className={`h-3.5 w-3.5 ${accent}`} strokeWidth={2} />}
          <h3 className="eyebrow text-slate-300">{title}</h3>
        </div>
        {meta && <div className="flex items-center gap-2 text-2xs text-slate-400">{meta}</div>}
      </header>
      <div className={`flex-1 px-2 py-3 sm:px-3 ${bodyClassName}`}>{children}</div>
      {footer && (
        <footer className="border-t border-slate-700/50 px-4 py-2.5 text-2xs text-slate-400">
          {footer}
        </footer>
      )}
    </motion.section>
  )
}
