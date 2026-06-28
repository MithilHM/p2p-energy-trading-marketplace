import { motion, AnimatePresence } from 'framer-motion'
import { X, Sun, Wind, Battery, Home, Factory, Building, Zap, Key, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import type { LedgerRow, RosterNode } from '../../demo/events'

interface Props {
  nodeId: string | null
  roster: RosterNode[]
  ledger: LedgerRow[]
  readings: Record<string, { energy: number; role: string; ts: number }>
  onClose: () => void
}

function getNodeIcon(kind: string) {
  switch (kind) {
    case 'solar': return <Sun className="h-5 w-5 text-amber-400" />
    case 'wind': return <Wind className="h-5 w-5 text-sky-400" />
    case 'battery': return <Battery className="h-5 w-5 text-emerald-400" />
    case 'home': return <Home className="h-5 w-5 text-indigo-400" />
    case 'industrial': return <Factory className="h-5 w-5 text-pink-400" />
    case 'commercial': return <Building className="h-5 w-5 text-purple-400" />
    default: return <Zap className="h-5 w-5 text-yellow-400" />
  }
}

function generateNodeAddress(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
    hash |= 0
  }
  const hex = Math.abs(hash).toString(16).padEnd(8, 'f')
  return `0x7099${hex.slice(0, 8)}E53${hex.slice(4, 8)}B4c5f${hex.slice(0, 4)}`
}

export function NodeDetailsModal({ nodeId, roster, ledger, readings, onClose }: Props) {
  if (!nodeId) return null

  const node = roster.find((n) => n.id === nodeId)
  if (!node) return null

  const address = generateNodeAddress(node.id)
  
  // Aggregate statistics from ledger
  let producedEnergy = 0
  let receivedEnergy = 0
  let moneyEarned = 0
  let moneySpent = 0

  ledger.forEach((row) => {
    if (row.sellerId === node.id) {
      producedEnergy += row.units
      moneyEarned += row.priceUsd * row.units
    }
    if (row.buyerId === node.id) {
      receivedEnergy += row.units
      moneySpent += row.priceUsd * row.units
    }
  })

  const currentReading = readings[node.id]?.energy ?? 0

  // Filter recent trades for this specific node
  const nodeLedger = ledger.filter(
    (row) => row.sellerId === node.id || row.buyerId === node.id
  ).slice(0, 5)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl scroll-thin"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-800 border border-slate-700">
                {getNodeIcon(node.kind)}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-50">{node.name}</h3>
                <p className="font-mono text-3xs text-slate-500 uppercase tracking-wider">
                  {node.kind} Node · {node.area ?? 'Bengaluru'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: General & Cryptographic Address */}
            <div className="space-y-5">
              {/* Blockchain Identity */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
                <h4 className="eyebrow mb-3 text-slate-500">Blockchain Account Address</h4>
                <div className="flex items-center gap-2 font-mono text-3xs text-slate-350 bg-slate-900 rounded px-2.5 py-2 select-all truncate">
                  <Key className="h-3.5 w-3.5 text-slate-550 shrink-0" />
                  <span>{address}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-3xs text-slate-500">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Smart Contract Wallet Active</span>
                </div>
              </div>

              {/* Energy Flow metrics */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 space-y-3.5">
                <h4 className="eyebrow text-slate-500">Grid Performance</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Produced Energy</div>
                    <div className="text-sm font-bold text-production mt-0.5">
                      {producedEnergy.toFixed(1)} <span className="text-3xs font-normal text-slate-500">kWh</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Received Energy</div>
                    <div className="text-sm font-bold text-consumption mt-0.5">
                      {receivedEnergy.toFixed(1)} <span className="text-3xs font-normal text-slate-500">kWh</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-slate-800/60 pt-3">
                  <div className="flex justify-between items-center text-3xs text-slate-400">
                    <span>Current Output Status:</span>
                    <span className="font-semibold text-slate-200">{currentReading.toFixed(1)} kW</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Financial Grid Metrics & History */}
            <div className="space-y-5">
              {/* Financial Summary */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 space-y-3.5">
                <h4 className="eyebrow text-slate-500">Financial Ledger Summary</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-550 uppercase font-semibold flex items-center gap-1">
                      <ArrowUpRight className="h-3 w-3 text-emerald-450" /> Earned
                    </span>
                    <span className="text-base font-bold text-emerald-400 mt-1">
                      ₹{Math.round(moneyEarned)}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-550 uppercase font-semibold flex items-center gap-1">
                      <ArrowDownLeft className="h-3 w-3 text-rose-455" /> Spent
                    </span>
                    <span className="text-base font-bold text-rose-400 mt-1">
                      ₹{Math.round(moneySpent)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-800/60 pt-3 flex justify-between items-center text-3xs">
                  <span className="text-slate-400">Net Balance:</span>
                  <span className={`font-bold ${moneyEarned - moneySpent >= 0 ? 'text-emerald-450' : 'text-rose-455'}`}>
                    {moneyEarned - moneySpent >= 0 ? '+' : ''}₹{Math.round(moneyEarned - moneySpent)}
                  </span>
                </div>
              </div>

              {/* Recent Settlements */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
                <h4 className="eyebrow mb-2.5 text-slate-500">Recent Node Settlement History</h4>
                {nodeLedger.length === 0 ? (
                  <div className="text-3xs text-slate-600 py-3 text-center">
                    No trade settlements found for this node yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {nodeLedger.map((row) => {
                      const isSeller = row.sellerId === node.id
                      return (
                        <div key={row.tradeId} className="flex justify-between items-center text-3xs border-b border-slate-800/40 pb-1.5 last:border-0 last:pb-0">
                          <div>
                            <span className={`font-bold mr-1 ${isSeller ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {isSeller ? 'SOLD' : 'BOUGHT'}
                            </span>
                            <span className="text-slate-400">{row.units.toFixed(0)} kWh</span>
                          </div>
                          <span className="font-mono text-slate-500">{row.txHash.slice(0, 10)}...</span>
                          <span className={`font-semibold ${isSeller ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {isSeller ? '+' : '-'}₹{Math.round(row.priceUsd * row.units)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
