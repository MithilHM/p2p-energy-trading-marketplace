import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Cpu, Database, Network, Key, Flame } from 'lucide-react'
import type { DemoEventState } from '../../demo/events'

interface Props {
  state: DemoEventState
  conn: string
}

export function ArchitectureVisualizer({ state, conn }: Props) {
  const [pulseMqtt, setPulseMqtt] = useState(false)
  const [pulseKafka, setPulseKafka] = useState(false)
  const [pulseSpark, setPulseSpark] = useState(false)
  const [pulseBlockchain, setPulseBlockchain] = useState(false)
  const [selectedService, setSelectedService] = useState<'gateway' | 'matching' | 'pricing' | 'blockchain' | 'forecasting'>('gateway')

  // Pulse paths when relevant counts change
  useEffect(() => {
    if (state.counts.readings > 0) {
      setPulseMqtt(true)
      const t = setTimeout(() => setPulseMqtt(false), 600)
      return () => clearTimeout(t)
    }
  }, [state.counts.readings])

  useEffect(() => {
    if (state.marketSeries.length > 0) {
      setPulseSpark(true)
      const t = setTimeout(() => setPulseSpark(false), 800)
      return () => clearTimeout(t)
    }
  }, [state.marketSeries.length])

  useEffect(() => {
    if (state.counts.matches > 0) {
      setPulseKafka(true)
      const t = setTimeout(() => setPulseKafka(false), 800)
      return () => clearTimeout(t)
    }
  }, [state.counts.matches])

  useEffect(() => {
    if (state.counts.settlements > 0) {
      setPulseBlockchain(true)
      const t = setTimeout(() => setPulseBlockchain(false), 1000)
      return () => clearTimeout(t)
    }
  }, [state.counts.settlements])

  // Get current active spotlight trade (if any)
  const activeTradeId = state.spotlightTradeId
  const activeEscrow = activeTradeId ? state.escrow[activeTradeId] : null

  return (
    <section className="panel relative flex h-full flex-col overflow-hidden p-0 bg-slate-900/60 border-slate-800/80">
      {/* Title Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/40">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-slate-50">Backend Architecture & Live Data Flow</h3>
          <p className="text-2xs text-slate-400">Interactive visualizer of the real-time event pipeline & blockchain settlement</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-production animate-pulse" />
          <span className="text-2xs font-semibold uppercase tracking-wider text-production">{conn}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 scroll-thin">
        {/* Pipeline Diagram */}
        <div className="relative rounded-lg border border-slate-800/80 bg-slate-950/50 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5 relative z-10">
            
            {/* 1. MQTT INGESTION */}
            <div className="flex flex-col items-center justify-between rounded border border-emerald-950 bg-emerald-950/10 p-3 text-center">
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
                <Network className="h-4 w-4" />
                <span>MQTT Broker</span>
              </div>
              <div className="my-2 space-y-1 w-full text-left">
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Topic (Prod):</span>
                  <span className="font-mono text-emerald-300">energy/production</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Topic (Cons):</span>
                  <span className="font-mono text-emerald-300">energy/consumption</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>IoT Meter Feeds:</span>
                  <span className="font-mono font-bold text-slate-200">{state.roster.length} active</span>
                </div>
              </div>
              <div className="text-3xs font-semibold uppercase text-emerald-400/70 bg-emerald-500/10 rounded px-1.5 py-0.5 border border-emerald-500/20">
                Telemetry Ingest
              </div>
            </div>

            {/* 2. KAFKA BROKER */}
            <div className="flex flex-col items-center justify-between rounded border border-sky-950 bg-sky-950/10 p-3 text-center">
              <div className="flex items-center gap-1.5 text-sky-400 font-bold text-xs uppercase tracking-wider">
                <Database className="h-4 w-4" />
                <span>Kafka Topics</span>
              </div>
              <div className="my-2 space-y-1 w-full text-[10px] text-left">
                <div className="flex justify-between border-b border-sky-950/40 pb-0.5">
                  <span className="text-slate-400 font-mono">energy-production</span>
                  <span className="text-sky-300 font-semibold">{state.counts.readings} msg</span>
                </div>
                <div className="flex justify-between border-b border-sky-950/40 pb-0.5">
                  <span className="text-slate-400 font-mono">energy-consumption</span>
                  <span className="text-sky-300 font-semibold">{state.counts.readings} msg</span>
                </div>
                <div className="flex justify-between border-b border-sky-950/40 pb-0.5">
                  <span className="text-slate-400 font-mono">market-state</span>
                  <span className="text-sky-300 font-semibold">{state.marketSeries.length} msg</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-mono">trades</span>
                  <span className="text-sky-300 font-semibold">{state.counts.matches} msg</span>
                </div>
              </div>
              <div className="text-3xs font-semibold uppercase text-sky-400/70 bg-sky-500/10 rounded px-1.5 py-0.5 border border-sky-500/20">
                Message Broker
              </div>
            </div>

            {/* 3. SPARK STREAMING */}
            <div className="flex flex-col items-center justify-between rounded border border-orange-950 bg-orange-950/10 p-3 text-center">
              <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs uppercase tracking-wider">
                <Cpu className="h-4 w-4" />
                <span>Spark Engine</span>
              </div>
              <div className="my-2 space-y-1 w-full text-[10px] text-left">
                <div className="text-slate-400">Stream Processing:</div>
                <div className="rounded bg-orange-950/30 p-1 font-mono text-[9px] text-orange-300 border border-orange-950/50">
                  tumblingWindow(1-min)<br/>
                  watermark(2-min)
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between mt-1">
                  <span>Market state:</span>
                  <span className="text-slate-200 font-bold">{(state.supply).toFixed(1)} kW S</span>
                </div>
              </div>
              <div className="text-3xs font-semibold uppercase text-orange-400/70 bg-orange-500/10 rounded px-1.5 py-0.5 border border-orange-500/20">
                Live State Aggregation
              </div>
            </div>

            {/* 4. MATCHING / PRICING API */}
            <div className="flex flex-col items-center justify-between rounded border border-purple-950 bg-purple-950/10 p-3 text-center">
              <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs uppercase tracking-wider">
                <Flame className="h-4 w-4" />
                <span>Microservices</span>
              </div>
              <div className="my-2 space-y-1 w-full text-left">
                <button 
                  onClick={() => setSelectedService('pricing')}
                  className={`w-full text-left text-[10px] rounded px-1.5 py-0.5 flex justify-between transition ${selectedService === 'pricing' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/30' : 'text-slate-400 border border-transparent hover:bg-slate-900'}`}
                >
                  <span>Pricing Engine</span>
                  <span className="font-mono text-purple-400">8002</span>
                </button>
                <button 
                  onClick={() => setSelectedService('matching')}
                  className={`w-full text-left text-[10px] rounded px-1.5 py-0.5 flex justify-between transition ${selectedService === 'matching' ? 'bg-purple-900/40 text-purple-300 border border-purple-700/30' : 'text-slate-400 border border-transparent hover:bg-slate-900'}`}
                >
                  <span>Matching Engine</span>
                  <span className="font-mono text-purple-400">8001</span>
                </button>
              </div>
              <div className="text-3xs font-semibold uppercase text-purple-400/70 bg-purple-500/10 rounded px-1.5 py-0.5 border border-purple-500/20">
                Business Logic
              </div>
            </div>

            {/* 5. BLOCKCHAIN SETTLEMENT */}
            <div className="flex flex-col items-center justify-between rounded border border-blue-950 bg-blue-950/10 p-3 text-center">
              <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
                <Key className="h-4 w-4" />
                <span>Smart Contract</span>
              </div>
              <div className="my-2 space-y-1 w-full text-left">
                <div className="text-slate-400 text-[10px] truncate" title="0x5FbDB2315678afecb367f032d93F642f64180aa3">
                  Addr: <span className="font-mono text-blue-300 text-[9px]">0x5FbDB...0aa3</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Escrow Swaps:</span>
                  <span className="font-mono font-bold text-slate-200">{state.counts.settlements} tx</span>
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between">
                  <span>Settled ETH:</span>
                  <span className="font-mono font-bold text-blue-400">{(state.ledgerTotalEth).toFixed(4)} Ξ</span>
                </div>
              </div>
              <div className="text-3xs font-semibold uppercase text-blue-400/70 bg-blue-500/10 rounded px-1.5 py-0.5 border border-blue-500/20">
                Ethereum Escrow
              </div>
            </div>

          </div>

          {/* Animated Connecting Pathways */}
          <div className="absolute inset-0 pointer-events-none hidden md:block">
            {/* MQTT -> Kafka */}
            <div className={`absolute top-[50%] left-[20%] w-[5%] h-0.5 bg-emerald-500/35 transition-all ${pulseMqtt ? 'shadow-[0_0_8px_#10b981] bg-emerald-400' : ''}`} />
            {pulseMqtt && (
              <motion.div 
                initial={{ left: '20%' }} 
                animate={{ left: '25%' }} 
                transition={{ duration: 0.5, ease: 'linear' }}
                className="absolute top-[49%] h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"
              />
            )}

            {/* Kafka -> Spark */}
            <div className={`absolute top-[50%] left-[40%] w-[5%] h-0.5 bg-orange-500/35 transition-all ${pulseSpark ? 'shadow-[0_0_8px_#f97316] bg-orange-400' : ''}`} />
            {pulseSpark && (
              <motion.div 
                initial={{ left: '40%' }} 
                animate={{ left: '45%' }} 
                transition={{ duration: 0.5, ease: 'linear' }}
                className="absolute top-[49%] h-1.5 w-1.5 rounded-full bg-orange-400 shadow-[0_0_8px_#f97316]"
              />
            )}

            {/* Spark -> Microservices */}
            <div className={`absolute top-[50%] left-[60%] w-[5%] h-0.5 bg-purple-500/35 transition-all ${pulseKafka ? 'shadow-[0_0_8px_#a855f7] bg-purple-400' : ''}`} />
            {pulseKafka && (
              <motion.div 
                initial={{ left: '60%' }} 
                animate={{ left: '65%' }} 
                transition={{ duration: 0.5, ease: 'linear' }}
                className="absolute top-[49%] h-1.5 w-1.5 rounded-full bg-purple-400 shadow-[0_0_8px_#a855f7]"
              />
            )}

            {/* Microservices -> Blockchain */}
            <div className={`absolute top-[50%] left-[80%] w-[5%] h-0.5 bg-blue-500/35 transition-all ${pulseBlockchain ? 'shadow-[0_0_8px_#3b82f6] bg-blue-400' : ''}`} />
            {pulseBlockchain && (
              <motion.div 
                initial={{ left: '80%' }} 
                animate={{ left: '85%' }} 
                transition={{ duration: 0.5, ease: 'linear' }}
                className="absolute top-[49%] h-1.5 w-1.5 rounded-full bg-blue-400 shadow-[0_0_8px_#3b82f6]"
              />
            )}
          </div>
        </div>

        {/* Detailed Information Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Smart Contract Escrow Visualizer */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-400 flex items-center gap-1.5">
                <Key className="h-3.5 w-3.5" />
                Escrow Settlement Steps
              </span>
              <span className="text-[10px] text-slate-500 font-mono">EnergyTrade.sol</span>
            </div>

            <div className="space-y-3">
              {/* Step 1: createTrade */}
              <div className={`flex items-start gap-3 rounded p-2.5 transition border ${
                activeEscrow?.stage === 'created' 
                  ? 'bg-blue-950/20 border-blue-800/60 shadow-[0_0_10px_rgba(59,130,246,0.1)]' 
                  : 'bg-slate-900/20 border-slate-800/40 opacity-70'
              }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                  activeEscrow?.stage === 'created' ? 'bg-blue-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>1</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">createTrade(seller, units, price)</div>
                  <p className="text-[10px] text-slate-400">Buyer locks the trade payment in the contract escrow. Funds are held securely on-chain.</p>
                  {activeEscrow?.stage === 'created' && (
                    <div className="mt-1.5 bg-blue-950/50 p-1.5 rounded font-mono text-[9px] text-blue-300 border border-blue-900/50 truncate">
                      TX: {activeEscrow.txHash}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: confirmTrade */}
              <div className={`flex items-start gap-3 rounded p-2.5 transition border ${
                activeEscrow?.stage === 'confirmed' 
                  ? 'bg-amber-950/20 border-amber-800/60 shadow-[0_0_10px_rgba(245,158,11,0.1)]' 
                  : 'bg-slate-900/20 border-slate-800/40 opacity-70'
              }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                  activeEscrow?.stage === 'confirmed' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>2</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">confirmTrade(tradeId)</div>
                  <p className="text-[10px] text-slate-400">IoT meter simulator registers physical energy transfer delivery. Blockchain service verifies and confirms transaction.</p>
                  {activeEscrow?.stage === 'confirmed' && (
                    <div className="mt-1.5 bg-amber-950/50 p-1.5 rounded font-mono text-[9px] text-amber-300 border border-amber-900/50 truncate">
                      TX: {activeEscrow.txHash}
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: releasePayment */}
              <div className={`flex items-start gap-3 rounded p-2.5 transition border ${
                activeEscrow?.stage === 'released' 
                  ? 'bg-emerald-950/20 border-emerald-800/60 shadow-[0_0_10px_rgba(16,185,129,0.1)]' 
                  : 'bg-slate-900/20 border-slate-800/40 opacity-70'
              }`}>
                <div className={`h-5 w-5 rounded-full flex items-center justify-center text-xs font-mono font-bold shrink-0 mt-0.5 ${
                  activeEscrow?.stage === 'released' ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>3</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-200">releasePayment(tradeId)</div>
                  <p className="text-[10px] text-slate-400">Contract releases escrowed ETH directly to the seller's cryptographic wallet. Finalized automatically.</p>
                  {activeEscrow?.stage === 'released' && (
                    <div className="mt-1.5 bg-emerald-950/50 p-1.5 rounded font-mono text-[9px] text-emerald-300 border border-emerald-900/50 truncate">
                      TX: {activeEscrow.txHash}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Microservices API Explorer */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                  <Cpu className="h-3.5 w-3.5" />
                  API Endpoints Gateway
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Routing Registry</span>
              </div>

              <div className="space-y-2">
                <div className="rounded border border-slate-800 bg-slate-900/30 p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-1 py-0.5 rounded">GET</span>
                    <span className="text-2xs font-mono font-semibold text-slate-200">/pricing/current-price</span>
                  </div>
                  <p className="text-3xs text-slate-400">Calculates spot price dynamically based on real-time aggregate supply/demand.</p>
                </div>

                <div className="rounded border border-slate-800 bg-slate-900/30 p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-bold uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 px-1 py-0.5 rounded">POST</span>
                    <span className="text-2xs font-mono font-semibold text-slate-200">/orders/buy</span>
                  </div>
                  <p className="text-3xs text-slate-400">Submits limit buy order from consumer with matching threshold target price.</p>
                </div>

                <div className="rounded border border-slate-800 bg-slate-900/30 p-2 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-3xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1 py-0.5 rounded">POST</span>
                    <span className="text-2xs font-mono font-semibold text-slate-200">/trades/settle</span>
                  </div>
                  <p className="text-3xs text-slate-400">Executes on-chain smart contract deployment and auto-settlement for matched trades.</p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded border border-slate-800 bg-slate-950 p-2 text-center text-3xs text-slate-400">
              Gateway routes request prefixes: <span className="font-mono text-slate-200">/orders/*</span> to Port 8001, <span className="font-mono text-slate-200">/pricing/*</span> to Port 8002, <span className="font-mono text-slate-200">/trades/*</span> to Port 8003.
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
