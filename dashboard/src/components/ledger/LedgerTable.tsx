/**
 * Append-only settlement ledger. Each cleared trade writes one immutable row;
 * newest slides in at the top (AnimatePresence + layout, same pattern as the
 * trade ActivityFeed). Running total accumulates across the whole demo.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCheck, ScrollText } from 'lucide-react'
import { feedRow } from '../../lib/motion'
import { formatClock } from '../../lib/format'
import { AnimatedMetric } from '../primitives/AnimatedMetric'
import type { LedgerRow, RosterNode } from '../../demo/events'

interface LedgerTableProps {
  rows: LedgerRow[]
  totalEth: number
  count: number
  roster: RosterNode[]
  onSelectRow: (row: LedgerRow) => void
}

function shortName(roster: RosterNode[], id: string) {
  return roster.find((n) => n.id === id)?.name ?? id
}

export function LedgerTable({ rows, totalEth, count, roster, onSelectRow }: LedgerTableProps) {
  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ScrollText className="h-3.5 w-3.5 text-forecast" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Settlement Ledger</h3>
        </div>
        <span className="text-2xs text-slate-500">automated · on-chain</span>
      </header>

      <div className="scroll-thin max-h-[260px] flex-1 overflow-y-auto px-2 py-1.5">
        {rows.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-2xs text-slate-600">
            no settled payments yet
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {rows.map((r) => (
              <motion.div
                key={r.tradeId}
                layout
                variants={feedRow}
                initial="hidden"
                animate="show"
                exit="exit"
                onClick={() => onSelectRow(r)}
                className="flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-slate-800/50 cursor-pointer"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-forecast/10">
                  <CheckCheck className="h-3.5 w-3.5 text-forecast" strokeWidth={2.25} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded border border-forecast/30 px-1 text-[9px] font-bold tracking-wide text-forecast">
                      SETTLED
                    </span>
                    <span className="truncate text-2xs font-medium text-slate-200">
                      {shortName(roster, r.sellerId)}
                    </span>
                    <span className="text-slate-600">→</span>
                    <span className="truncate text-2xs text-slate-400">{shortName(roster, r.buyerId)}</span>
                  </div>
                  <div className="tabular truncate text-2xs text-slate-600">{r.txHash}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular text-2xs font-semibold text-slate-100">
                    ₹{Math.round(r.priceUsd * r.units)} <span className="text-slate-500">· {r.units.toFixed(0)}kWh</span>
                  </div>
                  <div className="tabular text-2xs text-market">{r.amountEth.toFixed(6)} ETH</div>
                </div>
                <div className="w-9 shrink-0 text-right tabular text-2xs text-slate-600">
                  {formatClock(r.ts).slice(0, 5)}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-700/50 px-4 py-2.5 text-2xs">
        <span className="text-slate-500">
          <span className="tabular text-slate-300">{count}</span> payments settled
        </span>
        <span className="text-slate-500">
          Total{' '}
          <AnimatedMetric
            value={totalEth}
            format="number"
            decimals={6}
            unit="ETH"
            className="font-semibold text-production"
          />
        </span>
      </footer>
    </section>
  )
}
