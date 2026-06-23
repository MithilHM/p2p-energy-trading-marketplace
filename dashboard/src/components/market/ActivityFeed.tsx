import { AnimatePresence, motion } from 'framer-motion'
import { ArrowDownLeft, ArrowUpRight, CheckCheck, Link2, Radio } from 'lucide-react'
import type { OrderSide, TradeEvent } from '../../data/types'
import { feedRow } from '../../lib/motion'
import { timeAgo } from '../../lib/format'

interface ActivityFeedProps {
  feed: TradeEvent[]
  now: number
}

const sideMeta: Record<
  OrderSide,
  { label: string; icon: typeof ArrowUpRight; text: string; bg: string; chip: string }
> = {
  buy: { label: 'BUY', icon: ArrowDownLeft, text: 'text-consumption', bg: 'bg-consumption/10', chip: 'border-consumption/30' },
  sell: { label: 'SELL', icon: ArrowUpRight, text: 'text-production', bg: 'bg-production/10', chip: 'border-production/30' },
  match: { label: 'MATCH', icon: Link2, text: 'text-market', bg: 'bg-market/10', chip: 'border-market/30' },
  settle: { label: 'SETTLE', icon: CheckCheck, text: 'text-forecast', bg: 'bg-forecast/10', chip: 'border-forecast/30' },
}

/**
 * Live order/trade tape. New events slide in at the top via AnimatePresence;
 * the list reorders smoothly as the window scrolls older events off the end.
 */
export function ActivityFeed({ feed, now }: ActivityFeedProps) {
  return (
    <section className="panel flex h-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Radio className="h-3.5 w-3.5 text-production" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Live Trading Activity</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 text-2xs text-slate-500">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-1.5 w-1.5 animate-ping rounded-full bg-production opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-production" />
          </span>
          streaming
        </span>
      </header>

      <div className="scroll-thin flex-1 overflow-hidden px-2 py-1.5">
        <AnimatePresence initial={false}>
          {feed.map((t) => {
            const m = sideMeta[t.side]
            const Icon = m.icon
            return (
              <motion.div
                key={t.id}
                layout
                variants={feedRow}
                initial="hidden"
                animate="show"
                exit="exit"
                className="flex items-center gap-2.5 rounded px-2 py-1.5 transition-colors hover:bg-slate-800/50"
              >
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${m.bg}`}>
                  <Icon className={`h-3.5 w-3.5 ${m.text}`} strokeWidth={2.25} />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`rounded border px-1 text-[9px] font-bold tracking-wide ${m.chip} ${m.text}`}>
                      {m.label}
                    </span>
                    <span className="truncate text-2xs font-medium text-slate-200">{t.party}</span>
                  </div>
                  <div className="truncate text-2xs text-slate-500">
                    {t.counterparty ? (
                      <>↔ {t.counterparty}</>
                    ) : (
                      <span className="tabular">{t.id}</span>
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="tabular text-2xs font-semibold text-slate-100">
                    {t.qtyKwh.toFixed(0)} <span className="text-slate-500">kWh</span>
                  </div>
                  <div className="tabular text-2xs text-market">₹{t.price.toFixed(2)}</div>
                </div>

                <div className="w-8 shrink-0 text-right tabular text-2xs text-slate-600">
                  {timeAgo(t.ts, now)}
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </section>
  )
}
