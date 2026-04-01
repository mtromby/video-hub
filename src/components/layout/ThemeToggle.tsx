import { Monitor, Moon, Sun } from 'lucide-react'

import { useTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'

const labels: Record<string, string> = {
  system: 'Theme: match system',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

export function ThemeToggle({ className }: { className?: string }) {
  const { preference, cyclePreference } = useTheme()

  const Icon = preference === 'light' ? Sun : preference === 'dark' ? Moon : Monitor

  return (
    <button
      type="button"
      onClick={cyclePreference}
      title={labels[preference]}
      aria-label={labels[preference]}
      className={cn(
        'flex size-11 items-center justify-center rounded-full border-2 border-border/70 bg-card/90 text-foreground shadow-md shadow-foreground/5 backdrop-blur-xl transition-all duration-200 hover:border-primary/40 hover:bg-accent active:scale-95 dark:shadow-black/40',
        className
      )}
    >
      <Icon className="size-[19px]" strokeWidth={1.85} aria-hidden />
    </button>
  )
}
