import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'

import { ManagePerformerDialog } from '@/components/performer/ManagePerformerDialog'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { normalizeCatalogPerformers } from '@/lib/normalize-catalog-performer'
import { getSupabase } from '@/lib/supabase'
import type { CatalogPerformer } from '@/types/catalog'

function performerInitials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('') || '?'
  )
}

function PerformerPortraitPhoto({
  name,
  imageUrl,
}: {
  name: string
  imageUrl: string | null
}) {
  const [broken, setBroken] = useState(false)
  const src = imageUrl?.trim()
  const showImg = Boolean(src) && !broken

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted/40">
      {showImg ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-contain object-center transition-transform duration-500 group-hover:scale-[1.02]"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 via-primary/8 to-transparent"
          aria-hidden
        >
          <span className="text-4xl font-light tracking-tight text-primary/40 sm:text-5xl">
            {performerInitials(name)}
          </span>
        </div>
      )}
    </div>
  )
}

export function PerformersPage() {
  const { configured } = useAuth()
  const isAdmin = useIsAdmin()
  const supabase = getSupabase()

  const [list, setList] = useState<CatalogPerformer[]>([])
  const [loadErr, setLoadErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<CatalogPerformer | null>(null)

  const load = useCallback(async () => {
    if (!supabase) {
      setLoading(false)
      setLoadErr('Supabase is not configured.')
      return
    }
    setLoadErr(null)
    setLoading(true)
    const { data, error } = await supabase.from('performers').select('*').order('name')
    setLoading(false)
    if (error) {
      setLoadErr(error.message)
      return
    }
    setList(normalizeCatalogPerformers(data))
  }, [supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  const sorted = useMemo(() => [...list].sort((a, b) => a.name.localeCompare(b.name)), [list])

  const showAdminChrome = configured && isAdmin === true

  function openCreate() {
    setEditTarget(null)
    setDialogOpen(true)
  }

  function openEdit(p: CatalogPerformer) {
    setEditTarget(p)
    setDialogOpen(true)
  }

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-8 pb-24 text-center">
        <div className="pointer-events-none absolute right-3 top-[max(0.5rem,env(safe-area-inset-top))] z-10">
          <ThemeToggle className="pointer-events-auto" />
        </div>
        <h1 className="text-xl font-light text-foreground">Performers</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
          Add Supabase environment variables to load the catalog.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border/70 bg-background/80 px-4 pb-4 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Roster</p>
            <h1 className="mt-1 text-2xl font-light tracking-tight text-foreground">Performers</h1>
            <p className="mt-1.5 max-w-[16rem] text-xs leading-relaxed text-muted-foreground">
              {showAdminChrome
                ? 'Tap the gear on a card to edit. Portrait area shows catalog images.'
                : 'Creators and featured performers in your catalog.'}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <ThemeToggle />
            {showAdminChrome ? (
              <Button type="button" size="sm" className="gap-1.5 shadow-md shadow-primary/15" onClick={openCreate}>
                <Plus className="size-4" strokeWidth={2.5} />
                Add
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-28 pt-5">
        {loading ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading performers…</p>
        ) : loadErr ? (
          <p className="py-16 text-center text-sm text-destructive">{loadErr}</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-5 py-20 text-center">
            <p className="text-sm text-muted-foreground">No performers in the catalog yet.</p>
            {showAdminChrome ? (
              <Button type="button" variant="outline" onClick={openCreate}>
                Add your first performer
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-4 sm:gap-5">
            {sorted.map((p) => (
              <li key={p.id}>
                <article className="group flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-card/90 shadow-md shadow-foreground/[0.04] ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/10 hover:ring-primary/15 dark:shadow-black/30">
                  <div className="relative min-h-0 flex-1">
                    {showAdminChrome ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-2 z-10 size-9 rounded-full border border-border/80 bg-background/85 shadow-md backdrop-blur-md"
                        aria-label={`Manage ${p.name}`}
                        onClick={() => openEdit(p)}
                      >
                        <Settings2 className="size-4" />
                      </Button>
                    ) : null}
                    <PerformerPortraitPhoto name={p.name} imageUrl={p.image_url} />
                  </div>
                  <div className="shrink-0 border-t border-border/60 bg-muted/25 px-3 py-3">
                    <p className="truncate text-center text-sm font-medium tracking-tight text-foreground">{p.name}</p>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ManagePerformerDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        performer={editTarget}
        onSaved={() => void load()}
      />
    </div>
  )
}
