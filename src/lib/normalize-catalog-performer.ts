import type { CatalogPerformer } from '@/types/catalog'

/**
 * Ensures Supabase rows match CatalogPerformer (e.g. image_url null vs undefined).
 */
export function normalizeCatalogPerformer(row: Record<string, unknown>): CatalogPerformer {
  const url = row.image_url
  return {
    id: String(row.id),
    name: String(row.name),
    slug: String(row.slug),
    image_url: url != null && url !== '' ? String(url) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  }
}

export function normalizeCatalogPerformers(rows: unknown[] | null | undefined): CatalogPerformer[] {
  if (!rows?.length) return []
  return rows.map((r) => normalizeCatalogPerformer(r as Record<string, unknown>))
}
