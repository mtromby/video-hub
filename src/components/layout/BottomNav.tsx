import { Library, Mic2, ScrollText, Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'

export type AppTab = 'scroll' | 'performers' | 'library' | 'manage'

const tabs: { id: AppTab; label: string; icon: typeof ScrollText }[] = [
  { id: 'scroll', label: 'Scroll', icon: ScrollText },
  { id: 'performers', label: 'Performers', icon: Mic2 },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'manage', label: 'Manage', icon: Settings2 },
]

type BottomNavProps = {
  active: AppTab
  onChange: (tab: AppTab) => void
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      aria-label="Main"
    >
      <div className="pointer-events-auto mx-3 flex w-full max-w-md items-stretch gap-1 rounded-2xl border border-white/10 bg-zinc-950/80 px-2 py-2 shadow-lg shadow-black/40 backdrop-blur-xl supports-[backdrop-filter]:bg-zinc-950/60">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isOn = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1 text-[10px] font-medium transition-colors',
                isOn
                  ? 'text-white'
                  : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              <Icon
                className={cn('size-5', isOn ? 'text-white' : 'text-zinc-400')}
                strokeWidth={isOn ? 2.25 : 1.75}
                aria-hidden
              />
              <span className="leading-none">{label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
