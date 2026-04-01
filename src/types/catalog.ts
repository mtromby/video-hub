/** Rows in public.* (Supabase catalog). */

export type CatalogVideo = {
  id: string
  storage_path: string
  title: string
  slug: string
  description: string | null
  created_at: string
  updated_at: string
}

export type CatalogCategory = {
  id: string
  name: string
  slug: string
  description: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export type CatalogTag = {
  id: string
  category_id: string
  name: string
  slug: string
  created_at: string
  updated_at: string
}

export type CatalogPerformer = {
  id: string
  name: string
  slug: string
  /** Public HTTPS URL for profile photo; optional. */
  image_url: string | null
  created_at: string
  updated_at: string
}
