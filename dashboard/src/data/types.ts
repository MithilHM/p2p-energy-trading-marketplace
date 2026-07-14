/** Domain model for the energy exchange. */

export type Trend = 'up' | 'down' | 'flat'

export interface KPIDatum {
  id: string
  label: string
  value: number
  unit: string
  /** display format hint */
  format: 'currency' | 'number' | 'percent' | 'compact'
  decimals: number
  deltaPct: number
  trend: Trend
  /** semantic accent token key */
  accent: 'production' | 'consumption' | 'market' | 'forecast' | 'alert' | 'neutral'
  sparkline: number[]
  caption: string
}

export interface SupplyDemandPoint {
  t: string // HH:mm
  supply: number
  demand: number
  cleared: number
}

export interface GenerationMixPoint {
  t: string
  Solar: number
  Wind: number
  Hydro: number
  Battery: number
  Biomass: number
}

export interface GridLoadPoint {
  t: string
  baseload: number
  peaking: number
  capacity: number
}

export type OrderSide = 'buy' | 'sell' | 'match' | 'settle'

export interface TradeEvent {
  id: string
  side: OrderSide
  party: string
  counterparty?: string
  qtyKwh: number
  price: number // $/MWh
  ts: number // epoch ms
  status: 'open' | 'filled' | 'settled'
}

export interface VolumePoint {
  t: string
  volume: number // MWh
  liquidity: number // depth index 0-100
  trades: number
}

export interface Producer {
  id: string
  name: string
  type: 'Solar' | 'Wind' | 'Hydro' | 'Battery' | 'Biomass'
  capacityMw: number
  outputMw: number
  reliability: number // %
  trend: Trend
}

export interface Consumer {
  id: string
  name: string
  segment: 'Industrial' | 'Commercial' | 'Municipal' | 'Data Center'
  usageMwh: number
  demandTrend: number // pct change
  efficiency: number // score 0-100
}

export interface MarketInsight {
  id: string
  kind: 'peak' | 'volatility' | 'renewable' | 'imbalance'
  title: string
  detail: string
  value: string
  severity: 'info' | 'warn' | 'critical'
}

export interface ForecastPoint {
  t: string
  actual: number | null
  forecast: number
  lower: number
  upper: number
}

export interface PriceForecastPoint {
  t: string
  price: number | null
  predicted: number
  band: number // half-width for area
}

export interface HistoricalPoint {
  label: string
  price: number
  demand: number
  production: number
}

export type HealthStatus = 'operational' | 'degraded' | 'down'

export interface HealthNode {
  id: string
  label: string
  status: HealthStatus
  metric: string
  value: number
  unit: string
  /** recent samples for the inline trace */
  trace: number[]
}

// ---- Energy flow graph ----
export type FlowNodeKind =
  | 'solar'
  | 'wind'
  | 'battery'
  | 'market'
  | 'industrial'
  | 'commercial'

export interface FlowNode {
  id: string
  kind: FlowNodeKind
  label: string
  sub: string
  /** normalized 0-1 position within the SVG viewport */
  x: number
  y: number
  /** throughput in MW — drives node sizing */
  load: number
  side: 'producer' | 'hub' | 'consumer'
}

export interface FlowLink {
  id: string
  from: string
  to: string
  /** MW flowing — drives stroke + particle density */
  flow: number
}
