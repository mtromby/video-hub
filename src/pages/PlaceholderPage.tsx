import { Sparkles } from 'lucide-react'

import { ThemeToggle } from '@/components/layout/ThemeToggle'

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <div className="relative flex h-full flex-col">
      <div className="pointer-events-none absolute right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-10">
        <ThemeToggle className="pointer-events-auto" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-8 pb-28 text-center">
        <div className="relative">
          <div
            className="absolute -inset-8 rounded-full bg-primary/10 blur-2xl"
            aria-hidden
          />
          <div className="relative flex size-20 items-center justify-center rounded-3xl border border-primary/20 bg-card/80 shadow-lg backdrop-blur-sm">
            <Sparkles className="size-9 text-primary" strokeWidth={1.25} aria-hidden />
          </div>
        </div>
        <div className="max-w-sm space-y-3">
          <h1 className="text-2xl font-light tracking-tight text-foreground">{title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
    </div>
  )
}
