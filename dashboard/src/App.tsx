import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'


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
import { NodeDetailsModal } from './components/network/NodeDetailsModal'
import { SupplyDemandChart } from './components/charts/SupplyDemandChart'
import { ActivityFeed } from './components/market/ActivityFeed'
import { LedgerTable } from './components/ledger/LedgerTable'
import { TransactionDetailsModal } from './components/ledger/TransactionDetailsModal'
import { EdgeOnboarding } from './components/demo/EdgeOnboarding'
import { MarketIntelligencePanel } from './components/intelligence/MarketIntelligencePanel'
import { GridComparisonPanel } from './components/intelligence/GridComparisonPanel'

import type { LedgerRow, RosterNode } from './demo/events'
import { ProducerDashboard } from './components/producer/ProducerDashboard'

/**
 * Demo-first guided simulator. A single RUN button drives a manual,
 * step-through walkthrough of the whole P2P energy platform — the network
 * forms, a market and price emerge, peers are matched, energy is transferred,
 * and the smart contract escrows + settles payment into an on-chain ledger.
 * Coach-mark dialogs narrate each beat; the spotlight focuses the eye.
 */
export default function App() {
  const demo = useDemoOrchestrator()
  const { status, conn, stageIndex, total, spotlightTarget, ready, dialog, events, voice, controls } = demo

  const inGuide = status === 'running' || status === 'paused'
  const rect = useSpotlightRect(inGuide ? spotlightTarget : null)

  // wall clock for the top bar
  const [now, setNow] = useState(() => Date.now())
  useInterval(() => setNow(Date.now()), 1000)

  // State to track selected ledger row for modal inspection
  const [selectedLedger, setSelectedLedger] = useState<LedgerRow | null>(null)
  
  // State to track selected node for node details modal
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  // Simple state-based routing
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  // Edge Device Integration State
  const [edgeNode, setEdgeNode] = useState<RosterNode | null>(null)
  const [edgeReading, setEdgeReading] = useState<{energy: number; role: string; ts: number} | null>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/edge')
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.id) {
          setEdgeNode({
            id: data.id,
            name: data.name || data.id,
            kind: data.kind || 'solar',
            side: data.role === 'producer' ? 'producer' : 'consumer',
            x: 0.5,
            y: 0.5,
            area: data.area || 'RV College of Engineering',
            lat: data.lat || 12.9237,
            lng: data.lng || 77.4987,
            capacityKw: data.energy || 10
          })
          setEdgeReading({
            energy: data.energy,
            role: data.role || 'producer',
            ts: Date.now()
          })
        }
      } catch (err) {}
    }
    return () => ws.close()
  }, [])

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

  const augmentedRoster = edgeNode 
    ? [...events.roster.filter(n => n.id !== edgeNode.id), edgeNode] 
    : events.roster
    
  const augmentedReadings = edgeReading && edgeNode
    ? { ...events.readings, [edgeNode.id]: edgeReading }
    : events.readings

  if (currentPath === '/setup') {
    return <EdgeOnboarding />
  }

  if (currentPath === '/producer/dashboard') {
    return (
      <DashboardLayout now={now} marketOpen={status !== 'idle'} voice={voice}>
        <ProducerDashboard />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout now={now} marketOpen={status !== 'idle'} voice={voice}>
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
            {status !== 'done' && <StageRail stageIndex={stageIndex} onJump={controls.goTo} />}

            {/* Map is the hero (full height); supporting panels sit in a slim
                rail beside it so the network is visible without scrolling. */}
            <div className={`flex ${status === 'done' ? 'h-[calc(100vh-90px)]' : 'h-[calc(100vh-150px)]'} min-h-[560px] gap-3`}>
              <div className="min-w-0 flex-1">
                <NetworkMap
                  roster={augmentedRoster}
                  transfers={events.transfers}
                  heroIds={heroIds}
                  readings={augmentedReadings}
                  onNodeClick={setSelectedNodeId}
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
                <div data-spotlight="gridcompare">
                  <GridComparisonPanel grid={events.grid} />
                </div>
                <div className="min-h-[200px]" data-spotlight="orderbook">
                  <ActivityFeed feed={events.feed} now={now} />
                </div>
                <div data-spotlight="intelligence">
                  <MarketIntelligencePanel events={events} />
                </div>
                <div className="flex flex-col gap-3" data-spotlight="ledger">
                  <LedgerTable
                    rows={events.ledger}
                    totalEth={events.ledgerTotalEth}
                    count={events.ledgerCount}
                    roster={events.roster}
                    onSelectRow={setSelectedLedger}
                  />
                </div>
              </div>
            </div>
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

      {/* Deep Blockchain Transaction details modal */}
      <TransactionDetailsModal
        row={selectedLedger}
        roster={augmentedRoster}
        onClose={() => setSelectedLedger(null)}
      />

      {/* Node Details Modal */}
      <NodeDetailsModal
        nodeId={selectedNodeId}
        roster={augmentedRoster}
        ledger={events.ledger}
        readings={augmentedReadings}
        onClose={() => setSelectedNodeId(null)}
      />
    </DashboardLayout>
  )
}
