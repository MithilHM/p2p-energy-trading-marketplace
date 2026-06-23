import { motion } from 'framer-motion'
import type { KPIDatum } from '../../data/types'
import { KPICard } from './KPICard'
import { staggerContainer } from '../../lib/motion'

interface KPIGridProps {
  data: KPIDatum[]
}

/**
 * Top KPI bar — six headline metrics. On wide screens all six sit in one row
 * (terminal density); collapses to 3 / 2 columns down the breakpoints.
 */
export function KPIGrid({ data }: KPIGridProps) {
  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-6"
    >
      {data.map((d) => (
        <KPICard key={d.id} datum={d} invertDelta={d.id === 'grid'} />
      ))}
    </motion.div>
  )
}
