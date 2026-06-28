/**
 * Deterministic offline replay. Produces the exact same `DemoEvent` stream the
 * live `demo-orchestrator` would, seeded so every presentation is identical.
 * Used as the fallback when the orchestrator (:8010) is unreachable, so the
 * guided walkthrough always works — even on a laptop with nothing running.
 *
 * Reuses the seeded PRNG + diurnal curves from `data/generators`.
 */
import { makeRng } from '../data/generators'
import { makeBengaluruRoster } from './bengaluru'
import type { CueName } from './transport'
import type { DemoEvent } from './events'

// Central-grid baseline tariffs — kept in sync with the orchestrator's config so
// the offline replay reports the same P2P-vs-grid advantage. Both sit outside
// the clearing band [5, 20], so P2P always wins.
const RETAIL_TARIFF = 22
const FEEDIN_TARIFF = 3
const GRID_LOSS = 0.07

function solarLevel(hour: number) {
  const x = (hour - 13) / 5
  return Math.max(0, Math.exp(-x * x))
}
function demandLevel(hour: number) {
  const morning = Math.exp(-Math.pow((hour - 8) / 2.4, 2))
  const evening = Math.exp(-Math.pow((hour - 19) / 2.8, 2))
  return 0.45 + 0.4 * morning + 0.55 * evening
}

interface ReplayOpts {
  seed?: number
  emit: (e: DemoEvent) => void
  now: () => number
}

/**
 * Creates an offline replay transport. `cue()` mirrors the orchestrator's
 * /demo control surface; events are produced locally on timers.
 */
export function createReplay({ seed = 42, emit, now }: ReplayOpts) {
  const roster = makeBengaluruRoster(seed)
  const producers = roster.filter((n) => n.side === 'producer')
  const consumers = roster.filter((n) => n.side === 'consumer')
  const rng = makeRng(seed ^ 0x9e3779b9)

  let timers: ReturnType<typeof setInterval>[] = []
  let timeouts: ReturnType<typeof setTimeout>[] = []
  let tick = 0
  let tradeSeq = 0
  let lastPrice = 10
  let paused = false
  let started = false

  // P2P-vs-grid running totals
  let gridEnergy = 0
  let gridImportCost = 0
  let gridSavings = 0
  let gridEarnings = 0

  function emitGridCompare(units: number, price: number) {
    const value = units * price
    gridEnergy += units
    gridImportCost += units * RETAIL_TARIFF
    gridSavings += units * RETAIL_TARIFF - value
    gridEarnings += value - units * FEEDIN_TARIFF
    emit({
      type: 'gridcompare',
      ts: now(),
      energyTradedKwh: Math.round(gridEnergy * 100) / 100,
      gridLossAvoidedKwh: Math.round(gridEnergy * GRID_LOSS * 100) / 100,
      consumerSavings: Math.round(gridSavings * 100) / 100,
      producerEarnings: Math.round(gridEarnings * 100) / 100,
      communityBenefit: Math.round((gridSavings + gridEarnings) * 100) / 100,
      gridImportCost: Math.round(gridImportCost * 100) / 100,
      savingsPct: gridImportCost ? Math.round((gridSavings / gridImportCost) * 1000) / 10 : 0,
      retailTariff: RETAIL_TARIFF,
      feedInTariff: FEEDIN_TARIFF,
    })
  }

  const after = (ms: number, fn: () => void) => {
    timeouts.push(setTimeout(fn, ms))
  }

  function clearAll() {
    timers.forEach(clearInterval)
    timeouts.forEach(clearTimeout)
    timers = []
    timeouts = []
  }

  function simHour() {
    // ~40s per simulated day keeps supply/demand visibly moving
    return (tick * 0.6) % 24
  }

  function currentSupplyDemand() {
    const hour = simHour()
    const supply = producers.reduce(
      (s, p) => s + (p.kind === 'solar' ? p.capacityKw * solarLevel(hour) : p.capacityKw * (0.4 + 0.3 * rng())),
      0
    )
    const demand = consumers.reduce((s, c) => s + c.capacityKw * demandLevel(hour) * (0.6 + 0.4 * rng()), 0)
    return { supply: Math.round(supply), demand: Math.round(demand) }
  }

  function emitMarketAndPrice() {
    const { supply, demand } = currentSupplyDemand()
    emit({ type: 'market', ts: now(), supply, demand, source: 'orchestrator' })
    const raw = supply > 0 ? 10 * (demand / supply) : 20
    const price = Math.max(5, Math.min(20, raw))
    const deltaPct = lastPrice > 0 ? Math.round(((price - lastPrice) / lastPrice) * 1000) / 10 : 0
    lastPrice = price
    emit({
      type: 'price',
      ts: now(),
      price: Math.round(price * 100) / 100,
      deltaPct,
      trend: deltaPct > 0.2 ? 'up' : deltaPct < -0.2 ? 'down' : 'flat',
      source: 'orchestrator',
    })
  }

  function emitReadings() {
    const hour = simHour()
    // a sample of nodes per tick (keeps the feed of meter pings lively, not 180/frame)
    const sample = 18
    for (let i = 0; i < sample; i++) {
      const p = producers[Math.floor(rng() * producers.length)]
      const c = consumers[Math.floor(rng() * consumers.length)]
      emit({
        type: 'reading',
        ts: now(),
        nodeId: p.id,
        role: 'producer',
        energy: Math.round(p.capacityKw * (p.kind === 'solar' ? solarLevel(hour) : 0.5) * 100) / 100,
      })
      emit({
        type: 'reading',
        ts: now(),
        nodeId: c.id,
        role: 'consumer',
        energy: Math.round(c.capacityKw * demandLevel(hour) * 100) / 100,
      })
    }
  }

  function makeTradeId() {
    return `T${String(tradeSeq++).padStart(6, '0')}`
  }

  /** A full ambient trade lifecycle: orders -> match -> transfer -> settle -> ledger. */
  function ambientTrade() {
    const seller = producers[Math.floor(rng() * producers.length)]
    const buyer = consumers[Math.floor(rng() * consumers.length)]
    const units = Math.round(5 + rng() * 40)
    const price = Math.round(lastPrice * (0.95 + rng() * 0.1) * 100) / 100
    const tradeId = makeTradeId()
    emit({ type: 'order', ts: now(), side: 'sell', nodeId: seller.id, units, price })
    after(200, () => emit({ type: 'order', ts: now(), side: 'buy', nodeId: buyer.id, units, price: price * 1.05 }))
    after(420, () =>
      emit({ type: 'match', ts: now(), tradeId, sellerId: seller.id, buyerId: buyer.id, units, price })
    )
    after(520, () =>
      emit({
        type: 'transfer',
        ts: now(),
        tradeId,
        fromId: seller.id,
        toId: buyer.id,
        units,
        durationMs: 2600,
      })
    )
    settleSequence(tradeId, seller.id, buyer.id, units, price, false, 900)
  }

  function settleSequence(
    tradeId: string,
    sellerId: string,
    buyerId: string,
    units: number,
    priceUsd: number,
    spotlight: boolean,
    startDelay: number
  ) {
    const amountEth = Math.round(units * priceUsd * 1e-6 * 1e8) / 1e8 || 0.0001
    const txHash = '0x' + Math.floor(rng() * 0xffffffffffff).toString(16).padStart(12, '0')
    after(startDelay, () =>
      emit({ type: 'settlement', ts: now(), tradeId, stage: 'created', txHash, amountEth, sellerId, buyerId, spotlight })
    )
    after(startDelay + 700, () =>
      emit({ type: 'settlement', ts: now(), tradeId, stage: 'confirmed', txHash, amountEth, sellerId, buyerId, spotlight })
    )
    after(startDelay + 1500, () => {
      emit({ type: 'settlement', ts: now(), tradeId, stage: 'released', txHash, amountEth, sellerId, buyerId, spotlight })
      emit({
        type: 'ledger',
        ts: now(),
        tradeId,
        txHash,
        sellerId,
        buyerId,
        units,
        amountEth,
        priceUsd,
        spotlight,
      })
      emitGridCompare(units, priceUsd)
    })
  }

  // ---- spotlight: a clean, narratable demonstrative trade ----
  let spotlightPair: { sellerId: string; buyerId: string; tradeId: string; units: number; price: number } | null = null

  function spotlight() {
    // deterministic, well-separated pair (a left producer, a right consumer)
    const seller = producers[Math.floor(producers.length * 0.2)]
    const buyer = consumers[Math.floor(consumers.length * 0.7)]
    const units = 32
    const price = Math.round(lastPrice * 100) / 100 || 10
    const tradeId = makeTradeId()
    spotlightPair = { sellerId: seller.id, buyerId: buyer.id, tradeId, units, price }

    emit({ type: 'order', ts: now(), side: 'sell', nodeId: seller.id, units, price })
    after(250, () => emit({ type: 'order', ts: now(), side: 'buy', nodeId: buyer.id, units, price: price * 1.08 }))
    after(500, () =>
      emit({ type: 'match', ts: now(), tradeId, sellerId: seller.id, buyerId: buyer.id, units, price, spotlight: true })
    )
    after(650, () =>
      emit({
        type: 'transfer',
        ts: now(),
        tradeId,
        fromId: seller.id,
        toId: buyer.id,
        units,
        durationMs: 3200,
        spotlight: true,
      })
    )
    // escrow 'created' immediately so stage 7 can advance it on `step`
    const amountEth = Math.round(units * price * 1e-6 * 1e8) / 1e8 || 0.0001
    const txHash = '0x' + Math.floor(rng() * 0xffffffffffff).toString(16).padStart(12, '0')
    after(900, () =>
      emit({
        type: 'settlement',
        ts: now(),
        tradeId,
        stage: 'created',
        txHash,
        amountEth,
        sellerId: seller.id,
        buyerId: buyer.id,
        spotlight: true,
      })
    )
  }

  /** Advance the spotlight escrow: confirmed -> released -> ledger. */
  function stepEscrow() {
    if (!spotlightPair) {
      spotlight()
      after(1100, stepEscrow)
      return
    }
    const { tradeId, sellerId, buyerId, units, price } = spotlightPair
    const amountEth = Math.round(units * price * 1e-6 * 1e8) / 1e8 || 0.0001
    const txHash = '0x' + Math.floor(rng() * 0xffffffffffff).toString(16).padStart(12, '0')
    after(150, () =>
      emit({ type: 'settlement', ts: now(), tradeId, stage: 'confirmed', txHash, amountEth, sellerId, buyerId, spotlight: true })
    )
    after(1100, () => {
      emit({ type: 'settlement', ts: now(), tradeId, stage: 'released', txHash, amountEth, sellerId, buyerId, spotlight: true })
      emit({
        type: 'ledger',
        ts: now(),
        tradeId,
        txHash,
        sellerId,
        buyerId,
        units,
        amountEth,
        priceUsd: price,
        spotlight: true,
      })
      emitGridCompare(units, price)
    })
  }

  function run() {
    if (started) return
    started = true
    emit({ type: 'roster', ts: now(), nodes: roster })
    emitReadings()
    emitMarketAndPrice()
    // ambient streams
    timers.push(
      setInterval(() => {
        if (paused) return
        tick++
        emitReadings()
      }, 900)
    )
    timers.push(
      setInterval(() => {
        if (paused) return
        emitMarketAndPrice()
      }, 1400)
    )
    timers.push(
      setInterval(() => {
        if (paused) return
        ambientTrade()
      }, 2600)
    )
    // a couple of immediate ambient trades so the ledger isn't empty
    after(1200, ambientTrade)
    after(2000, ambientTrade)
  }

  function reset() {
    clearAll()
    started = false
    tick = 0
    spotlightPair = null
    gridEnergy = 0
    gridImportCost = 0
    gridSavings = 0
    gridEarnings = 0
  }

  function cue(name: CueName) {
    switch (name) {
      case 'run':
        run()
        break
      case 'spotlight':
        spotlight()
        break
      case 'step':
        stepEscrow()
        break
      case 'pause':
        paused = true
        break
      case 'resume':
        paused = false
        break
      case 'reset':
        reset()
        break
    }
  }

  return {
    source: 'replay' as const,
    cue,
    close: clearAll,
  }
}
