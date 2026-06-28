/**
 * P2P marketplace vs central grid. Fed by the cumulative `gridcompare` event
 * (live orchestrator or offline replay). By construction the peer market always
 * wins — it clears between the grid's feed-in and retail tariffs — so every
 * settled trade saves the buyer money, earns the seller more, and keeps energy
 * local (avoided line losses).
 */
import { motion } from 'framer-motion'
import { ArrowLeftRight, IndianRupee, Leaf, TrendingDown, Zap } from 'lucide-react'
import type { GridComparison } from '../../demo/events'

const inr = (v: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.round(v))}`

export function GridComparisonPanel({ grid }: { grid: GridComparison }) {
  const hasData = grid.energyTradedKwh > 0
  const p2pSpend = Math.max(0, grid.gridImportCost - grid.consumerSavings)
  // bar widths: P2P spend relative to the grid cost (always shorter)
  const p2pPct = grid.gridImportCost > 0 ? (p2pSpend / grid.gridImportCost) * 100 : 0

  return (
    <section className="panel flex flex-col overflow-hidden" data-spotlight="gridcompare">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="h-3.5 w-3.5 text-production" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">P2P vs Central Grid</h3>
        </div>
        {hasData && (
          <motion.span
            key={grid.savingsPct}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="inline-flex items-center gap-1 rounded-md bg-production/10 px-2 py-0.5 text-2xs font-semibold text-production ring-1 ring-production/30"
          >
            <TrendingDown className="h-3 w-3" />
            {grid.savingsPct.toFixed(1)}% cheaper
          </motion.span>
        )}
      </header>

      {!hasData ? (
        <div className="px-4 py-6 text-center text-2xs text-slate-500">
          Awaiting the first settled trade — savings appear as peers trade.
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-3">
          {/* cost comparison bars */}
          <div className="flex flex-col gap-2">
            <div>
              <div className="mb-1 flex items-center justify-between text-2xs">
                <span className="text-slate-400">Central grid would cost</span>
                <span className="tabular font-semibold text-alert">{inr(grid.gridImportCost)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full w-full rounded-full bg-alert/60" />
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-2xs">
                <span className="text-slate-400">Paid on the P2P market</span>
                <span className="tabular font-semibold text-production">{inr(p2pSpend)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <motion.div
                  className="h-full rounded-full bg-production"
                  initial={{ width: 0 }}
                  animate={{ width: `${p2pPct}%` }}
                  transition={{ duration: 0.6 }}
                />
              </div>
            </div>
          </div>

          {/* money + energy stats */}
          <div className="grid grid-cols-2 gap-2">
            <div className="panel-inset p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-2xs text-slate-400">
                <IndianRupee className="h-3 w-3 text-production" /> Consumers saved
              </div>
              <div className="tabular text-base font-semibold text-production">{inr(grid.consumerSavings)}</div>
            </div>
            <div className="panel-inset p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-2xs text-slate-400">
                <IndianRupee className="h-3 w-3 text-market" /> Producers earned extra
              </div>
              <div className="tabular text-base font-semibold text-market">{inr(grid.producerEarnings)}</div>
            </div>
            <div className="panel-inset p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-2xs text-slate-400">
                <Zap className="h-3 w-3 text-forecast" /> Energy traded P2P
              </div>
              <div className="tabular text-base font-semibold text-slate-100">
                {grid.energyTradedKwh.toFixed(1)}
                <span className="ml-1 text-2xs font-normal text-slate-500">kWh</span>
              </div>
            </div>
            <div className="panel-inset p-2.5">
              <div className="mb-0.5 flex items-center gap-1.5 text-2xs text-slate-400">
                <Leaf className="h-3 w-3 text-production" /> Grid losses avoided
              </div>
              <div className="tabular text-base font-semibold text-slate-100">
                {grid.gridLossAvoidedKwh.toFixed(1)}
                <span className="ml-1 text-2xs font-normal text-slate-500">kWh</span>
              </div>
            </div>
          </div>

          {/* community benefit footer */}
          <div className="flex items-center justify-between rounded-lg bg-production/5 px-3 py-2 ring-1 ring-production/20">
            <span className="text-2xs text-slate-300">Total community benefit vs grid</span>
            <span className="tabular text-sm font-bold text-production">{inr(grid.communityBenefit)}</span>
          </div>
          <p className="text-center text-[10px] leading-tight text-slate-500">
            Grid retail ₹{grid.retailTariff}/kWh · feed-in ₹{grid.feedInTariff}/kWh · peers clear in between
          </p>
        </div>
      )}
    </section>
  )
}
