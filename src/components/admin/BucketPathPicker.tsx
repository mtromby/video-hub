import { useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { fetchGcsVideoStoragePaths } from '@/lib/fetch-gcs-storage-paths'
import { cn } from '@/lib/utils'

type BucketPathPickerProps = {
  open: boolean
  onClose: () => void
  /** Paths already in DB (optional) to highlight / filter "new only" */
  existingPaths?: Set<string>
  /** Single-select: tap row picks and closes. */
  onPick?: (path: string) => void
  /** Multi-select: choose rows then confirm (skips paths already in DB unless selected). */
  mode?: 'single' | 'multi'
  onBulkImport?: (paths: string[]) => void
  title?: string
}

export function BucketPathPicker({
  open,
  onClose,
  existingPaths,
  onPick,
  mode = 'single',
  onBulkImport,
  title = 'Pick from bucket',
}: BucketPathPickerProps) {
  const [paths, setPaths] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [newOnly, setNewOnly] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (!open) return
    const ac = new AbortController()
    const t = window.setTimeout(() => {
      setSelected(new Set())
      setQuery('')
      setNewOnly(false)
      setError(null)
      setLoading(true)
      void fetchGcsVideoStoragePaths({ signal: ac.signal }).then(({ paths: p, error: err }) => {
        if (ac.signal.aborted) return
        setLoading(false)
        if (err) {
          setPaths([])
          setError(err)
          return
        }
        setPaths(p.sort((a, b) => a.localeCompare(b)))
      })
    }, 0)
    return () => {
      window.clearTimeout(t)
      ac.abort()
    }
  }, [open])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    let list = paths
    if (newOnly && existingPaths?.size) {
      list = list.filter((p) => !existingPaths.has(p))
    }
    if (!q) return list
    return list.filter((p) => p.toLowerCase().includes(q))
  }, [paths, query, newOnly, existingPaths])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bucket-picker-title"
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 id="bucket-picker-title" className="text-sm font-semibold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-zinc-400 hover:bg-white/10 hover:text-white"
          >
            Close
          </button>
        </div>

        <div className="border-b border-white/10 p-3 space-y-2">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter paths…"
            className="h-10 w-full rounded-xl border border-white/10 bg-black px-3 text-sm text-white placeholder:text-zinc-600 outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
          />
          {existingPaths && existingPaths.size > 0 ? (
            <label className="flex items-center gap-2 text-xs text-zinc-400">
              <input
                type="checkbox"
                checked={newOnly}
                onChange={(e) => setNewOnly(e.target.checked)}
                className="rounded border-white/20"
              />
              Only paths not in catalog yet
            </label>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {loading ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500">Loading bucket sources…</p>
          ) : error ? (
            <p className="px-2 py-4 text-sm text-red-400">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-zinc-500">No paths match.</p>
          ) : (
            <ul className="space-y-0.5">
              {filtered.map((p) => {
                const exists = existingPaths?.has(p)
                const isOn = selected.has(p)
                return (
                  <li key={p}>
                    <button
                      type="button"
                      onClick={() => {
                        if (mode === 'multi') {
                          setSelected((prev) => {
                            const next = new Set(prev)
                            if (next.has(p)) next.delete(p)
                            else next.add(p)
                            return next
                          })
                          return
                        }
                        onPick?.(p)
                        onClose()
                      }}
                      className={cn(
                        'flex w-full items-start gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors',
                        mode === 'multi' && isOn && 'bg-violet-500/25 ring-1 ring-violet-400/40',
                        mode === 'multi' && !isOn && 'hover:bg-white/5',
                        mode === 'single' &&
                          (exists
                            ? 'bg-white/5 text-zinc-400 hover:bg-white/10'
                            : 'text-zinc-100 hover:bg-violet-500/15')
                      )}
                    >
                      {mode === 'multi' ? (
                        <span
                          className={cn(
                            'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border text-[10px]',
                            isOn
                              ? 'border-violet-400 bg-violet-500 text-white'
                              : 'border-white/20 bg-black/40'
                          )}
                          aria-hidden
                        >
                          {isOn ? '✓' : ''}
                        </span>
                      ) : null}
                      <span className="min-w-0 flex-1 break-all font-mono text-[13px] leading-snug">
                        {p}
                      </span>
                      {mode === 'single' ? (
                        exists ? (
                          <span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-zinc-500">
                            in DB
                          </span>
                        ) : (
                          <span className="shrink-0 text-violet-400">Use</span>
                        )
                      ) : exists ? (
                        <span className="shrink-0 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-500">
                          in DB
                        </span>
                      ) : null}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-white/10 p-3 space-y-2">
          {mode === 'multi' ? (
            <Button
              type="button"
              className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-500"
              disabled={selected.size === 0}
              onClick={() => {
                onBulkImport?.(Array.from(selected))
                onClose()
              }}
            >
              Import {selected.size} video{selected.size === 1 ? '' : 's'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="w-full border-white/15 bg-transparent text-zinc-300"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
