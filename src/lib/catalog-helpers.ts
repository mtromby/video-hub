import { slugify } from '@/lib/slug'
import type { CatalogPerformer } from '@/types/catalog'

/** Human-readable title from a GCS object key (filename without extension, spaced). */
export function titleFromStoragePath(path: string): string {
  const base = path.split('/').pop() ?? path
  const noExt = base.replace(/\.[^.]+$/, '')
  const t = noExt.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  return t || noExt || 'Untitled'
}

/** Match manifest `performer` string to catalog rows by slug or case-insensitive name. */
export function matchPerformerIdsFromHint(
  hint: string | undefined,
  performers: CatalogPerformer[]
): Set<string> {
  const t = hint?.trim()
  if (!t || performers.length === 0) return new Set()
  const s = slugify(t)
  const row = performers.find(
    (p) => p.slug === s || p.name.toLowerCase() === t.toLowerCase()
  )
  return row ? new Set([row.id]) : new Set()
}
