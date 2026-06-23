import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Server, Wifi, Cpu, Activity, ArrowLeft, Terminal, CheckCircle2 } from 'lucide-react'

export function EdgeOnboarding() {
  const [wsConnected, setWsConnected] = useState(false)
  const [latestData, setLatestData] = useState<any>(null)

  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/ws/edge')
    
    ws.onopen = () => {
      setWsConnected(true)
    }
    
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setLatestData(data)
      } catch (err) {
        console.error('Invalid JSON received', err)
      }
    }
    
    ws.onclose = () => {
      setWsConnected(false)
    }
    
    return () => ws.close()
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-300 font-sans p-6 md:p-12 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-50 flex items-center gap-3">
              <Cpu className="h-8 w-8 text-indigo-500" />
              Edge Device Onboarding
            </h1>
            <p className="text-slate-400 mt-2">Connect physical IoT hardware to the P2P network</p>
          </div>
          <button 
            onClick={() => {
              window.history.pushState({}, '', '/')
              window.dispatchEvent(new Event('popstate'))
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-900 border border-slate-700 hover:bg-slate-800 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </button>
        </div>

        {/* Status Panels */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 mb-4">
              <Server className="h-5 w-5 text-slate-400" />
              <h3 className="font-semibold text-slate-200">MQTT Broker Status</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Available at <strong>localhost:1883</strong>
            </div>
            <p className="text-xs text-slate-500 mt-2">Eclipse Mosquitto broker is running via Docker Compose</p>
          </div>

          <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
            <div className="flex items-center gap-3 mb-4">
              <Wifi className="h-5 w-5 text-slate-400" />
              <h3 className="font-semibold text-slate-200">WebSocket Bridge</h3>
            </div>
            <div className={`flex items-center gap-2 text-sm ${wsConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
              <span className={`h-2 w-2 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {wsConnected ? 'Connected to API Gateway' : 'Connecting to ws://localhost:8000/ws/edge...'}
            </div>
            <p className="text-xs text-slate-500 mt-2">Piping MQTT telemetry securely to the frontend</p>
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50 space-y-6">
          <h2 className="text-xl font-bold text-slate-100 border-b border-slate-800 pb-3">Integration Guide</h2>
          
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">1</div>
              <div>
                <h4 className="font-semibold text-slate-200 text-lg">Connect hardware to the MQTT Broker</h4>
                <p className="text-sm text-slate-400 mt-1">Configure your ESP32, Raspberry Pi, or simulated script to connect to <code className="bg-slate-950 px-1.5 py-0.5 rounded text-indigo-300">tcp://localhost:1883</code> without authentication.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">2</div>
              <div className="w-full">
                <h4 className="font-semibold text-slate-200 text-lg">Publish Telemetry Payload</h4>
                <p className="text-sm text-slate-400 mt-1 mb-3">Publish JSON messages to the topic <code className="bg-slate-950 px-1.5 py-0.5 rounded text-emerald-300">p2p/edge/telemetry</code>.</p>
                
                <div className="relative rounded-lg overflow-hidden border border-slate-700 bg-[#0d1117] p-4 text-sm font-mono text-slate-300">
                  <div className="absolute top-2 right-2 text-slate-600">
                    <Terminal className="h-4 w-4" />
                  </div>
                  <pre className="overflow-x-auto">
{`{
  "id": "RVCE_NODE_1",
  "name": "RV College Grid",
  "area": "RV College of Engineering",
  "energy": 12.5,
  "role": "producer",
  "kind": "solar",
  "lat": 12.9237,
  "lng": 77.4987
}`}
                  </pre>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-indigo-500/20 text-indigo-400 font-bold border border-indigo-500/30">3</div>
              <div>
                <h4 className="font-semibold text-slate-200 text-lg">Test with CLI</h4>
                <p className="text-sm text-slate-400 mt-1 mb-3">Don't have hardware right now? You can simulate a payload from your terminal using the mosquitto_pub CLI tool (Windows/PowerShell friendly):</p>
                <div className="rounded border border-slate-700 bg-[#0d1117] p-3 text-xs font-mono text-emerald-400 overflow-x-auto whitespace-nowrap">
                  echo '{`{"id": "RVCE_NODE_1", "name": "RV College Grid", "area": "RV College of Engineering", "energy": 5.4, "role": "producer", "kind": "solar", "lat": 12.9237, "lng": 77.4987}`}' | docker run -i --rm --network host eclipse-mosquitto:2.0 mosquitto_pub -h localhost -p 1883 -t "p2p/edge/telemetry" -l
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Payload Stream Preview */}
        <div className="p-6 rounded-xl border border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-indigo-400" />
              <h3 className="font-semibold text-slate-200">Live Payload Stream</h3>
            </div>
            {latestData && (
              <span className="flex items-center gap-1 text-xs text-emerald-400 border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 rounded">
                <CheckCircle2 className="h-3 w-3" /> Data Received
              </span>
            )}
          </div>
          
          <div className="h-48 rounded bg-[#0b0f15] border border-slate-800 p-4 font-mono text-xs text-slate-300 overflow-y-auto">
            {!latestData ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-600">
                <Activity className="h-8 w-8 mb-2 opacity-50" />
                <p>Waiting for MQTT telemetry...</p>
              </div>
            ) : (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} key={JSON.stringify(latestData)}>
                <pre>{JSON.stringify(latestData, null, 2)}</pre>
              </motion.div>
            )}
          </div>
        </div>
        
      </div>
    </div>
  )
}
