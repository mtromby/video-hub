import { Library, Mic2, ScrollText, Settings2 } from 'lucide-react'

import { cn } from '@/lib/utils'

export type AppTab = 'scroll' | 'performers' | 'library' | 'manage'

/** Reserve space for fixed bar: pt-1.5 + tab row (py-2, icon, label) + bottom safe inset. */
export const BOTTOM_NAV_MAIN_PADDING =
  'pb-[calc(3.75rem+max(0.5rem,env(safe-area-inset-bottom)))]'

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
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-card/95 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-8px_32px_-8px_hsl(var(--foreground)/0.08)] backdrop-blur-xl dark:shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.45)]"
      aria-label="Main"
    >
      <div className="flex w-full items-stretch">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isOn = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className={cn(
                'group flex flex-1 flex-col items-center justify-center gap-1 py-2 text-[10px] font-medium tracking-wide text-muted-foreground transition-transform active:scale-[0.97]'
              )}
            >
              <Icon
                className={cn(
                  'size-[18px] shrink-0 transition-colors',
                  isOn ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/85'
                )}
                strokeWidth={isOn ? 2.35 : 1.85}
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
