/**
 * Design tokens — single source of truth for colors used in JS contexts
 * (Recharts, SVG, inline styles) where Tailwind class names can't reach.
 * Mirror of tailwind.config.js semantic palette.
 */

export const color = {
  // Foundation
  bg: '#0a0e14',
  surface900: '#0f172a',
  surface850: '#16202e',
  surface800: '#1e293b',
  border700: '#334155',
  border600: '#475569',

  // Text
  textPrimary: '#f8fafc',
  text100: '#f1f5f9',
  text300: '#cbd5e1',
  text400: '#94a3b8',
  text500: '#64748b',

  // Energy production — emerald / teal
  production: '#10b981',
  productionDeep: '#059669',
  teal: '#14b8a6',

  // Consumption — blue / indigo
  consumption: '#3b82f6',
  indigo: '#6366f1',

  // Market — amber / gold
  market: '#f59e0b',
  gold: '#d4a017',

  // Forecasting — violet / purple
  forecast: '#8b5cf6',
  purple: '#a855f7',

  // Alerts — coral / red
  alert: '#f43f5e',
  red: '#ef4444',
} as const

/** Generation-mix source palette (production-aligned greens + supportive hues). */
export const sourceColor: Record<string, string> = {
  Solar: '#f59e0b',
  Wind: '#14b8a6',
  Hydro: '#3b82f6',
  Battery: '#a855f7',
  Biomass: '#10b981',
  Grid: '#64748b',
}

/** Shared Recharts axis / grid styling so every chart reads identically. */
export const chartAxis = {
  stroke: '#475569',
  tick: { fill: '#64748b', fontSize: 10, fontFamily: 'JetBrains Mono, monospace' },
  tickLine: false,
  axisLine: false,
} as const

export const chartGrid = {
  stroke: '#1e293b',
  strokeDasharray: '0',
  vertical: false,
} as const

export const tooltipStyle = {
  contentStyle: {
    background: 'rgba(15, 23, 42, 0.96)',
    border: '1px solid #334155',
    borderRadius: 6,
    fontSize: 11,
    fontFamily: 'JetBrains Mono, monospace',
    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
    padding: '8px 10px',
  },
  labelStyle: { color: '#94a3b8', fontSize: 10, marginBottom: 4 },
  itemStyle: { padding: '1px 0' },
  cursor: { stroke: '#475569', strokeWidth: 1, strokeDasharray: '3 3' },
} as const
