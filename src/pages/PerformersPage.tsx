import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Settings2 } from 'lucide-react'

import { ManagePerformerDialog } from '@/components/performer/ManagePerformerDialog'
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
    <div className="relative aspect-[3/4] w-full bg-zinc-950">
      {showImg ? (
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-contain object-center"
          onError={() => setBroken(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center bg-gradient-to-b from-sky-900/35 to-violet-950/50"
          aria-hidden
        >
          <span className="text-4xl font-semibold tracking-tight text-white/35 sm:text-5xl">
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
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-lg font-semibold text-white">Performers</h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Add Supabase environment variables to load the catalog.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-white/10 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-white">Performers</h1>
            <p className="mt-0.5 text-xs text-zinc-500">
              {showAdminChrome
                ? 'Portrait photos fill each card. Use the gear to edit name, slug, or image.'
                : 'Creators and featured performers in your catalog.'}
            </p>
          </div>
          {showAdminChrome ? (
            <Button
              type="button"
              size="sm"
              className="shrink-0 gap-1.5 rounded-xl bg-sky-600/90 text-white hover:bg-sky-600"
              onClick={openCreate}
            >
              <Plus className="size-4" />
              Add
            </Button>
          ) : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4">
        {loading ? (
          <p className="py-12 text-center text-sm text-zinc-500">Loading performers…</p>
        ) : loadErr ? (
          <p className="py-12 text-center text-sm text-red-400">{loadErr}</p>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="text-sm text-zinc-500">No performers in the catalog yet.</p>
            {showAdminChrome ? (
              <Button
                type="button"
                variant="outline"
                className="border-white/15 bg-transparent text-zinc-200"
                onClick={openCreate}
              >
                Add your first performer
              </Button>
            ) : null}
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:gap-4">
            {sorted.map((p) => (
              <li key={p.id}>
                <article className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 shadow-lg shadow-black/40 ring-1 ring-white/5 transition hover:border-sky-500/35 hover:ring-sky-500/15">
                  <div className="relative min-h-0 flex-1">
                    {showAdminChrome ? (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="absolute right-1.5 top-1.5 z-10 size-8 rounded-full border border-white/10 bg-black/45 text-zinc-200 backdrop-blur-sm hover:bg-black/60 hover:text-white"
                        aria-label={`Manage ${p.name}`}
                        onClick={() => openEdit(p)}
                      >
                        <Settings2 className="size-4" />
                      </Button>
                    ) : null}
                    <PerformerPortraitPhoto name={p.name} imageUrl={p.image_url} />
                  </div>
                  <div className="shrink-0 border-t border-white/10 bg-black/80 px-2 py-2.5">
                    <p className="truncate text-center text-sm font-medium text-white">{p.name}</p>
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
