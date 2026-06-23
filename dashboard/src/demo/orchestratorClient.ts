/**
 * REST + WebSocket client for the live `demo-orchestrator` service (:8010).
 * The dashboard talks ONLY to this service; it fans out to matching / pricing /
 * blockchain internally. CORS is open, no auth (it is explicitly the demo surface).
 */
import type { DemoEvent } from './events'
import type { CueName, EmitFn, Transport } from './transport'

const BASE: string =
  (import.meta.env.VITE_ORCHESTRATOR_URL as string | undefined) ?? 'http://localhost:8010'

function wsUrl(): string {
  return BASE.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws'
}

const CUE_PATH: Record<CueName, string> = {
  run: '/demo/run',
  reset: '/demo/reset',
  step: '/demo/step',
  spotlight: '/demo/spotlight',
  pause: '/demo/pause',
  resume: '/demo/resume',
}

async function post(path: string, body?: unknown): Promise<void> {
  await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
}

/**
 * Attempt to open the live WS within `timeoutMs`. Resolves with a connected
 * `Transport` on success, or `null` if the orchestrator is unreachable (caller
 * then falls back to the offline replay).
 */
export function connectLive(emit: EmitFn, timeoutMs = 1500): Promise<Transport | null> {
  return new Promise((resolve) => {
    let settled = false
    let ws: WebSocket
    try {
      ws = new WebSocket(wsUrl())
    } catch {
      resolve(null)
      return
    }

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        try {
          ws.close()
        } catch {
          /* noop */
        }
        resolve(null)
      }
    }, timeoutMs)

    ws.onopen = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        source: 'live',
        cue: (name: CueName, payload?: unknown) => {
          void post(CUE_PATH[name], payload).catch(() => {
            /* non-fatal: a dropped cue shouldn't break the walkthrough */
          })
        },
        close: () => {
          try {
            ws.close()
          } catch {
            /* noop */
          }
        },
      })
    }

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as DemoEvent | { events: DemoEvent[] }
        if (Array.isArray((data as { events?: DemoEvent[] }).events)) {
          for (const e of (data as { events: DemoEvent[] }).events) emit(e)
        } else {
          emit(data as DemoEvent)
        }
      } catch {
        /* ignore malformed frame */
      }
    }

    ws.onerror = () => {
      if (!settled) {
        settled = true
        clearTimeout(timer)
        resolve(null)
      }
    }
  })
}
