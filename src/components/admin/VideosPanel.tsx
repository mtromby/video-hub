import { useCallback, useEffect, useMemo, useState } from 'react'

import { BucketPathPicker } from '@/components/admin/BucketPathPicker'
import { CatalogVideoEditorForm } from '@/components/admin/CatalogVideoEditorForm'
import { Button } from '@/components/ui/button'
import { titleFromStoragePath } from '@/lib/catalog-helpers'
import { normalizeCatalogPerformers } from '@/lib/normalize-catalog-performer'
import { persistCatalogVideo } from '@/lib/persist-catalog-video'
import { publicUrlForStoragePath } from '@/lib/fetch-gcs-storage-paths'
import { getSupabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import type { CatalogCategory, CatalogPerformer, CatalogTag, CatalogVideo } from '@/types/catalog'
import type { CatalogVideoEditorState } from '@/types/catalog-editor'
import { emptyCatalogVideoEditor } from '@/types/catalog-editor'

export function VideosPanel() {
  const supabase = getSupabase()!
  const [videos, setVideos] = useState<CatalogVideo[]>([])
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [tags, setTags] = useState<CatalogTag[]>([])
  const [performers, setPerformers] = useState<CatalogPerformer[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [view, setView] = useState<'list' | 'edit'>('list')
  const [editor, setEditor] = useState<CatalogVideoEditorState>(() => emptyCatalogVideoEditor())
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [pickerOpen, setPickerOpen] = useState(false)
  const [bulkOpen, setBulkOpen] = useState(false)

  const existingPaths = useMemo(() => new Set(videos.map((v) => v.storage_path)), [videos])

  const tagsByCategory = useMemo(() => {
    const m = new Map<string, CatalogTag[]>()
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

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const [vRes, cRes, tRes, pRes] = await Promise.all([
      supabase.from('videos').select('*').order('updated_at', { ascending: false }),
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
    ])
    setLoading(false)
    if (vRes.error) {
      setError(vRes.error.message)
      return
    }
    if (cRes.error) {
      setError(cRes.error.message)
      return
    }
    if (tRes.error) {
      setError(tRes.error.message)
      return
    }
    if (pRes.error) {
      setError(pRes.error.message)
      return
    }
    setVideos((vRes.data as CatalogVideo[]) ?? [])
    setCategories((cRes.data as CatalogCategory[]) ?? [])
    setTags((tRes.data as CatalogTag[]) ?? [])
    setPerformers(normalizeCatalogPerformers(pRes.data))
  }, [supabase])

  /** Refresh categories, tags, and performers (inline create on video form) without list loading. */
  const refreshTaxonomy = useCallback(async () => {
    const [cRes, tRes, pRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
    ])
    if (!cRes.error) {
      setCategories((cRes.data as CatalogCategory[]) ?? [])
    }
    if (!tRes.error) {
      setTags((tRes.data as CatalogTag[]) ?? [])
    }
    if (!pRes.error) {
      setPerformers(normalizeCatalogPerformers(pRes.data))
    }
  }, [supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void loadAll(), 0)
    return () => window.clearTimeout(t)
  }, [loadAll])

  async function loadVideoRelations(videoId: string) {
    const [vc, vt, vp] = await Promise.all([
      supabase.from('video_categories').select('category_id').eq('video_id', videoId),
      supabase.from('video_tags').select('tag_id').eq('video_id', videoId),
      supabase.from('video_performers').select('performer_id').eq('video_id', videoId),
    ])
    const catIds = new Set((vc.data ?? []).map((r: { category_id: string }) => r.category_id))
    const tagIds = new Set((vt.data ?? []).map((r: { tag_id: string }) => r.tag_id))
    const performerIds = new Set(
      (vp.data ?? []).map((r: { performer_id: string }) => r.performer_id)
    )
    return { catIds, tagIds, performerIds }
  }

  function openNew() {
    setEditor(emptyCatalogVideoEditor())
    setFormError(null)
    setView('edit')
  }

  async function openEdit(v: CatalogVideo) {
    setFormError(null)
    const { catIds, tagIds, performerIds } = await loadVideoRelations(v.id)
    setEditor({
      id: v.id,
      storage_path: v.storage_path,
      title: v.title,
      slug: v.slug,
      description: v.description ?? '',
      categoryIds: catIds,
      tagIds: tagIds,
      performerIds,
    })
    setView('edit')
  }

  async function saveVideo() {
    setFormError(null)
    setSaving(true)
    const result = await persistCatalogVideo(supabase, editor)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    setView('list')
    void loadAll()
  }

  async function removeVideo(v: CatalogVideo): Promise<boolean> {
    if (!confirm(`Delete “${v.title}” from the catalog?`)) return false
    const { error: err } = await supabase.from('videos').delete().eq('id', v.id)
    if (err) {
      setFormError(err.message)
      return false
    }
    void loadAll()
    return true
  }

  async function bulkImport(paths: string[]) {
    const toCreate = paths.filter((p) => !existingPaths.has(p))
    if (toCreate.length === 0) {
      setError('All selected paths are already in the catalog.')
      return
    }

    const usedSlugs = new Set(videos.map((v) => v.slug.toLowerCase()))

    const rows: { storage_path: string; title: string; slug: string; description: null }[] = []
    for (const path of toCreate) {
      const t = titleFromStoragePath(path)
      const baseSlug = slugify(t) || slugify(path) || 'video'
      let slug = baseSlug
      let n = 2
      while (usedSlugs.has(slug)) {
        slug = `${baseSlug}-${n}`
        n += 1
      }
      usedSlugs.add(slug)
      rows.push({ storage_path: path, title: t, slug, description: null })
    }

    setSaving(true)
    const { error: err } = await supabase.from('videos').insert(rows)
    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    void loadAll()
  }

  if (view === 'edit') {
    return (
      <div className="flex flex-col gap-5 pb-28">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => {
              setView('list')
              setFormError(null)
            }}
          >
            ← Back
          </Button>
          <h2 className="text-lg font-semibold text-white">
            {editor.id ? 'Edit video' : 'New video'}
          </h2>
        </div>

        <CatalogVideoEditorForm
          idPrefix="manage-videos"
          editor={editor}
          setEditor={setEditor}
          categories={categories}
          performers={performers}
          tagsByCategory={tagsByCategory}
          allTagsCount={tags.length}
          formError={formError}
          showBrowse
          pickerOpen={pickerOpen}
          onPickerOpenChange={setPickerOpen}
          existingPaths={existingPaths}
          onTaxonomyRefresh={refreshTaxonomy}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
            disabled={saving}
            onClick={() => void saveVideo()}
          >
            {saving ? 'Saving…' : 'Save video'}
          </Button>
          {editor.id ? (
            <Button
              type="button"
              variant="outline"
              className="border-red-500/40 text-red-400 hover:bg-red-500/10"
              disabled={saving}
              onClick={() => {
                const v = videos.find((x) => x.id === editor.id)
                if (!v) return
                void removeVideo(v).then((ok) => {
                  if (ok) setView('list')
                })
              }}
            >
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Videos</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Link GCS object keys to titles, slugs, categories, and tags for your feed and filters.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          className="flex-1 rounded-xl bg-violet-600 text-white hover:bg-violet-500"
          onClick={openNew}
        >
          + New video
        </Button>
        <Button
          type="button"
          variant="outline"
          className="flex-1 border-white/15 bg-transparent text-zinc-200"
          onClick={() => setBulkOpen(true)}
          disabled={saving}
        >
          Import from bucket
        </Button>
      </div>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading catalog…</p>
      ) : videos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 py-14 text-center">
          <p className="text-sm text-zinc-400">No videos in the catalog yet.</p>
          <p className="mt-2 text-xs text-zinc-600">
            Use your GCS manifest settings, then import paths or paste a key manually.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {videos.map((v) => {
            const url = publicUrlForStoragePath(v.storage_path)
            return (
              <li
                key={v.id}
                className="rounded-2xl border border-white/10 bg-zinc-950/70 p-3"
              >
                <div
                  role="button"
                  tabIndex={0}
                  className="w-full cursor-pointer text-left outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-violet-500/50"
                  onClick={() => void openEdit(v)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      void openEdit(v)
                    }
                  }}
                >
                  <p className="font-medium text-white">{v.title}</p>
                  <p className="mt-0.5 line-clamp-2 font-mono text-[11px] text-zinc-500">
                    {v.storage_path}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-violet-400/90">{v.slug}</p>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-violet-400 underline-offset-2 hover:underline"
                    >
                      Open file
                    </a>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="ml-auto border-white/15 text-xs text-zinc-300"
                    onClick={() => void openEdit(v)}
                  >
                    Edit
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <BucketPathPicker
        open={bulkOpen}
        onClose={() => setBulkOpen(false)}
        existingPaths={existingPaths}
        mode="multi"
        onBulkImport={(paths) => void bulkImport(paths)}
        title="Import videos from bucket"
      />
    </div>
  )
}
