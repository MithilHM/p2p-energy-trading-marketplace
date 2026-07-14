import type { ReactNode } from 'react'
import { TopBar } from './TopBar'
import type { VoiceControls } from '../../demo/useVoiceAlerts'

interface DashboardLayoutProps {
  now: number
  marketOpen: boolean
  voice?: VoiceControls
  currentPath?: string
  children: ReactNode
}

/**
 * App shell: sticky top bar wrapping a scrollable, max-width
 * analytical canvas. The content area owns its own padded grid.
 */
export function DashboardLayout({ now, marketOpen, voice, currentPath, children }: DashboardLayoutProps) {
  return (
    <div className="flex min-h-screen w-full bg-slate-950">
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar now={now} marketOpen={marketOpen} voice={voice} currentPath={currentPath} />
        <main className="flex-1 scroll-thin">
          <div className="mx-auto w-full max-w-[1680px] px-3 py-4 sm:px-5 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
