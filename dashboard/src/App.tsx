import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { RotateCcw, Sparkles } from 'lucide-react'

import { DashboardLayout } from './components/layout/DashboardLayout'
import { useInterval } from './hooks/useInterval'

import { useDemoOrchestrator } from './demo/useDemoOrchestrator'
import { useSpotlightRect } from './demo/coach/useSpotlightRect'
import { SpotlightOverlay } from './demo/coach/SpotlightOverlay'
import { CoachMark } from './demo/coach/CoachMark'

import { RunLanding } from './components/demo/RunLanding'
import { StageRail } from './components/demo/StageRail'
import { PriceTape } from './components/demo/PriceTape'
import { NetworkMap } from './components/network/NetworkMap'
import { SupplyDemandChart } from './components/charts/SupplyDemandChart'
import { ActivityFeed } from './components/market/ActivityFeed'
import { EscrowPanel } from './components/ledger/EscrowPanel'
import { LedgerTable } from './components/ledger/LedgerTable'
import { sectionReveal } from './lib/motion'

/**
 * Demo-first guided simulator. A single RUN button drives a manual,
 * step-through walkthrough of the whole P2P energy platform — the network
 * forms, a market and price emerge, peers are matched, energy is transferred,
 * and the smart contract escrows + settles payment into an on-chain ledger.
 * Coach-mark dialogs narrate each beat; the spotlight focuses the eye.
 */
export default function App() {
  const demo = useDemoOrchestrator()
  const { status, conn, stageIndex, total, spotlightTarget, ready, dialog, events, controls } = demo

  const inGuide = status === 'running' || status === 'paused'
  const rect = useSpotlightRect(inGuide ? spotlightTarget : null)

  // wall clock for the top bar
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), 1000)

  // keyboard navigation during the walkthrough
  useEffect(() => {
    if (!inGuide) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') controls.next()
      else if (e.key === 'ArrowLeft') controls.back()
      else if (e.key === ' ') {
        e.preventDefault()
        status === 'paused' ? controls.play() : controls.pause()
      } else if (e.key === 'Escape') controls.skip()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [inGuide, status, controls])

  const marketData = events.marketSeries.map((p) => ({ t: p.t, supply: p.supply, demand: p.demand }))
  const spotlightEscrow = events.spotlightTradeId ? events.escrow[events.spotlightTradeId] ?? null : null
  const heroIds = events.spotlightTradeId && spotlightEscrow
    ? [spotlightEscrow.sellerId, spotlightEscrow.buyerId]
    : events.transfers.filter((t) => t.spotlight).flatMap((t) => [t.fromId, t.toId])

  return (
    <DashboardLayout now={now} marketOpen={status !== 'idle'}>
      <AnimatePresence mode="wait">
        {status === 'idle' ? (
          <motion.div key="landing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <RunLanding onRun={controls.run} conn={conn} />
          </motion.div>
        ) : (
          <motion.div
            key="sim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="flex flex-col gap-3"
          >
            <StageRail stageIndex={stageIndex} onJump={controls.goTo} />

            {/* Map is the hero (full height); supporting panels sit in a slim
                rail beside it so the network is visible without scrolling. */}
            <div className="flex h-[calc(100vh-150px)] min-h-[560px] gap-3">
              <div className="min-w-0 flex-1">
                <NetworkMap
                  roster={events.roster}
                  transfers={events.transfers}
                  heroIds={heroIds}
                  readings={events.readings}
                />
              </div>

              <div className="scroll-thin flex w-[360px] shrink-0 flex-col gap-3 overflow-y-auto">
                <div className="flex flex-col gap-3" data-spotlight="market">
                  <SupplyDemandChart data={marketData} />
                  <PriceTape
                    price={events.price}
                    deltaPct={events.priceDeltaPct}
                    trend={events.priceTrend}
                    series={events.priceSeries}
                    source={events.marketSource}
                  />
                </div>
                <div className="min-h-[200px]" data-spotlight="orderbook">
                  <ActivityFeed feed={events.feed} now={now} />
                </div>
                <div className="flex flex-col gap-3" data-spotlight="ledger">
                  <EscrowPanel escrow={spotlightEscrow} roster={events.roster} />
                  <LedgerTable
                    rows={events.ledger}
                    totalEth={events.ledgerTotalEth}
                    count={events.ledgerCount}
                    roster={events.roster}
                  />
                </div>
              </div>
            </div>

            {status === 'done' && (
              <motion.div
                variants={sectionReveal}
                initial="hidden"
                animate="show"
                className="flex items-center justify-center gap-3 py-4"
              >
                <span className="inline-flex items-center gap-1.5 text-2xs text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-production" /> Walkthrough complete · free-roam mode
                </span>
                <button
                  onClick={controls.replay}
                  className="inline-flex items-center gap-1.5 rounded border border-production/40 bg-production/10 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-production transition-colors hover:bg-production/20"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Replay
                </button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* spotlight + coach mark overlay the guided run */}
      {inGuide && <SpotlightOverlay rect={rect} />}
      <AnimatePresence>
        {inGuide && (
          <CoachMark
            key={stageIndex}
            index={stageIndex}
            total={total}
            title={dialog.title}
            body={dialog.body}
            ready={ready}
            paused={status === 'paused'}
            rect={rect}
            controls={controls}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  )
}
