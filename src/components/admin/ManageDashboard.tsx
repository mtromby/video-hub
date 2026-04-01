import { useState } from 'react'

import { CategoriesPanel } from '@/components/admin/CategoriesPanel'
import { TagsPanel } from '@/components/admin/TagsPanel'
import { VideosPanel } from '@/components/admin/VideosPanel'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

type ManageSection = 'videos' | 'categories' | 'tags'

const sections: { id: ManageSection; label: string }[] = [
  { id: 'videos', label: 'Videos' },
  { id: 'categories', label: 'Categories' },
  { id: 'tags', label: 'Tags' },
]

export function ManageDashboard() {
  const { user, signOut } = useAuth()
  const [section, setSection] = useState<ManageSection>('videos')

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/70 bg-background/80 px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Studio</p>
            <h1 className="mt-1 text-2xl font-light tracking-tight text-foreground">Catalog</h1>
            <p className="mt-1 truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ThemeToggle />
            <Button type="button" variant="outline" size="sm" className="text-xs" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </div>

        <nav
          className="mt-5 flex gap-1 rounded-full border border-border/60 bg-muted/50 p-1"
          aria-label="Catalog sections"
        >
          {sections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'flex-1 rounded-full py-2.5 text-center text-xs font-medium tracking-wide transition-all duration-200',
                section === id
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-5">
        {section === 'videos' ? <VideosPanel /> : null}
        {section === 'categories' ? <CategoriesPanel /> : null}
        {section === 'tags' ? <TagsPanel /> : null}
      </div>
    </div>
  )
}
