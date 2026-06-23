import {
  Activity,
  BarChart3,
  CircleDollarSign,
  Cpu,
  LayoutGrid,
  LineChart,
  Network,
  Settings,
  Users,
  Zap,
} from 'lucide-react'

const nav = [
  { icon: LayoutGrid, label: 'Overview', active: true },
  { icon: Network, label: 'Energy Flow' },
  { icon: CircleDollarSign, label: 'Markets' },
  { icon: Activity, label: 'Trading' },
  { icon: LineChart, label: 'Forecasting' },
  { icon: BarChart3, label: 'Analytics' },
  { icon: Users, label: 'Participants' },
  { icon: Cpu, label: 'Grid Ops' },
]

/**
 * Slim icon rail — keeps maximal horizontal room for the analytical grid,
 * which is the point of a terminal-style layout.
 */
export function Sidebar() {
  return (
    <aside className="hidden w-14 shrink-0 flex-col items-center border-r border-slate-800/80 bg-slate-900/40 py-3 lg:flex">
      <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-md bg-production/15 ring-1 ring-production/30">
        <Zap className="h-5 w-5 text-production" strokeWidth={2.25} fill="currentColor" />
      </div>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {nav.map(({ icon: Icon, label, active }) => (
          <button
            key={label}
            title={label}
            className={`group relative flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
              active
                ? 'bg-slate-800 text-slate-100'
                : 'text-slate-500 hover:bg-slate-800/60 hover:text-slate-200'
            }`}
          >
            {active && (
              <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r bg-production" />
            )}
            <Icon className="h-[18px] w-[18px]" strokeWidth={1.9} />
            <span className="pointer-events-none absolute left-12 z-30 whitespace-nowrap rounded border border-slate-700 bg-slate-900 px-2 py-1 text-2xs font-medium text-slate-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
              {label}
            </span>
          </button>
        ))}
      </nav>

      <button
        title="Settings"
        className="flex h-10 w-10 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
      >
        <Settings className="h-[18px] w-[18px]" strokeWidth={1.9} />
      </button>
    </aside>
  )
}
