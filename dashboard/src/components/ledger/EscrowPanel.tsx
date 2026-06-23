/**
 * Smart-contract escrow lifecycle for the spotlighted trade: createTrade →
 * confirmTrade → releasePayment, rendered as three animated steps. Driven
 * entirely by the latest `settlement` events for that trade id.
 */
import { motion, useReducedMotion } from 'framer-motion'
import { Check, FileLock2, Loader2 } from 'lucide-react'
import { ChartContainer } from '../primitives/ChartContainer'
import { color } from '../../theme/tokens'
import type { EscrowState, RosterNode } from '../../demo/events'

const STEPS = [
  { key: 'created', label: 'Created', detail: 'createTrade · funds escrowed' },
  { key: 'confirmed', label: 'Confirmed', detail: 'confirmTrade · delivery verified' },
  { key: 'released', label: 'Paid', detail: 'releasePayment · seller paid' },
] as const

const STAGE_RANK: Record<string, number> = { created: 1, confirmed: 2, released: 3, failed: 0 }

function nameOf(roster: RosterNode[], id?: string) {
  if (!id) return '—'
  return roster.find((n) => n.id === id)?.name ?? id
}

export function EscrowPanel({ escrow, roster }: { escrow: EscrowState | null; roster: RosterNode[] }) {
  const reduced = useReducedMotion() ?? false
  const rank = escrow ? STAGE_RANK[escrow.stage] ?? 0 : 0

  return (
    <ChartContainer title="Smart-Contract Escrow" icon={FileLock2} accent="text-forecast">
      {!escrow ? (
        <div className="flex h-[120px] items-center justify-center text-2xs text-slate-600">
          no trade in settlement yet
        </div>
      ) : (
        <div className="px-2 py-1">
          <div className="mb-3 flex items-center justify-between text-2xs">
            <span className="text-slate-400">
              <span className="text-production">{nameOf(roster, escrow.sellerId)}</span>
              <span className="text-slate-600"> → </span>
              <span className="text-consumption">{nameOf(roster, escrow.buyerId)}</span>
            </span>
            <span className="tabular text-market">{escrow.amountEth.toFixed(6)} ETH</span>
          </div>

          <div className="flex items-center">
            {STEPS.map((step, i) => {
              const done = rank > i + 1
              const active = rank === i + 1
              const c = done ? color.production : active ? color.market : color.border600
              return (
                <div key={step.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center text-center">
                    <span
                      className="relative flex h-8 w-8 items-center justify-center rounded-full border"
                      style={{ borderColor: c, background: `${c}1a` }}
                    >
                      {done ? (
                        <Check className="h-4 w-4" style={{ color: c }} strokeWidth={2.5} />
                      ) : active ? (
                        <Loader2
                          className={`h-4 w-4 ${reduced ? '' : 'animate-spin'}`}
                          style={{ color: c }}
                          strokeWidth={2.5}
                        />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                      )}
                    </span>
                    <span
                      className="mt-1.5 text-[10px] font-semibold"
                      style={{ color: done || active ? color.text300 : color.text500 }}
                    >
                      {step.label}
                    </span>
                    <span className="mt-0.5 max-w-[88px] text-[9px] leading-tight text-slate-600">
                      {step.detail}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className="mx-1 mb-7 h-0.5 flex-1 overflow-hidden rounded bg-slate-800">
                      <motion.div
                        className="h-full"
                        style={{ background: color.production }}
                        initial={false}
                        animate={{ width: rank > i + 1 ? '100%' : '0%' }}
                        transition={reduced ? { duration: 0 } : { duration: 0.5 }}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-3 truncate border-t border-slate-700/40 pt-2 text-[10px] text-slate-600">
            tx <span className="tabular text-slate-400">{escrow.txHash}</span>
          </div>
        </div>
      )}
    </ChartContainer>
  )
}
