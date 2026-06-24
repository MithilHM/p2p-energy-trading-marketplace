import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Battery, Zap, DollarSign, Network, CheckCircle2, Power, Gauge } from 'lucide-react'

interface DashboardData {
  producer_id: string
  energy_produced_today_kwh: number
  energy_sold_kwh: number
  money_earned_dollars: number
  connection_steps: string[]
}

export function ProducerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')

  // ESP32 Telemetry State
  const [espData, setEspData] = useState({
    voltage: 0,
    current: 0,
    power: 0,
    energy: 0,
    loadStatus: 'OFF',
    lastSeen: 0,
  })
  const [toggling, setToggling] = useState(false)
  const [wsStatus, setWsStatus] = useState('connecting')

  // Calculate online status (heartbeat check: active if seen in last 10 seconds)
  const [isOnline, setIsOnline] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => {
      if (espData.lastSeen > 0) {
        setIsOnline(Date.now() - espData.lastSeen < 10000)
      } else {
        setIsOnline(false)
      }
    }, 1000)
    return () => clearInterval(timer)
  }, [espData.lastSeen])

  // WebSocket for real-time ESP32 telemetry
  useEffect(() => {
    let ws: WebSocket
    let reconnectTimeout: any

    function connect() {
      setWsStatus('connecting')
      ws = new WebSocket('ws://localhost:8000/ws/edge')

      ws.onopen = () => {
        setWsStatus('connected')
      }

      ws.onmessage = (e) => {
        try {
          const rawData = JSON.parse(e.data)
          // Look for ESP32 meter ID
          if (rawData.id === 'ESP32_METER_01') {
            setEspData({
              voltage: rawData.voltage ?? 230.0,
              current: rawData.current ?? 0.0,
              power: rawData.power ?? 0.0,
              energy: rawData.energy ?? 0.0,
              loadStatus: rawData.load_status ?? 'OFF',
              lastSeen: Date.now(),
            })
          }
        } catch (err) {
          console.error('Error parsing WS message:', err)
        }
      }

      ws.onclose = () => {
        setWsStatus('disconnected')
        reconnectTimeout = setTimeout(connect, 3000)
      }

      ws.onerror = () => {
        ws.close()
      }
    }

    connect()

    return () => {
      if (ws) ws.close()
      clearTimeout(reconnectTimeout)
    }
  }, [])

  useEffect(() => {
    async function fetchDashboard() {
      try {
        // 1. Authenticate as producer
        const params = new URLSearchParams()
        params.append('username', 'producer')
        params.append('password', 'producer123')

        const authRes = await fetch('http://localhost:8000/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: params,
        })

        if (!authRes.ok) throw new Error('Authentication failed')
        const { access_token } = await authRes.json()
        setToken(access_token)

        // 2. Fetch dashboard data
        const dashRes = await fetch('http://localhost:8000/producer/dashboard', {
          headers: {
            Authorization: `Bearer ${access_token}`,
          },
        })

        if (!dashRes.ok) throw new Error('Failed to fetch dashboard data')
        const dashData = await dashRes.json()
        setData(dashData)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  // Call the API Gateway control endpoint to toggle the switch
  const toggleSwitch = async () => {
    if (!token) return
    const nextState = espData.loadStatus === 'ON' ? 'off' : 'on'
    setToggling(true)

    try {
      const res = await fetch('http://localhost:8000/edge/control', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: nextState }),
      })

      if (!res.ok) {
        const errDetail = await res.json()
        throw new Error(errDetail.detail || 'Control request failed')
      }
      
      // Optimistically update status to show response feeling responsive
      setEspData(prev => ({
        ...prev,
        loadStatus: nextState.toUpperCase()
      }))
    } catch (err: any) {
      alert(`Failed to toggle switch: ${err.message}`)
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center text-slate-400">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500/20 border-t-emerald-500" />
          <p>Loading Producer Dashboard...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full min-h-[500px] items-center justify-center">
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-6 text-center text-red-400">
          <p className="font-semibold">{error}</p>
          <p className="text-sm">Make sure the backend services are running.</p>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-5xl p-6"
    >
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-100">Producer Dashboard</h1>
        <p className="text-slate-400 mt-2">Welcome back, {data.producer_id}. Here is your daily performance.</p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 mb-8">
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Energy Produced</h3>
            <Zap className="h-5 w-5 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-100">{data.energy_produced_today_kwh.toFixed(3)}</span>
            <span className="ml-2 text-sm text-slate-400">kWh</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Energy Consumed</h3>
            <Battery className="h-5 w-5 text-emerald-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-100">{data.energy_sold_kwh.toFixed(3)}</span>
            <span className="ml-2 text-sm text-slate-400">kWh</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 shadow-sm backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-slate-400">Money Earned</h3>
            <DollarSign className="h-5 w-5 text-blue-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-bold text-slate-100">₹{(data.money_earned_dollars * 83).toFixed(2)}</span>
            <span className="ml-2 text-sm text-slate-400">INR</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Left Column: Smart Meter & Switch Control */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm backdrop-blur-sm flex flex-col">
          <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Power className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100 font-sans">ESP32 IoT Load Switch</h2>
            </div>
            {isOnline ? (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 rounded-full font-medium">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                Online
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-xs text-rose-400 border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 rounded-full font-medium">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Offline
              </span>
            )}
          </div>
          
          <div className="p-6 flex flex-col sm:flex-row gap-6 items-center flex-1">
            {/* Toggle switch visual */}
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={toggleSwitch}
                disabled={!isOnline || toggling}
                style={{
                  boxShadow: isOnline && espData.loadStatus === 'ON' ? '0 0 25px rgba(52, 211, 153, 0.4)' : 'none',
                  cursor: isOnline ? 'pointer' : 'not-allowed'
                }}
                className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center transition-all duration-300 border shadow-lg group select-none
                  ${!isOnline 
                    ? 'bg-slate-950 border-slate-850 text-slate-600'
                    : espData.loadStatus === 'ON'
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-400'
                      : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-indigo-500 hover:text-indigo-400'
                  }
                `}
              >
                <Power className={`h-10 w-10 mb-1 transition-transform ${isOnline && espData.loadStatus === 'ON' ? 'scale-110' : 'group-hover:scale-105'}`} />
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">{toggling ? 'Sending...' : espData.loadStatus}</span>
              </button>
              <span className="text-xs text-slate-500 text-center font-mono">
                {isOnline ? 'Relay on GPIO Pin 26' : 'Connect hardware to toggle'}
              </span>
            </div>

            {/* Live Telemetry Info */}
            <div className="flex-1 w-full grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/30">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-sans">
                  <Gauge className="h-3.5 w-3.5 text-blue-400" />
                  <span>Voltage</span>
                </div>
                <div className="text-lg font-bold text-slate-200 font-mono">
                  {isOnline ? `${espData.voltage.toFixed(1)} V` : '-- V'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/30">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-sans">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  <span>Current</span>
                </div>
                <div className="text-lg font-bold text-slate-200 font-mono">
                  {isOnline ? `${espData.current.toFixed(2)} A` : '-- A'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/30">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-sans">
                  <Zap className={`h-3.5 w-3.5 text-emerald-400 ${isOnline && espData.loadStatus === 'ON' ? 'animate-pulse' : ''}`} />
                  <span>Active Power</span>
                </div>
                <div className="text-lg font-bold text-slate-200 font-mono">
                  {isOnline ? `${espData.power.toFixed(1)} W` : '-- W'}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-800/80 bg-slate-950/30">
                <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1 font-sans">
                  <Battery className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Meter Energy</span>
                </div>
                <div className="text-lg font-bold text-slate-200 font-mono truncate" title={espData.energy.toFixed(6)}>
                  {isOnline ? `${espData.energy.toFixed(3)} kWh` : '-- kWh'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Connect to Network */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm backdrop-blur-sm">
          <div className="border-b border-slate-800 px-6 py-4 flex items-center gap-3">
            <Network className="h-5 w-5 text-indigo-400" />
            <h2 className="text-lg font-semibold text-slate-100 font-sans">Connect to Network</h2>
          </div>
          <div className="p-6">
            <p className="text-slate-400 mb-6 text-sm font-sans">
              Follow these steps to connect your physical or virtual smart meter to the peer-to-peer energy marketplace.
            </p>
            <ul className="space-y-4">
              {data.connection_steps.map((step, idx) => (
                <li key={idx} className="flex gap-4 items-start text-sm">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                  <span className="text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{step}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
