import { useCallback, useEffect, useState } from 'react'
import type { KPIDatum, TradeEvent } from '../data/types'
import { kpis as seedKpis } from '../data/mockData'
import { buildInitialTrades, makeTrade } from '../data/generators'
import { useInterval } from './useInterval'

const FEED_MAX = 14

/** Nudge a KPI value by a small random walk, keeping the delta direction sane. */
function tickKpi(k: KPIDatum): KPIDatum {
  const drift = (Math.random() - 0.5) * 2 // -1..1
  const magnitude = k.value * 0.004
  const nextValue = Math.max(0, k.value + drift * magnitude)
  const deltaPct = Math.round((k.deltaPct + drift * 0.3) * 10) / 10
  const sparkline = [...k.sparkline.slice(1), Math.round((nextValue / k.value) * 50 * 10) / 10]
  return {
    ...k,
    value: Math.round(nextValue * 100) / 100,
    deltaPct,
    trend: deltaPct > 0.15 ? 'up' : deltaPct < -0.15 ? 'down' : 'flat',
    sparkline,
  }
}

/**
 * Central live-data orchestrator. Provides ticking KPIs, a streaming trade
 * feed, and a wall clock — mirroring how a real exchange UI multiplexes
 * several websocket channels into one render tree.
 */
export function useLiveData(active: boolean) {
  const [liveKpis, setLiveKpis] = useState<KPIDatum[]>(seedKpis)
  const [feed, setFeed] = useState<TradeEvent[]>([])
  const [now, setNow] = useState(() => Date.now())

  // seed the feed once on mount
  useEffect(() => {
    setFeed(buildInitialTrades(FEED_MAX, Date.now()))
  }, [])

  // KPI ticker
  useInterval(
    () => setLiveKpis((prev) => prev.map(tickKpi)),
    active ? 3200 : null
  )

  // trade feed ticker — staggered cadence feels organic
  useInterval(
    () => {
      const t = Date.now()
      setNow(t)
      setFeed((prev) => [makeTrade(t), ...prev].slice(0, FEED_MAX))
    },
    active ? 1900 : null
  )

  // wall clock
  useInterval(() => setNow(Date.now()), active ? 1000 : null)

  const pushBurst = useCallback(() => {
    const t = Date.now()
    setFeed((prev) => [makeTrade(t), makeTrade(t - 1), ...prev].slice(0, FEED_MAX))
  }, [])

  return { liveKpis, feed, now, pushBurst }
}
