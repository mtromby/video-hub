import { useState } from 'react'

import { CategoriesPanel } from '@/components/admin/CategoriesPanel'
import { TagsPanel } from '@/components/admin/TagsPanel'
import { VideosPanel } from '@/components/admin/VideosPanel'
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
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-zinc-950 to-black">
      <header className="shrink-0 border-b border-white/10 bg-black/40 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-white">Catalog</h1>
            <p className="truncate text-xs text-zinc-500">{user?.email}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 border-white/15 bg-transparent text-xs text-zinc-300"
            onClick={() => void signOut()}
          >
            Sign out
          </Button>
        </div>

        <nav
          className="mt-3 flex gap-1 rounded-xl bg-zinc-900/80 p-1 ring-1 ring-white/10"
          aria-label="Catalog sections"
        >
          {sections.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setSection(id)}
              className={cn(
                'flex-1 rounded-lg py-2 text-center text-xs font-medium transition-colors',
                section === id
                  ? 'bg-white text-black shadow'
                  : 'text-zinc-400 hover:text-zinc-200'
              )}
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4">
        {section === 'videos' ? <VideosPanel /> : null}
        {section === 'categories' ? <CategoriesPanel /> : null}
        {section === 'tags' ? <TagsPanel /> : null}
      </div>
    </div>
  )
}
