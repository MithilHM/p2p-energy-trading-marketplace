import type {
  Consumer,
  FlowLink,
  FlowNode,
  HealthNode,
  KPIDatum,
  MarketInsight,
  Producer,
} from './types'
import {
  buildDemandForecast,
  buildGenerationMix,
  buildGridLoad,
  buildHistorical,
  buildPriceForecast,
  buildSupplyDemand,
  buildVolume,
  spark,
} from './generators'

// ---- Top KPI bar ----
export const kpis: KPIDatum[] = [
  {
    id: 'price',
    label: 'Clearing Price',
    value: 72.48,
    unit: '₹/MWh',
    format: 'currency',
    decimals: 2,
    deltaPct: 3.2,
    trend: 'up',
    accent: 'market',
    sparkline: spark(101, 18, true),
    caption: 'Day-ahead spot',
  },
  {
    id: 'trades',
    label: 'Active Trades',
    value: 1284,
    unit: 'open',
    format: 'number',
    decimals: 0,
    deltaPct: 5.7,
    trend: 'up',
    accent: 'market',
    sparkline: spark(102, 18, true),
    caption: 'Order book depth',
  },
  {
    id: 'supply',
    label: 'Total Supply',
    value: 1638,
    unit: 'MW',
    format: 'number',
    decimals: 0,
    deltaPct: 2.1,
    trend: 'up',
    accent: 'production',
    sparkline: spark(103, 18, true),
    caption: 'Dispatched generation',
  },
  {
    id: 'demand',
    label: 'Total Demand',
    value: 1572,
    unit: 'MW',
    format: 'number',
    decimals: 0,
    deltaPct: -1.4,
    trend: 'down',
    accent: 'consumption',
    sparkline: spark(104, 18, false),
    caption: 'Real-time load',
  },
  {
    id: 'grid',
    label: 'Grid Utilization',
    value: 93.6,
    unit: '%',
    format: 'percent',
    decimals: 1,
    deltaPct: 0.8,
    trend: 'up',
    accent: 'alert',
    sparkline: spark(105, 18, true),
    caption: 'Capacity headroom 6.4%',
  },
  {
    id: 'settlement',
    label: 'Settlement Volume',
    value: 8.42,
    unit: 'M',
    format: 'compact',
    decimals: 2,
    deltaPct: 4.5,
    trend: 'up',
    accent: 'production',
    sparkline: spark(106, 18, true),
    caption: 'Cleared today (INR)',
  },
]

// ---- Time-series (deterministic seeds) ----
export const supplyDemandSeries = buildSupplyDemand()
export const generationMixSeries = buildGenerationMix()
export const gridLoadSeries = buildGridLoad()
export const volumeSeries = buildVolume()
export const demandForecastSeries = buildDemandForecast()
export const priceForecastSeries = buildPriceForecast()
export const historicalSeries = buildHistorical()

// ---- Producer leaderboard ----
export const producers: Producer[] = [
  { id: 'p1', name: 'Meridian Solar Co-op', type: 'Solar', capacityMw: 420, outputMw: 388, reliability: 99.2, trend: 'up' },
  { id: 'p2', name: 'Northwind Power AG', type: 'Wind', capacityMw: 510, outputMw: 342, reliability: 97.8, trend: 'up' },
  { id: 'p3', name: 'Cascade Hydro Trust', type: 'Hydro', capacityMw: 280, outputMw: 268, reliability: 99.6, trend: 'flat' },
  { id: 'p4', name: 'Aurora Battery Systems', type: 'Battery', capacityMw: 160, outputMw: 134, reliability: 98.4, trend: 'up' },
  { id: 'p5', name: 'Helios Microgrid', type: 'Solar', capacityMw: 190, outputMw: 151, reliability: 96.1, trend: 'down' },
  { id: 'p6', name: 'Greenfield Biomass', type: 'Biomass', capacityMw: 95, outputMw: 88, reliability: 98.9, trend: 'flat' },
  { id: 'p7', name: 'Ridgeline Wind Park', type: 'Wind', capacityMw: 240, outputMw: 142, reliability: 95.3, trend: 'down' },
]

// ---- Consumer rankings ----
export const consumers: Consumer[] = [
  { id: 'c1', name: 'Beacon Data Centers', segment: 'Data Center', usageMwh: 412, demandTrend: 6.4, efficiency: 91 },
  { id: 'c2', name: 'TerraVolt Industrial', segment: 'Industrial', usageMwh: 386, demandTrend: 2.1, efficiency: 84 },
  { id: 'c3', name: 'Summit Manufacturing', segment: 'Industrial', usageMwh: 298, demandTrend: -1.8, efficiency: 79 },
  { id: 'c4', name: 'Vertex Commercial REIT', segment: 'Commercial', usageMwh: 244, demandTrend: 3.0, efficiency: 88 },
  { id: 'c5', name: 'Harbor Logistics Park', segment: 'Commercial', usageMwh: 198, demandTrend: 0.5, efficiency: 82 },
  { id: 'c6', name: 'Civic Grid Authority', segment: 'Municipal', usageMwh: 176, demandTrend: -0.7, efficiency: 86 },
]

// ---- Market insights ----
export const marketInsights: MarketInsight[] = [
  {
    id: 'i1',
    kind: 'peak',
    title: 'Evening Peak Approaching',
    detail: 'Load forecast to exceed 1.6 GW between 18:30–20:00. Reserve margin tightening.',
    value: '18:42',
    severity: 'warn',
  },
  {
    id: 'i2',
    kind: 'volatility',
    title: 'Price Volatility Elevated',
    detail: '30-min realized volatility at 14.2% — above 30-day mean of 9.1%.',
    value: '14.2%',
    severity: 'warn',
  },
  {
    id: 'i3',
    kind: 'renewable',
    title: 'Renewable Contribution',
    detail: 'Solar + wind covering majority of dispatched supply this hour.',
    value: '68%',
    severity: 'info',
  },
  {
    id: 'i4',
    kind: 'imbalance',
    title: 'Zone-3 Imbalance Detected',
    detail: 'Net positive imbalance of +42 MW in eastern interconnect. Auto-balancing engaged.',
    value: '+42 MW',
    severity: 'critical',
  },
]

// ---- System health ----
export const healthNodes: HealthNode[] = [
  { id: 'h1', label: 'Grid Stability', status: 'operational', metric: 'Frequency', value: 49.98, unit: 'Hz', trace: spark(201, 24, true) },
  { id: 'h2', label: 'Market Latency', status: 'operational', metric: 'Match p99', value: 38, unit: 'ms', trace: spark(202, 24, false) },
  { id: 'h3', label: 'Settlement Engine', status: 'degraded', metric: 'Queue depth', value: 1240, unit: 'txn', trace: spark(203, 24, true) },
  { id: 'h4', label: 'Node Availability', status: 'operational', metric: 'Online', value: 99.97, unit: '%', trace: spark(204, 24, true) },
  { id: 'h5', label: 'Network Throughput', status: 'operational', metric: 'Ingest', value: 84.2, unit: 'k/s', trace: spark(205, 24, true) },
]

// ---- Energy flow graph (signature component) ----
export const flowNodes: FlowNode[] = [
  // Producers — left
  { id: 'solar', kind: 'solar', label: 'Meridian Solar', sub: '388 MW', x: 0.1, y: 0.18, load: 388, side: 'producer' },
  { id: 'wind', kind: 'wind', label: 'Northwind Park', sub: '342 MW', x: 0.1, y: 0.5, load: 342, side: 'producer' },
  { id: 'battery', kind: 'battery', label: 'Aurora Storage', sub: '134 MW', x: 0.1, y: 0.82, load: 134, side: 'producer' },
  // Hub — center
  { id: 'market', kind: 'market', label: 'Exchange', sub: 'Clearing Hub', x: 0.5, y: 0.5, load: 864, side: 'hub' },
  // Consumers — right
  { id: 'industrial', kind: 'industrial', label: 'TerraVolt Ind.', sub: '386 MW', x: 0.9, y: 0.28, load: 386, side: 'consumer' },
  { id: 'commercial', kind: 'commercial', label: 'Vertex REIT', sub: '244 MW', x: 0.9, y: 0.72, load: 244, side: 'consumer' },
]

export const flowLinks: FlowLink[] = [
  { id: 'l1', from: 'solar', to: 'market', flow: 388 },
  { id: 'l2', from: 'wind', to: 'market', flow: 342 },
  { id: 'l3', from: 'battery', to: 'market', flow: 134 },
  { id: 'l4', from: 'market', to: 'industrial', flow: 386 },
  { id: 'l5', from: 'market', to: 'commercial', flow: 244 },
]
