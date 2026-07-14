import type {
  ForecastPoint,
  GenerationMixPoint,
  GridLoadPoint,
  HistoricalPoint,
  PriceForecastPoint,
  SupplyDemandPoint,
  TradeEvent,
  VolumePoint,
} from './types'

/**
 * Seeded mulberry32 PRNG. Base datasets are generated deterministically so the
 * dashboard renders identically across reloads and SSR — live ticks layer
 * runtime randomness on top of this stable foundation.
 */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const HOURS = Array.from({ length: 24 }, (_, i) => `${String(i).padStart(2, '0')}:00`)

/** Smooth diurnal solar curve peaking around 13:00. */
function solarShape(hour: number) {
  const x = (hour - 13) / 5
  return Math.max(0, Math.exp(-x * x))
}

/** Demand: morning + evening peaks (camel curve). */
function demandShape(hour: number) {
  const morning = Math.exp(-Math.pow((hour - 8) / 2.4, 2))
  const evening = Math.exp(-Math.pow((hour - 19) / 2.8, 2))
  return 0.45 + 0.4 * morning + 0.55 * evening
}

export function buildSupplyDemand(seed = 7): SupplyDemandPoint[] {
  const rng = makeRng(seed)
  return HOURS.map((t, h) => {
    const wind = 0.5 + 0.35 * Math.sin(h / 3.5 + 1) + (rng() - 0.5) * 0.15
    const supplyBase = 820 + 540 * solarShape(h) + 360 * Math.max(0, wind)
    const demandBase = 1180 * demandShape(h)
    const supply = supplyBase + (rng() - 0.5) * 60
    const demand = demandBase + (rng() - 0.5) * 70
    return {
      t,
      supply: Math.round(supply),
      demand: Math.round(demand),
      cleared: Math.round(Math.min(supply, demand) - rng() * 40),
    }
  })
}

export function buildGenerationMix(seed = 11): GenerationMixPoint[] {
  const rng = makeRng(seed)
  return HOURS.map((t, h) => ({
    t,
    Solar: Math.round(540 * solarShape(h) + rng() * 20),
    Wind: Math.round(220 + 180 * Math.abs(Math.sin(h / 3.5 + 1)) + rng() * 40),
    Hydro: Math.round(160 + 40 * Math.sin(h / 6) + rng() * 15),
    Battery: Math.round(Math.max(0, 90 * Math.sin((h - 17) / 3)) + rng() * 12),
    Biomass: Math.round(70 + rng() * 18),
  }))
}

export function buildGridLoad(seed = 17): GridLoadPoint[] {
  const rng = makeRng(seed)
  return HOURS.map((t, h) => {
    const load = 1180 * demandShape(h)
    const baseload = Math.min(load, 760 + rng() * 30)
    return {
      t,
      baseload: Math.round(baseload),
      peaking: Math.round(Math.max(0, load - baseload)),
      capacity: 1680,
    }
  })
}

export function buildVolume(seed = 23): VolumePoint[] {
  const rng = makeRng(seed)
  return HOURS.map((t, h) => {
    const activity = demandShape(h) * (0.7 + solarShape(h) * 0.5)
    return {
      t,
      volume: Math.round(180 * activity + rng() * 40),
      liquidity: Math.round(48 + 40 * activity + rng() * 8),
      trades: Math.round(60 * activity + rng() * 18),
    }
  })
}

const PARTIES = [
  'Meridian Solar Co-op',
  'Northwind Power AG',
  'Cascade Hydro Trust',
  'Aurora Battery Systems',
  'Helios Microgrid',
  'TerraVolt Industrial',
  'Beacon Data Centers',
  'Civic Grid Authority',
  'Summit Manufacturing',
  'Harbor Logistics Park',
  'Greenfield Biomass',
  'Vertex Commercial REIT',
]

const SIDES: TradeEvent['side'][] = ['buy', 'sell', 'match', 'settle']

let tradeSeq = 1000

/** Single live trade event. Uses runtime randomness (browser only). */
export function makeTrade(now: number): TradeEvent {
  const side = SIDES[Math.floor(Math.random() * SIDES.length)]
  const party = PARTIES[Math.floor(Math.random() * PARTIES.length)]
  let counterparty: string | undefined
  if (side === 'match' || side === 'settle') {
    do {
      counterparty = PARTIES[Math.floor(Math.random() * PARTIES.length)]
    } while (counterparty === party)
  }
  return {
    id: `TX-${(tradeSeq++).toString(36).toUpperCase()}`,
    side,
    party,
    counterparty,
    qtyKwh: Math.round((20 + Math.random() * 480) * 10) / 10,
    price: Math.round((58 + Math.random() * 46) * 100) / 100,
    ts: now,
    status: side === 'settle' ? 'settled' : side === 'match' ? 'filled' : 'open',
  }
}

/** Seed the initial activity feed with a deterministic-ish backlog. */
export function buildInitialTrades(count: number, now: number): TradeEvent[] {
  return Array.from({ length: count }, (_, i) => makeTrade(now - (count - i) * 2400))
}

export function buildDemandForecast(seed = 31): ForecastPoint[] {
  const rng = makeRng(seed)
  // 12 historical + 12 forecast hours, on a relative axis.
  const pts: ForecastPoint[] = []
  for (let i = -11; i <= 12; i++) {
    const hour = (24 + ((6 + i) % 24)) % 24
    const base = 1180 * demandShape(hour)
    const noise = (rng() - 0.5) * 50
    const isFuture = i > 0
    const spread = isFuture ? 30 + i * 9 : 0
    const forecast = base + noise * 0.4
    pts.push({
      t: i <= 0 ? `${i === 0 ? 'now' : i + 'h'}` : `+${i}h`,
      actual: isFuture ? null : Math.round(base + noise),
      forecast: Math.round(forecast),
      lower: Math.round(forecast - spread),
      upper: Math.round(forecast + spread),
    })
  }
  return pts
}

export function buildPriceForecast(seed = 41): PriceForecastPoint[] {
  const rng = makeRng(seed)
  const pts: PriceForecastPoint[] = []
  let price = 72
  for (let i = -10; i <= 10; i++) {
    price += (rng() - 0.48) * 4
    const isFuture = i > 0
    const band = isFuture ? 2 + i * 0.9 : 0
    pts.push({
      t: i <= 0 ? (i === 0 ? 'now' : `${i}h`) : `+${i}h`,
      price: isFuture ? null : Math.round(price * 100) / 100,
      predicted: Math.round((price + (isFuture ? i * 0.35 : 0)) * 100) / 100,
      band,
    })
  }
  return pts
}

export function buildHistorical(seed = 53): HistoricalPoint[] {
  const rng = makeRng(seed)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return months.map((label, i) => {
    // seasonal: higher demand winter & summer, production peaks summer.
    const seasonalDemand = 1 + 0.22 * Math.cos((i / 12) * Math.PI * 2)
    const seasonalSolar = 1 + 0.35 * Math.sin(((i - 2) / 12) * Math.PI * 2)
    return {
      label,
      price: Math.round((64 + 22 * seasonalDemand + (rng() - 0.5) * 8) * 10) / 10,
      demand: Math.round(720 * seasonalDemand + rng() * 40),
      production: Math.round(640 * seasonalSolar + rng() * 50),
    }
  })
}

/** sparkline helper — n points trending toward a delta sign. */
export function spark(seed: number, n = 16, trendUp = true): number[] {
  const rng = makeRng(seed)
  let v = 50
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    v += (rng() - (trendUp ? 0.42 : 0.58)) * 9
    out.push(Math.round(v * 10) / 10)
  }
  return out
}
