import { motion, AnimatePresence } from 'framer-motion'
import { X, Blocks, ShieldCheck, Key, MapPin, Clock, ArrowRight, Layers } from 'lucide-react'
import type { LedgerRow, RosterNode } from '../../demo/events'
import { formatClock } from '../../lib/format'

interface Props {
  row: LedgerRow | null
  roster: RosterNode[]
  onClose: () => void
}

export function TransactionDetailsModal({ row, roster, onClose }: Props) {
  if (!row) return null

  const sellerNode = roster.find((n) => n.id === row.sellerId)
  const buyerNode = roster.find((n) => n.id === row.buyerId)

  // Derive unique cryptographic addresses and block info deterministically from txHash
  const cleanHash = row.txHash.replace('0x', '')
  const buyerAddress = `0x7099${cleanHash.slice(0, 16)}C51812dc3A01`
  const sellerAddress = `0xf39F${cleanHash.slice(16, 32)}F6F4ce6`
  const contractAddress = `0x5FbD${cleanHash.slice(32, 48)}0aa3`

  const blockNumber = 183000 + (parseInt(cleanHash.slice(0, 5), 16) % 4500)
  const gasPrice = 18 + (parseInt(cleanHash.slice(5, 7), 16) % 12)

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
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-forecast/10 text-forecast">
                <Blocks className="h-5 w-5 animate-pulse" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-50">Blockchain Transaction Details</h3>
                <p className="font-mono text-3xs text-slate-500">Block #{blockNumber} · Gas Price: {gasPrice} Gwei</p>
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
            {/* Left Column: Flow & Metadata */}
            <div className="space-y-5">
              {/* Energy Trade Details */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4">
                <h4 className="eyebrow mb-3 text-slate-500">P2P Settlement Information</h4>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-400">Total Cleared Value</span>
                    <span className="text-base font-bold text-production">₹{Math.round(row.priceUsd * row.units)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-400">Energy Quantity</span>
                    <span className="text-xs font-semibold text-slate-200">{row.units.toFixed(0)} kWh</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-400">Unit Rate</span>
                    <span className="text-xs font-semibold text-market">₹{row.priceUsd.toFixed(2)} / kWh</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-2xs text-slate-400">Cryptographic Payment</span>
                    <span className="text-xs font-semibold text-slate-200 font-mono">{row.amountEth.toFixed(6)} ETH</span>
                  </div>
                </div>
              </div>

              {/* Transaction Routing / Location */}
              <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 p-4 space-y-3">
                <h4 className="eyebrow text-slate-500">Source & Destination Metadata</h4>

                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Seller</div>
                    <div className="truncate text-xs font-semibold text-slate-200">{sellerNode?.name ?? row.sellerId}</div>
                    <div className="flex items-center gap-1 mt-0.5 text-3xs text-slate-400">
                      <MapPin className="h-3 w-3 text-production" />
                      <span>{sellerNode?.area ?? 'Bengaluru'}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-600 shrink-0" />
                  <div className="flex-1 min-w-0 text-right">
                    <div className="text-[10px] text-slate-500 uppercase font-semibold">Buyer</div>
                    <div className="truncate text-xs font-semibold text-slate-200">{buyerNode?.name ?? row.buyerId}</div>
                    <div className="flex items-center justify-end gap-1 mt-0.5 text-3xs text-slate-400">
                      <MapPin className="h-3 w-3 text-consumption" />
                      <span>{buyerNode?.area ?? 'Bengaluru'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Cryptographic validation & Smart Contract execution stack */}
            <div className="space-y-5">
              {/* Blockchain Metadata */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4 space-y-3">
                <h4 className="eyebrow text-slate-500">On-Chain Receipt</h4>
                
                <div className="space-y-2 font-mono text-3xs text-slate-400">
                  <div>
                    <span className="text-slate-500">TX HASH</span>
                    <div className="mt-1 rounded bg-slate-900 px-2 py-1 text-slate-350 select-all truncate">{row.txHash}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">ESCROW CONTRACT</span>
                    <div className="mt-1 rounded bg-slate-900 px-2 py-1 text-slate-350 select-all truncate">{contractAddress}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-slate-500">BUYER ADDR</span>
                      <div className="mt-1 rounded bg-slate-900 px-2 py-1 text-slate-350 select-all truncate">{buyerAddress}</div>
                    </div>
                    <div>
                      <span className="text-slate-500">SELLER ADDR</span>
                      <div className="mt-1 rounded bg-slate-900 px-2 py-1 text-slate-350 select-all truncate">{sellerAddress}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Execution Stack Animation */}
              <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="eyebrow mb-3 text-slate-500">Smart Contract Execution Stack</h4>
                
                <div className="relative pl-6 space-y-4">
                  {/* Vertical Line */}
                  <div className="absolute left-2.5 top-1.5 bottom-1.5 w-0.5 bg-slate-800" />

                  {/* Step 1 */}
                  <div className="relative">
                    <span className="absolute -left-5.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                      <Key className="h-2.5 w-2.5 text-slate-400" />
                    </span>
                    <div className="text-xs font-semibold text-slate-200">1. createTrade()</div>
                    <p className="text-[10px] text-slate-500">Escrowed {row.amountEth.toFixed(4)} ETH on behalf of buyer</p>
                  </div>

                  {/* Step 2 */}
                  <div className="relative">
                    <span className="absolute -left-5.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-slate-800 border border-slate-700">
                      <Layers className="h-2.5 w-2.5 text-slate-400" />
                    </span>
                    <div className="text-xs font-semibold text-slate-200">2. confirmTrade()</div>
                    <p className="text-[10px] text-slate-500">Meter output registers physical energy delivery</p>
                  </div>

                  {/* Step 3 */}
                  <div className="relative">
                    <span className="absolute -left-5.5 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500/40 animate-pulse">
                      <ShieldCheck className="h-2.5 w-2.5 text-emerald-400" />
                    </span>
                    <div className="text-xs font-semibold text-emerald-400">3. releasePayment()</div>
                    <p className="text-[10px] text-slate-500">Cleared funds to wallet · ledger logged</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Metadata */}
          <div className="mt-6 flex items-center justify-between border-t border-slate-800 pt-4 text-3xs text-slate-500">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>Timestamp: {formatClock(row.ts)} Local</span>
            </span>
            <span className="flex items-center gap-1 text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              <span>Receipt cryptographic proof generated</span>
            </span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
