import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { CatalogVideoEditorForm } from '@/components/admin/CatalogVideoEditorForm'
import { Button } from '@/components/ui/button'
import { matchPerformerIdsFromHint } from '@/lib/catalog-helpers'
import { normalizeCatalogPerformers } from '@/lib/normalize-catalog-performer'
import { catalogEditorFromFeedItem } from '@/lib/editor-from-feed-item'
import { persistCatalogVideo } from '@/lib/persist-catalog-video'
import { getSupabase } from '@/lib/supabase'
import type { CatalogCategory, CatalogPerformer, CatalogTag, CatalogVideo } from '@/types/catalog'
import type { CatalogVideoEditorState } from '@/types/catalog-editor'
import { emptyCatalogVideoEditor } from '@/types/catalog-editor'
import type { VideoItem } from '@/types/video'

type CatalogVideoDialogProps = {
  open: boolean
  onClose: () => void
  /** Feed clip to pre-fill (storage path, title, slug). */
  sourceItem: VideoItem | null
}

export function CatalogVideoDialog({ open, onClose, sourceItem }: CatalogVideoDialogProps) {
  const supabase = getSupabase()
  const [editor, setEditor] = useState<CatalogVideoEditorState>(() => emptyCatalogVideoEditor())
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [tags, setTags] = useState<CatalogTag[]>([])
  const [performers, setPerformers] = useState<CatalogPerformer[]>([])
  const [existingPaths, setExistingPaths] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  /** Whether this clip already has a catalog row (matched by storage_path). */
  const [catalogMode, setCatalogMode] = useState<'add' | 'update'>('add')

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

  const hydrate = useCallback(async () => {
    if (!supabase || !sourceItem) return
    setLoading(true)
    setFormError(null)
    const [cRes, tRes, pRes, vRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
      supabase.from('videos').select('storage_path'),
    ])
    if (cRes.error || tRes.error || pRes.error || vRes.error) {
      setLoading(false)
      setFormError(
        cRes.error?.message ??
          tRes.error?.message ??
          pRes.error?.message ??
          vRes.error?.message ??
          'Load failed'
      )
      return
    }
    setCategories((cRes.data as CatalogCategory[]) ?? [])
    setTags((tRes.data as CatalogTag[]) ?? [])
    const performersList = normalizeCatalogPerformers(pRes.data)
    setPerformers(performersList)
    const paths = new Set(
      ((vRes.data as Pick<CatalogVideo, 'storage_path'>[]) ?? []).map((r) => r.storage_path)
    )
    setExistingPaths(paths)

    const fromFeed = catalogEditorFromFeedItem(sourceItem)
    const path = fromFeed.storage_path.trim()

    if (!path) {
      setCatalogMode('add')
      setEditor({
        ...fromFeed,
        performerIds: matchPerformerIdsFromHint(sourceItem.performer, performersList),
      })
      setLoading(false)
      return
    }

    const { data: existing, error: lookupErr } = await supabase
      .from('videos')
      .select('*')
      .eq('storage_path', path)
      .maybeSingle()

    if (lookupErr) {
      setLoading(false)
      setFormError(lookupErr.message)
      return
    }

    if (existing) {
      const row = existing as CatalogVideo
      const [vc, vt, vp] = await Promise.all([
        supabase.from('video_categories').select('category_id').eq('video_id', row.id),
        supabase.from('video_tags').select('tag_id').eq('video_id', row.id),
        supabase.from('video_performers').select('performer_id').eq('video_id', row.id),
      ])
      const catIds = new Set((vc.data ?? []).map((r: { category_id: string }) => r.category_id))
      const tagIds = new Set((vt.data ?? []).map((r: { tag_id: string }) => r.tag_id))
      const performerIds = new Set(
        (vp.data ?? []).map((r: { performer_id: string }) => r.performer_id)
      )
      setCatalogMode('update')
      setEditor({
        id: row.id,
        storage_path: row.storage_path,
        title: row.title,
        slug: row.slug,
        description: row.description ?? '',
        categoryIds: catIds,
        tagIds: tagIds,
        performerIds,
      })
    } else {
      setCatalogMode('add')
      setEditor({
        ...fromFeed,
        performerIds: matchPerformerIdsFromHint(sourceItem.performer, performersList),
      })
    }

    setLoading(false)
  }, [supabase, sourceItem])

  const refreshTaxonomyOnly = useCallback(async () => {
    if (!supabase) return
    const [cRes, tRes, pRes, vRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
      supabase.from('videos').select('storage_path'),
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
    if (!vRes.error) {
      setExistingPaths(
        new Set(
          ((vRes.data as Pick<CatalogVideo, 'storage_path'>[]) ?? []).map((r) => r.storage_path)
        )
      )
    }
  }, [supabase])

  useEffect(() => {
    if (!open || !sourceItem) return
    const t = window.setTimeout(() => void hydrate(), 0)
    return () => window.clearTimeout(t)
  }, [open, sourceItem, hydrate])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  async function onSave() {
    if (!supabase) return
    setSaving(true)
    setFormError(null)
    const result = await persistCatalogVideo(supabase, editor)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    onClose()
  }

  if (!open || !sourceItem || typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-video-dialog-title"
        className="relative flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl border border-white/10 bg-zinc-950 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 flex-col gap-1 border-b border-white/10 px-4 py-3 pr-2">
          <div className="flex items-center justify-between gap-3">
            <h2 id="catalog-video-dialog-title" className="text-base font-semibold text-white">
              {loading
                ? 'Catalog'
                : catalogMode === 'update'
                  ? 'Update catalog'
                  : 'Add to catalog'}
            </h2>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="shrink-0 text-zinc-400 hover:bg-white/10 hover:text-white"
              aria-label="Close"
              onClick={onClose}
            >
              <X className="size-5" />
            </Button>
          </div>
          {!loading && catalogMode === 'update' ? (
            <p className="pr-10 text-xs text-zinc-500">
              This clip is already in your catalog — edits here update that entry.
            </p>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-zinc-500">Loading catalog…</p>
          ) : (
            <div className="flex flex-col gap-5 pb-2">
              <CatalogVideoEditorForm
                idPrefix="scroll-dialog"
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
                onTaxonomyRefresh={refreshTaxonomyOnly}
              />
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-white/15 bg-transparent text-zinc-200"
                  disabled={saving}
                  onClick={onClose}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="bg-violet-600 text-white hover:bg-violet-500"
                  disabled={saving}
                  onClick={() => void onSave()}
                >
                  {saving
                    ? 'Saving…'
                    : catalogMode === 'update'
                      ? 'Save changes'
                      : 'Save to catalog'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
