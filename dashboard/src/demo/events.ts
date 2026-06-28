/**
 * Event protocol for the guided simulator.
 *
 * Both the live `demo-orchestrator` WebSocket and the offline deterministic
 * replay emit this exact same `DemoEvent` stream, so the rest of the app never
 * needs to know which source is driving it. `eventReducer` folds the stream
 * into `DemoEventState`, the single snapshot the UI renders from.
 */
import type { Trend, TradeEvent } from '../data/types'

export type RosterNodeKind =
  | 'solar'
  | 'wind'
  | 'battery'
  | 'home'
  | 'industrial'
  | 'commercial'
  | 'prosumer'

export type NodeSide = 'producer' | 'consumer' | 'hub'

export interface RosterNode {
  id: string
  name: string
  kind: RosterNodeKind
  side: NodeSide
  /** normalized 0-1 grid position (fallback layout when no map) */
  x: number
  y: number
  /** geographic position (Bengaluru) for the geospatial map */
  lng?: number
  lat?: number
  /** locality label, e.g. "Koramangala" */
  area?: string
  capacityKw: number
}

export type MarketSource = 'orchestrator' | 'spark'
export type EscrowStage = 'created' | 'confirmed' | 'released' | 'failed'

export type DemoEvent =
  | { type: 'roster'; ts: number; nodes: RosterNode[] }
  | { type: 'reading'; ts: number; nodeId: string; role: 'producer' | 'consumer'; energy: number }
  | { type: 'market'; ts: number; supply: number; demand: number; source: MarketSource }
  | { type: 'price'; ts: number; price: number; deltaPct: number; trend: Trend; source: MarketSource }
  | { type: 'order'; ts: number; side: 'buy' | 'sell'; nodeId: string; units: number; price: number }
  | {
      type: 'match'
      ts: number
      tradeId: string
      sellerId: string
      buyerId: string
      units: number
      price: number
      spotlight?: boolean
    }
  | {
      type: 'transfer'
      ts: number
      tradeId: string
      fromId: string
      toId: string
      units: number
      durationMs: number
      spotlight?: boolean
    }
  | {
      type: 'settlement'
      ts: number
      tradeId: string
      stage: EscrowStage
      txHash: string
      amountEth: number
      sellerId: string
      buyerId: string
      spotlight?: boolean
    }
  | {
      type: 'ledger'
      ts: number
      tradeId: string
      txHash: string
      sellerId: string
      buyerId: string
      units: number
      amountEth: number
      priceUsd: number
      spotlight?: boolean
    }
  | {
      type: 'gridcompare'
      ts: number
      energyTradedKwh: number
      gridLossAvoidedKwh: number
      consumerSavings: number
      producerEarnings: number
      communityBenefit: number
      gridImportCost: number
      savingsPct: number
      retailTariff: number
      feedInTariff: number
    }

// ---- Accumulated snapshot the UI reads ----

export interface MarketPoint {
  t: string // HH:mm:ss
  supply: number
  demand: number
}

export interface EscrowState {
  tradeId: string
  sellerId: string
  buyerId: string
  amountEth: number
  txHash: string
  stage: EscrowStage
  updatedAt: number
}

export interface LedgerRow {
  tradeId: string
  txHash: string
  sellerId: string
  buyerId: string
  units: number
  amountEth: number
  priceUsd: number
  ts: number
}

export interface ActiveTransfer {
  tradeId: string
  fromId: string
  toId: string
  units: number
  startedAt: number
  durationMs: number
  spotlight: boolean
}

/** Running P2P-vs-central-grid comparison (always favourable to P2P). */
export interface GridComparison {
  energyTradedKwh: number
  gridLossAvoidedKwh: number
  consumerSavings: number
  producerEarnings: number
  communityBenefit: number
  gridImportCost: number
  savingsPct: number
  retailTariff: number
  feedInTariff: number
}

export interface DemoEventState {
  roster: RosterNode[]
  /** latest reading per node id */
  readings: Record<string, { energy: number; role: string; ts: number }>
  supply: number
  demand: number
  marketSeries: MarketPoint[]
  marketSource: MarketSource | null
  price: number
  priceDeltaPct: number
  priceTrend: Trend
  priceSeries: number[]
  /** order + match + settle tape, reusing the ActivityFeed shape */
  feed: TradeEvent[]
  /** transfers consumed by the network canvas (capped recent window) */
  transfers: ActiveTransfer[]
  escrow: Record<string, EscrowState>
  spotlightTradeId: string | null
  ledger: LedgerRow[]
  ledgerTotalEth: number
  ledgerCount: number
  grid: GridComparison
  lastEventAt: number
  counts: { readings: number; matches: number; transfers: number; settlements: number }
}

export function emptyState(): DemoEventState {
  return {
    roster: [],
    readings: {},
    supply: 0,
    demand: 0,
    marketSeries: [],
    marketSource: null,
    price: 0,
    priceDeltaPct: 0,
    priceTrend: 'flat',
    priceSeries: [],
    feed: [],
    transfers: [],
    escrow: {},
    spotlightTradeId: null,
    ledger: [],
    ledgerTotalEth: 0,
    ledgerCount: 0,
    grid: {
      energyTradedKwh: 0,
      gridLossAvoidedKwh: 0,
      consumerSavings: 0,
      producerEarnings: 0,
      communityBenefit: 0,
      gridImportCost: 0,
      savingsPct: 0,
      retailTariff: 22,
      feedInTariff: 3,
    },
    lastEventAt: 0,
    counts: { readings: 0, matches: 0, transfers: 0, settlements: 0 },
  }
}
