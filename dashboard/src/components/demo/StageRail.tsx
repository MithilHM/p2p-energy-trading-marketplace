/** Top progress rail: the 8 stages as labelled ticks, active one lit. Doubles
 *  as a scrubber — click a stage to jump to it. */
import { STAGES } from '../../demo/stages'

interface StageRailProps {
  stageIndex: number
  onJump: (i: number) => void
}

export function StageRail({ stageIndex, onJump }: StageRailProps) {
  return (
    <div className="panel flex items-stretch gap-0 overflow-hidden p-0">
      {STAGES.map((s, i) => {
        const active = i === stageIndex
        const done = i < stageIndex
        return (
          <button
            key={s.id}
            onClick={() => onJump(i)}
            className={`group flex flex-1 flex-col gap-1 border-r border-slate-800 px-2.5 py-2 text-left transition-colors last:border-r-0 ${
              active ? 'bg-production/10' : 'hover:bg-slate-800/50'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={`tabular text-[10px] font-bold ${
                  active ? 'text-production' : done ? 'text-slate-400' : 'text-slate-600'
                }`}
              >
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className={`h-1 flex-1 rounded ${active ? 'bg-production' : done ? 'bg-slate-600' : 'bg-slate-800'}`} />
            </div>
            <span
              className={`truncate text-[10px] font-medium ${
                active ? 'text-slate-100' : done ? 'text-slate-400' : 'text-slate-600'
              }`}
            >
              {s.title}
            </span>
          </button>
        )
      })}
    </div>
  )
}
