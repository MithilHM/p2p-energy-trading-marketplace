/**
 * The guided walkthrough, as data. Each stage spotlights one panel, shows a
 * dialog box, and may cue a backend action on entry. Pacing is manual
 * (presenter clicks Next / →); `ready()` lights a "live caught up" cue so the
 * presenter knows the real backend has produced the data the stage describes.
 */
import type { DemoEventState } from './events'
import type { CueName } from './transport'

export type SpotlightTarget = 'network' | 'market' | 'orderbook' | 'ledger' | null

export interface StageDef {
  id: string
  title: string
  body: string
  spotlight: SpotlightTarget
  /** control action fired once when the stage is entered */
  cue?: CueName
  /** true once live data backing this stage has arrived */
  ready: (s: DemoEventState) => boolean
}

export const STAGES: StageDef[] = [
  {
    id: 'bootstrap',
    title: 'A network of peers',
    body: '~180 independent peers across Bengaluru join the mesh — rooftop solar in Koramangala, homes in Jayanagar, factories in Whitefield. Each is an autonomous trading agent, not a utility customer.',
    spotlight: 'network',
    cue: 'run',
    ready: (s) => s.roster.length > 0,
  },
  {
    id: 'metering',
    title: 'Every peer is metered',
    body: 'Each peer streams a live smart-meter reading — how much it is generating or consuming, second by second. This raw telemetry is the input to the whole market.',
    spotlight: 'network',
    ready: (s) => s.counts.readings > 24,
  },
  {
    id: 'market',
    title: 'Supply meets demand',
    body: 'Aggregate every meter and a market emerges: total supply (emerald) against total demand (blue). Watch the deficit open as demand outruns generation.',
    spotlight: 'market',
    ready: (s) => s.marketSeries.length >= 4,
  },
  {
    id: 'pricing',
    title: 'Price discovers itself',
    body: 'Scarcity moves price. The clearing price (₹/kWh) is computed continuously from the supply/demand ratio — a pure market signal set by the network, not a DISCOM tariff.',
    spotlight: 'market',
    ready: (s) => s.priceSeries.length >= 3,
  },
  {
    id: 'matching',
    title: 'The engine pairs peers',
    body: 'The matching engine pairs a buyer with the cheapest available seller whenever the buyer’s limit clears the ask. Here is one clean match: a seller and a buyer locked in.',
    spotlight: 'orderbook',
    cue: 'spotlight',
    ready: (s) => s.spotlightTradeId !== null,
  },
  {
    id: 'transfer',
    title: 'Energy moves',
    body: 'With the trade matched, energy flows over the grid from the seller to the buyer — metered end to end. The highlighted packets trace that exact transfer.',
    spotlight: 'network',
    ready: (s) => s.transfers.some((t) => t.spotlight),
  },
  {
    id: 'escrow',
    title: 'A smart contract holds the money',
    body: 'Payment is escrowed on-chain: createTrade locks the buyer’s funds, confirm verifies delivery, release pays the seller. No bank, no clearing house — just the contract.',
    spotlight: 'ledger',
    cue: 'step',
    ready: (s) => {
      const id = s.spotlightTradeId
      return !!id && s.escrow[id]?.stage === 'released'
    },
  },
  {
    id: 'ledger',
    title: 'Settlement is automatic & final',
    body: 'The moment delivery is confirmed, the contract pays out and writes an immutable ledger entry. Every cleared trade across the network settles this way — hands-free.',
    spotlight: 'ledger',
    ready: (s) => s.ledgerCount > 0,
  },
]

export const STAGE_COUNT = STAGES.length
