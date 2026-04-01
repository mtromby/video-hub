import { useCallback, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Loader2, Search, X } from 'lucide-react'

import { VideoFeed } from '@/components/feed/VideoFeed'
import { Button } from '@/components/ui/button'
import { applyFeedFilters } from '@/lib/apply-feed-filters'
import { useFeedCatalogFilterData } from '@/hooks/useFeedCatalogFilterData'
import { cn } from '@/lib/utils'
import {
  countActiveFeedFilters,
  emptyFeedFilterSelections,
  type FeedFilterSelections,
  type TagCombinationMode,
} from '@/types/feed-filters'
import type { VideoItem } from '@/types/video'

function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}

type ChipProps = {
  label: string
  selected: boolean
  onToggle: () => void
}

function SelectChip({ label, selected, onToggle }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors',
        selected
          ? 'border-violet-500/80 bg-violet-600/90 text-white'
          : 'border-white/15 bg-white/5 text-zinc-300 hover:border-white/25 hover:bg-white/10'
      )}
    >
      {label}
    </button>
  )
}

type ScrollFeedWithFiltersProps = {
  videos: VideoItem[]
  className?: string
}

export function ScrollFeedWithFilters({ videos, className }: ScrollFeedWithFiltersProps) {
  const [panelOpen, setPanelOpen] = useState(false)
  const [selections, setSelections] = useState<FeedFilterSelections>(() => emptyFeedFilterSelections())
  const [searchQuery, setSearchQuery] = useState('')

  const {
    loading: catalogLoading,
    error: catalogError,
    categories,
    tags,
    performers,
    annotationByPath,
    supabaseConfigured,
  } = useFeedCatalogFilterData(videos)

  const manifestHints = useMemo(() => {
    const s = new Set<string>()
    for (const v of videos) {
      const t = v.performer?.trim()
      if (t) s.add(t)
    }
    return [...s].sort((a, b) => a.localeCompare(b))
  }, [videos])

  const tagsByCategory = useMemo(() => {
    const m = new Map<string, typeof tags>()
    for (const t of tags) {
      const list = m.get(t.category_id) ?? []
      list.push(t)
      m.set(t.category_id, list)
    }
    for (const list of m.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name))
    }
    return m
  }, [tags])

  const categoriesAlphabetical = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  )

  const performersSorted = useMemo(
    () => [...performers].sort((a, b) => a.name.localeCompare(b.name)),
    [performers]
  )

  const q = searchQuery.trim().toLowerCase()
  const matchesQ = useCallback((name: string) => !q || name.toLowerCase().includes(q), [q])

  const filteredVideos = useMemo(
    () => applyFeedFilters(videos, selections, annotationByPath, performers),
    [videos, selections, annotationByPath, performers]
  )

  const activeCount = countActiveFeedFilters(selections)
  const feedKey = useMemo(() => filteredVideos.map((v) => v.id).join('\u001f'), [filteredVideos])

  const clearAll = useCallback(() => {
    setSelections(emptyFeedFilterSelections())
  }, [])

  const setTagMode = useCallback((tagMode: TagCombinationMode) => {
    setSelections((s) => ({ ...s, tagMode }))
  }, [])

  return (
    <div className={cn('relative h-full w-full', className)}>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        className="absolute left-3 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] size-11 rounded-full border border-white/15 bg-black/55 text-white shadow-lg backdrop-blur-md hover:bg-black/70"
        aria-label={panelOpen ? 'Close filters' : 'Open filters'}
        aria-expanded={panelOpen}
        onClick={() => setPanelOpen((o) => !o)}
      >
        <Filter className="size-5" aria-hidden />
        {activeCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
            {activeCount > 9 ? '9+' : activeCount}
          </span>
        ) : null}
      </Button>

      {catalogLoading ? (
        <span
          className="pointer-events-none absolute left-16 top-[max(1.25rem,calc(env(safe-area-inset-top)+0.5rem))] z-[60] flex items-center gap-1 text-[11px] text-zinc-500"
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Catalog…
        </span>
      ) : null}

      {filteredVideos.length === 0 && videos.length > 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-lg font-medium text-white">No videos match</p>
          <p className="max-w-xs text-sm text-zinc-400">
            Try turning off some filters, or use &ldquo;Match any tag&rdquo; for broader results.
          </p>
          <Button
            type="button"
            variant="secondary"
            className="rounded-full"
            onClick={() => {
              clearAll()
              setPanelOpen(true)
            }}
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <VideoFeed key={feedKey} videos={filteredVideos} />
      )}

      {panelOpen && typeof document !== 'undefined'
        ? createPortal(
            <div className="fixed inset-0 z-[70] flex justify-end" role="presentation">
              <button
                type="button"
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                aria-label="Close filters"
                onClick={() => setPanelOpen(false)}
              />
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="feed-filters-title"
                className="relative flex h-full max-h-dvh w-[min(100%,22rem)] flex-col border-l border-white/10 bg-zinc-950/98 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
                  <h2 id="feed-filters-title" className="text-base font-semibold text-white">
                    Filter feed
                  </h2>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="shrink-0 text-zinc-400 hover:bg-white/10 hover:text-white"
                    aria-label="Close"
                    onClick={() => setPanelOpen(false)}
                  >
                    <X className="size-5" />
                  </Button>
                </div>

                <div className="border-b border-white/10 px-4 py-2">
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-zinc-500"
                      aria-hidden
                    />
                    <input
                      type="search"
                      placeholder="Search performers, categories, tags…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-black/40 py-2 pl-9 pr-3 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/40"
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-snug text-zinc-500">
                    {activeCount > 0
                      ? `Showing ${filteredVideos.length} of ${videos.length} clips. Categories and tags use your catalog; combine with tag mode below.`
                      : `All ${videos.length} clips. Pick performers, categories, and tags — filters combine with AND across sections.`}
                  </p>
                  {catalogError ? (
                    <p className="mt-2 text-xs text-amber-400/90">{catalogError}</p>
                  ) : null}
                  {!supabaseConfigured ? (
                    <p className="mt-2 text-xs text-zinc-500">
                      Set <code className="text-zinc-400">VITE_SUPABASE_URL</code> and{' '}
                      <code className="text-zinc-400">VITE_SUPABASE_ANON_KEY</code> to load catalog performers,
                      categories, and tags. You can still filter by manifest performer names when listed below.
                    </p>
                  ) : null}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
                  <div className="flex flex-col gap-6 pb-24">
                    {performersSorted.length > 0 ? (
                      <section className="flex flex-col gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Performers (catalog)
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {performersSorted
                            .filter((p) => matchesQ(p.name))
                            .map((p) => (
                              <SelectChip
                                key={p.id}
                                label={p.name}
                                selected={selections.performerIds.includes(p.id)}
                                onToggle={() =>
                                  setSelections((s) => ({
                                    ...s,
                                    performerIds: toggleInList(s.performerIds, p.id),
                                  }))
                                }
                              />
                            ))}
                        </div>
                      </section>
                    ) : supabaseConfigured && !catalogLoading ? (
                      <p className="text-xs text-zinc-500">No performers in catalog yet.</p>
                    ) : null}

                    {manifestHints.length > 0 ? (
                      <section className="flex flex-col gap-2">
                        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                          Performers (manifest)
                        </h3>
                        <p className="text-[10px] leading-snug text-zinc-600">
                          From <code className="text-zinc-500">performer</code> in your manifest. Pairs with catalog
                          filters using AND when both are selected.
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {manifestHints
                            .filter((h) => matchesQ(h))
                            .map((h) => (
                              <SelectChip
                                key={h}
                                label={h}
                                selected={selections.manifestPerformerLiterals.includes(h)}
                                onToggle={() =>
                                  setSelections((s) => ({
                                    ...s,
                                    manifestPerformerLiterals: toggleInList(s.manifestPerformerLiterals, h),
                                  }))
                                }
                              />
                            ))}
                        </div>
                      </section>
                    ) : null}

                    <section className="flex flex-col gap-2">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Categories
                      </h3>
                      {!supabaseConfigured || categoriesAlphabetical.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          {supabaseConfigured
                            ? 'No categories yet — add them in Manage.'
                            : 'Connect Supabase to filter by category.'}
                        </p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {categoriesAlphabetical
                            .filter((c) => matchesQ(c.name))
                            .map((c) => (
                              <SelectChip
                                key={c.id}
                                label={c.name}
                                selected={selections.categoryIds.includes(c.id)}
                                onToggle={() =>
                                  setSelections((s) => ({
                                    ...s,
                                    categoryIds: toggleInList(s.categoryIds, c.id),
                                  }))
                                }
                              />
                            ))}
                        </div>
                      )}
                    </section>

                    <section className="flex flex-col gap-3">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
                        Tags
                      </h3>
                      {!supabaseConfigured || tags.length === 0 ? (
                        <p className="text-xs text-zinc-500">
                          {supabaseConfigured
                            ? 'No tags yet — add them in Manage.'
                            : 'Connect Supabase to filter by tags.'}
                        </p>
                      ) : (
                        <>
                          <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
                            <button
                              type="button"
                              onClick={() => setTagMode('all')}
                              className={cn(
                                'flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                                selections.tagMode === 'all'
                                  ? 'bg-violet-600 text-white'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              )}
                            >
                              Match all selected tags
                            </button>
                            <button
                              type="button"
                              onClick={() => setTagMode('any')}
                              className={cn(
                                'flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-colors',
                                selections.tagMode === 'any'
                                  ? 'bg-violet-600 text-white'
                                  : 'text-zinc-400 hover:text-zinc-200'
                              )}
                            >
                              Match any tag
                            </button>
                          </div>
                          <p className="text-[10px] leading-snug text-zinc-600">
                            <strong className="text-zinc-500">All</strong>: clip must include every selected tag.{' '}
                            <strong className="text-zinc-500">Any</strong>: clip needs at least one. Still combined
                            with performer and category filters.
                          </p>
                          <div className="flex flex-col gap-4">
                            {categories.map((cat) => {
                              const list = tagsByCategory.get(cat.id) ?? []
                              if (!list.length) return null
                              const visible = list.filter((t) => matchesQ(t.name) || matchesQ(cat.name))
                              if (!visible.length) return null
                              return (
                                <div key={cat.id} className="flex flex-col gap-2">
                                  <p className="text-xs font-medium text-zinc-400">{cat.name}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {visible.map((t) => (
                                      <SelectChip
                                        key={t.id}
                                        label={t.name}
                                        selected={selections.tagIds.includes(t.id)}
                                        onToggle={() =>
                                          setSelections((s) => ({
                                            ...s,
                                            tagIds: toggleInList(s.tagIds, t.id),
                                          }))
                                        }
                                      />
                                    ))}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </>
                      )}
                    </section>
                  </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 bg-zinc-950/95 p-4 backdrop-blur-md">
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1 border-white/15 bg-transparent text-zinc-200"
                      disabled={activeCount === 0}
                      onClick={clearAll}
                    >
                      Clear all
                    </Button>
                    <Button
                      type="button"
                      className="flex-1 bg-violet-600 text-white hover:bg-violet-500"
                      onClick={() => setPanelOpen(false)}
                    >
                      Done
                    </Button>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  )
}
