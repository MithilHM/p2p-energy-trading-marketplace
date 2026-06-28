/**
 * Live market-intelligence panel — the one place the dashboard exercises the
 * authenticated API Gateway end to end. It logs in once, then polls (slowly, to
 * stay light on the host) three real backend services *through the gateway*:
 *
 *   GET /forecast/forecast-demand  -> forecasting-service (ARIMA)
 *   GET /forecast/forecast-price   -> forecasting-service (ML)
 *   GET /pricing/analytics         -> pricing-engine
 *   GET /pricing/current-price     -> pricing-engine
 *
 * The forecasting service caches results server-side, so even this slow poll
 * never retrains a model more than once a minute.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Brain, CalendarClock, Sparkles, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { DemoEventState } from '../../demo/events'

const GATEWAY: string =
  (import.meta.env.VITE_GATEWAY_URL as string | undefined) ?? 'http://localhost:8000'

// How often to refresh. Kept high on purpose: the underlying models are cached
// for ~60s server-side, so polling faster would just burn cycles for nothing.
const POLL_MS = 60_000

interface DemandForecast {
  next_hour_demand: number
  forecast: { step: number; demand: number; lower: number; upper: number }[]
  training_points: number
}
interface PriceForecast {
  predicted_price: number
  input: { supply: number; demand: number }
}
interface PricingAnalytics {
  min_price: number
  max_price: number
  avg_price: number
  current_price: number
  volatility_percent?: number
}
interface CurrentPrice {
  current_price: number
  price_trend: string
}

interface Intel {
  demand: DemandForecast | null
  price: PriceForecast | null
  analytics: PricingAnalytics | null
  current: CurrentPrice | null
}

async function login(): Promise<string> {
  const body = new URLSearchParams()
  body.append('username', 'admin')
  body.append('password', 'admin123')
  const res = await fetch(`${GATEWAY}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) throw new Error('gateway auth failed')
  const json = await res.json()
  return json.access_token as string
}

async function getJson<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GATEWAY}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

const trendMeta: Record<string, { icon: typeof TrendingUp; cls: string }> = {
  rising: { icon: TrendingUp, cls: 'text-production' },
  falling: { icon: TrendingDown, cls: 'text-alert' },
}

/**
 * When the live gateway is unreachable, derive the same four metrics from the
 * in-app replay event state — mirroring how every other panel degrades to the
 * deterministic offline feed instead of showing an error. Returns null until
 * the simulation has produced enough data to be meaningful.
 */
function deriveFromEvents(s: DemoEventState): Intel | null {
  if (s.price <= 0 && s.demand <= 0 && s.priceSeries.length === 0) return null

  const series = s.priceSeries
  const min = series.length ? Math.min(...series) : s.price
  const max = series.length ? Math.max(...series) : s.price
  const avg = series.length ? series.reduce((a, b) => a + b, 0) / series.length : s.price
  const volatility = avg > 0 ? ((max - min) / avg) * 100 : 0
  const trendWord = s.priceTrend === 'up' ? 'rising' : s.priceTrend === 'down' ? 'falling' : 'stable'
  // Forward projection: nudge the clearing price by recent momentum, clamped to
  // the observed band so it stays plausible.
  const projected = Math.max(min, Math.min(max * 1.05, s.price * (1 + s.priceDeltaPct / 100)))

  return {
    demand: { next_hour_demand: s.demand, forecast: [], training_points: s.marketSeries.length },
    price: { predicted_price: projected || s.price, input: { supply: s.supply, demand: s.demand } },
    analytics: {
      min_price: min,
      max_price: max,
      avg_price: avg,
      current_price: s.price,
      volatility_percent: volatility,
    },
    current: { current_price: s.price, price_trend: trendWord },
  }
}

interface MarketIntelligencePanelProps {
  /** live replay state, used as the offline fallback when the gateway is down */
  events?: DemoEventState
}

export function MarketIntelligencePanel({ events }: MarketIntelligencePanelProps) {
  const [intel, setIntel] = useState<Intel>({ demand: null, price: null, analytics: null, current: null })
  const [status, setStatus] = useState<'connecting' | 'live' | 'offline'>('connecting')
  const tokenRef = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>

    async function refresh() {
      try {
        if (!tokenRef.current) tokenRef.current = await login()
        const token = tokenRef.current
        const [demand, price, analytics, current] = await Promise.all([
          getJson<DemandForecast>('/forecast/forecast-demand?steps=3', token).catch(() => null),
          getJson<PriceForecast>('/forecast/forecast-price', token).catch(() => null),
          getJson<PricingAnalytics>('/pricing/analytics', token).catch(() => null),
          getJson<CurrentPrice>('/pricing/current-price', token).catch(() => null),
        ])
        if (cancelled) return
        setIntel({ demand, price, analytics, current })
        setStatus(demand || price || analytics || current ? 'live' : 'offline')
      } catch {
        if (cancelled) return
        tokenRef.current = null // force re-auth next cycle
        setStatus('offline')
      } finally {
        if (!cancelled) timer = setTimeout(refresh, POLL_MS)
      }
    }

    refresh()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  // Live gateway data wins; otherwise fall back to the simulated replay feed so
  // the panel stays populated during a standalone demo instead of going blank.
  const fallback = useMemo(() => (events ? deriveFromEvents(events) : null), [events])
  const view = status === 'live' ? intel : fallback ?? intel
  const displayStatus: 'live' | 'simulated' | 'connecting' | 'offline' =
    status === 'live' ? 'live' : fallback ? 'simulated' : status === 'connecting' ? 'connecting' : 'offline'

  const badge = {
    live: { dot: 'bg-production animate-pulse', text: 'text-production', label: 'via API Gateway' },
    simulated: { dot: 'bg-forecast', text: 'text-forecast', label: 'simulated feed' },
    connecting: { dot: 'bg-slate-500', text: 'text-slate-500', label: 'connecting…' },
    offline: { dot: 'bg-alert', text: 'text-alert', label: 'gateway offline' },
  }[displayStatus]

  const trend = view.current?.price_trend ?? 'stable'
  const tm = trendMeta[trend] ?? { icon: Minus, cls: 'text-slate-400' }
  const TrendIcon = tm.icon

  return (
    <section className="panel flex flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-slate-700/50 px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-forecast" strokeWidth={2} />
          <h3 className="eyebrow text-slate-300">Market Intelligence</h3>
        </div>
        <span className={`inline-flex items-center gap-1.5 text-2xs ${badge.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} />
          {badge.label}
        </span>
      </header>

      <div className="grid grid-cols-2 gap-2 p-3">
        {/* Demand forecast (ARIMA) */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="panel-inset p-3">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-slate-400">
            <CalendarClock className="h-3 w-3 text-forecast" /> Next-hr Demand
          </div>
          <div className="tabular text-lg font-semibold text-slate-100">
            {view.demand ? `${view.demand.next_hour_demand.toFixed(1)}` : '—'}
            <span className="ml-1 text-2xs font-normal text-slate-500">kWh</span>
          </div>
          <div className="text-2xs text-slate-500">ARIMA · {view.demand?.training_points ?? 0} pts</div>
        </motion.div>

        {/* Predicted price (ML) */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="panel-inset p-3">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-slate-400">
            <Sparkles className="h-3 w-3 text-forecast" /> Predicted Price
          </div>
          <div className="tabular text-lg font-semibold text-slate-100">
            {view.price ? `₹${view.price.predicted_price.toFixed(2)}` : '—'}
          </div>
          <div className="text-2xs text-slate-500">XGBoost · /kWh</div>
        </motion.div>

        {/* Current clearing price + trend */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="panel-inset p-3">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-slate-400">
            <Activity className="h-3 w-3 text-market" /> Clearing Price
          </div>
          <div className="tabular flex items-center gap-1.5 text-lg font-semibold text-slate-100">
            {view.current ? `₹${view.current.current_price.toFixed(2)}` : '—'}
            <TrendIcon className={`h-3.5 w-3.5 ${tm.cls}`} />
          </div>
          <div className="text-2xs text-slate-500 capitalize">{trend}</div>
        </motion.div>

        {/* Volatility / analytics */}
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="panel-inset p-3">
          <div className="mb-1 flex items-center gap-1.5 text-2xs text-slate-400">
            <TrendingUp className="h-3 w-3 text-forecast" /> Volatility
          </div>
          <div className="tabular text-lg font-semibold text-slate-100">
            {view.analytics?.volatility_percent != null ? `${view.analytics.volatility_percent.toFixed(1)}%` : '—'}
          </div>
          <div className="text-2xs text-slate-500">
            {view.analytics
              ? `₹${view.analytics.min_price.toFixed(1)}–₹${view.analytics.max_price.toFixed(1)}`
              : 'min–max'}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
