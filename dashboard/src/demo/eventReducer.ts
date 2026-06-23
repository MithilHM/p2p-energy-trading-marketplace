/**
 * Folds the `DemoEvent` stream into `DemoEventState`. Pure and source-agnostic:
 * identical whether events come from the live orchestrator WS or the offline
 * replay. Keeps bounded windows so long-running demos stay light.
 */
import { formatClock } from '../lib/format'
import type { DemoEvent, DemoEventState, RosterNode } from './events'
import { emptyState } from './events'
import type { TradeEvent } from '../data/types'

const FEED_MAX = 16
const MARKET_MAX = 48
const PRICE_SPARK_MAX = 32
const TRANSFER_MAX = 64
const LEDGER_MAX = 40

function nameOf(roster: RosterNode[], id: string): string {
  return roster.find((n) => n.id === id)?.name ?? id
}

function pushFeed(feed: TradeEvent[], row: TradeEvent): TradeEvent[] {
  return [row, ...feed].slice(0, FEED_MAX)
}

export function reduceEvent(state: DemoEventState, e: DemoEvent): DemoEventState {
  const ts = e.ts || state.lastEventAt
  const base = { ...state, lastEventAt: Math.max(state.lastEventAt, ts) }

  switch (e.type) {
    case 'roster':
      return { ...base, roster: e.nodes }

    case 'reading':
      return {
        ...base,
        readings: { ...base.readings, [e.nodeId]: { energy: e.energy, role: e.role, ts } },
        counts: { ...base.counts, readings: base.counts.readings + 1 },
      }

    case 'market': {
      const point = { t: formatClock(ts), supply: Math.round(e.supply), demand: Math.round(e.demand) }
      return {
        ...base,
        supply: e.supply,
        demand: e.demand,
        marketSource: e.source,
        marketSeries: [...base.marketSeries, point].slice(-MARKET_MAX),
      }
    }

    case 'price':
      return {
        ...base,
        price: e.price,
        priceDeltaPct: e.deltaPct,
        priceTrend: e.trend,
        priceSeries: [...base.priceSeries, Math.round(e.price * 100) / 100].slice(-PRICE_SPARK_MAX),
      }

    case 'order': {
      const row: TradeEvent = {
        id: `${e.side}-${e.nodeId}-${ts}`,
        side: e.side,
        party: nameOf(base.roster, e.nodeId),
        qtyKwh: e.units,
        price: e.price,
        ts,
        status: 'open',
      }
      return { ...base, feed: pushFeed(base.feed, row) }
    }

    case 'match': {
      const row: TradeEvent = {
        id: `match-${e.tradeId}`,
        side: 'match',
        party: nameOf(base.roster, e.sellerId),
        counterparty: nameOf(base.roster, e.buyerId),
        qtyKwh: e.units,
        price: e.price,
        ts,
        status: 'filled',
      }
      return {
        ...base,
        feed: pushFeed(base.feed, row),
        spotlightTradeId: e.spotlight ? e.tradeId : base.spotlightTradeId,
        counts: { ...base.counts, matches: base.counts.matches + 1 },
      }
    }

    case 'transfer': {
      const t = {
        tradeId: e.tradeId,
        fromId: e.fromId,
        toId: e.toId,
        units: e.units,
        startedAt: ts,
        durationMs: e.durationMs,
        spotlight: Boolean(e.spotlight),
      }
      return {
        ...base,
        transfers: [...base.transfers, t].slice(-TRANSFER_MAX),
        spotlightTradeId: e.spotlight ? e.tradeId : base.spotlightTradeId,
        counts: { ...base.counts, transfers: base.counts.transfers + 1 },
      }
    }

    case 'settlement': {
      const escrow = {
        ...base.escrow,
        [e.tradeId]: {
          tradeId: e.tradeId,
          sellerId: e.sellerId,
          buyerId: e.buyerId,
          amountEth: e.amountEth,
          txHash: e.txHash,
          stage: e.stage,
          updatedAt: ts,
        },
      }
      // Settlements surface in the ledger + escrow panel, not the order tape
      // (the tape formats price as $, settlements carry ETH amounts).
      return {
        ...base,
        escrow,
        spotlightTradeId: e.spotlight ? e.tradeId : base.spotlightTradeId,
        counts: {
          ...base.counts,
          settlements: e.stage === 'released' ? base.counts.settlements + 1 : base.counts.settlements,
        },
      }
    }

    case 'ledger': {
      if (base.ledger.some((r) => r.tradeId === e.tradeId)) return base
      const row = {
        tradeId: e.tradeId,
        txHash: e.txHash,
        sellerId: e.sellerId,
        buyerId: e.buyerId,
        units: e.units,
        amountEth: e.amountEth,
        priceUsd: e.priceUsd,
        ts,
      }
      return {
        ...base,
        ledger: [row, ...base.ledger].slice(0, LEDGER_MAX),
        ledgerTotalEth: Math.round((base.ledgerTotalEth + e.amountEth) * 1e6) / 1e6,
        ledgerCount: base.ledgerCount + 1,
      }
    }

    default:
      return base
  }
}

export { emptyState }
