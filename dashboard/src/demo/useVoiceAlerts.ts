/**
 * Voice alerts for the trading floor. Subscribes to the raw `DemoEvent` stream
 * (the same one that drives the UI) and speaks short, spoken notifications for a
 * deliberately small set of high-signal moments — settlements clearing/failing
 * and sharp price / supply-demand swings — using the browser-native Web Speech
 * API. No dependencies, no backend, works in both the live and replay sources.
 *
 * Design notes:
 *  - Off by default and persisted to localStorage; the first enable click is the
 *    user gesture browsers require before `speechSynthesis` is allowed to talk.
 *  - We alert on state *transitions* and threshold *crossings*, never on every
 *    tick — readings/market/price fire constantly and would otherwise chatter.
 *  - Per-category debounce + settlement de-dupe keep alerts from talking over a
 *    volatile market. Thresholds below are the obvious tuning knobs.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { DemoEvent } from './events'

const STORAGE_KEY = 'voltgrid:voice'

// ---- tuning knobs ---------------------------------------------------------
/** |price move| (%) tick-to-tick that warrants speaking. */
const PRICE_DELTA_THRESHOLD = 6
/** min wall-clock gap between two price alerts. */
const PRICE_MIN_GAP_MS = 8000
/** demand-over-supply (%) that counts as a grid shortfall worth announcing. */
const MARKET_SHORTFALL_PCT = 15
/** min wall-clock gap between two market alerts. */
const MARKET_MIN_GAP_MS = 15000
// ---------------------------------------------------------------------------

const supported =
  typeof window !== 'undefined' && 'speechSynthesis' in window

function readEnabled(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export interface VoiceControls {
  /** browser exposes the Web Speech API */
  supported: boolean
  enabled: boolean
  toggle: () => void
  /** feed every event here; the hook decides what (if anything) to speak */
  announce: (e: DemoEvent) => void
  speak?: (text: string) => void
}

function shortId(id: string): string {
  return id.length > 4 ? id.slice(-4) : id
}

export function useVoiceAlerts(): VoiceControls {
  const [enabled, setEnabled] = useState<boolean>(() => supported && readEnabled())

  // Refs so the stable `announce` callback always sees fresh values without
  // being re-created (it's wired into the orchestrator's event callback).
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  const lastPriceAt = useRef(0)
  const lastMarketAt = useRef(0)
  const spokenSettlements = useRef<Set<string>>(new Set())
  // tradeId -> economics captured from the `match` event, so a settlement
  // alert can speak kWh + rupees (the settlement event only carries a tiny
  // amountEth that's meaningless read aloud).
  const tradeMeta = useRef<Map<string, { units: number; price: number }>>(new Map())

  const speak = useCallback((text: string) => {
    if (!supported) return
    const u = new SpeechSynthesisUtterance(text)
    u.rate = 1.03
    u.pitch = 1
    u.volume = 1
    window.speechSynthesis.speak(u)
  }, [])

  const toggle = useCallback(() => {
    setEnabled((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
      } catch {
        /* private mode / storage disabled — non-fatal */
      }
      if (supported) {
        // Always clear any in-flight speech on a toggle.
        window.speechSynthesis.cancel()
        // Turning on: this click is the user gesture that unlocks audio in
        // browsers that gate speechSynthesis; the greeting primes + confirms it.
        if (next) speak('Voice alerts on.')
      }
      return next
    })
  }, [speak])

  const announce = useCallback(
    (e: DemoEvent) => {
      // Capture trade economics regardless of mute so a later settlement alert
      // has data even if the user enables voice mid-trade.
      if (e.type === 'match') {
        tradeMeta.current.set(e.tradeId, { units: e.units, price: e.price })
        if (tradeMeta.current.size > 256) {
          const oldest = tradeMeta.current.keys().next().value
          if (oldest !== undefined) tradeMeta.current.delete(oldest)
        }
      }

      if (!enabledRef.current || !supported) return

      switch (e.type) {
        case 'settlement': {
          if (e.stage !== 'released' && e.stage !== 'failed') return
          const key = `${e.tradeId}:${e.stage}`
          if (spokenSettlements.current.has(key)) return
          spokenSettlements.current.add(key)

          if (e.stage === 'failed') {
            speak(`Alert. Settlement failed for trade ${shortId(e.tradeId)}.`)
            return
          }
          const meta = tradeMeta.current.get(e.tradeId)
          if (meta) {
            const kwh = Math.round(meta.units)
            const rupees = Math.round(meta.units * meta.price)
            speak(
              `Trade settled. ${kwh} kilowatt hours for ${rupees} rupees, recorded on chain.`
            )
          } else {
            speak('Trade settled and recorded on chain.')
          }
          return
        }

        case 'price': {
          if (Math.abs(e.deltaPct) < PRICE_DELTA_THRESHOLD) return
          const now = Date.now()
          if (now - lastPriceAt.current < PRICE_MIN_GAP_MS) return
          lastPriceAt.current = now
          const dir = e.deltaPct > 0 ? 'up' : 'down'
          speak(
            `Price ${dir} ${Math.abs(Math.round(e.deltaPct))} percent. Now ${e.price.toFixed(
              2
            )} rupees per kilowatt hour.`
          )
          return
        }

        case 'market': {
          if (e.supply <= 0) return
          const shortfall = ((e.demand - e.supply) / e.supply) * 100
          if (shortfall < MARKET_SHORTFALL_PCT) return
          const now = Date.now()
          if (now - lastMarketAt.current < MARKET_MIN_GAP_MS) return
          lastMarketAt.current = now
          speak(`Grid alert. Demand exceeds supply by ${Math.round(shortfall)} percent.`)
          return
        }

        default:
          return
      }
    },
    [speak]
  )

  // Stop talking if the host unmounts (e.g. route change / hot reload).
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel()
    }
  }, [])

  const speakExternal = useCallback((text: string) => {
    if (enabledRef.current) {
      speak(text)
    }
  }, [speak])

  return { supported, enabled, toggle, announce, speak: speakExternal }
}
