import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { FieldError, FieldInput, FieldLabel, FieldTextarea } from '@/components/admin/field'
import { Button } from '@/components/ui/button'
import { persistCatalogClip } from '@/lib/persist-catalog-clip'
import { resolveCatalogVideoForFeedItem } from '@/lib/resolve-catalog-video-for-feed-item'
import { getSupabase } from '@/lib/supabase'
import { isValidSlug, slugify } from '@/lib/slug'
import { cn } from '@/lib/utils'
import type { CatalogCategory, CatalogTag } from '@/types/catalog'
import type { CatalogClipEditorState } from '@/types/catalog-editor'
import type { VideoItem } from '@/types/video'

type CreateClipDialogProps = {
  open: boolean
  onClose: () => void
  /** Feed item being clipped (manifest or existing clip’s source video). */
  sourceItem: VideoItem | null
  /** When set, dialog loads this clip for editing (still pass sourceItem for context when available). */
  editingClipId?: string | null
  /** Suggested start from current playback time (create mode only). */
  initialStartSeconds: number
  videoDuration: number
  onSaved: () => void
}

function chipClass(selected: boolean) {
  return cn(
    'rounded-full border px-3 py-1.5 text-left text-xs font-medium transition-colors',
    selected
      ? 'border-primary/80 bg-primary text-primary-foreground'
      : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:bg-muted'
  )
}

export function CreateClipDialog({
  open,
  onClose,
  sourceItem,
  editingClipId = null,
  initialStartSeconds,
  videoDuration,
  onSaved,
}: CreateClipDialogProps) {
  const supabase = getSupabase()
  const [editor, setEditor] = useState<CatalogClipEditorState>(() => ({
    id: null,
    video_id: '',
    start_seconds: 0,
    title: '',
    slug: '',
    description: '',
    categoryIds: new Set(),
    tagIds: new Set(),
  }))
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [tags, setTags] = useState<CatalogTag[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [resolveError, setResolveError] = useState<string | null>(null)

  const [newCatName, setNewCatName] = useState('')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [newCatBusy, setNewCatBusy] = useState(false)
  const [newCatErr, setNewCatErr] = useState<string | null>(null)

  const [newTagCategoryId, setNewTagCategoryId] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagSlug, setNewTagSlug] = useState('')
  const [newTagBusy, setNewTagBusy] = useState(false)
  const [newTagErr, setNewTagErr] = useState<string | null>(null)

  const id = (s: string) => `create-clip-${s}`

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

  const categoriesSorted = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  )

  const allTagsCount = tags.length

  const refreshTaxonomy = useCallback(async (): Promise<{ ok: true } | { ok: false; message: string }> => {
    if (!supabase) return { ok: false, message: 'Not configured.' }
    const [cRes, tRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
    ])
    if (cRes.error || tRes.error) {
      return {
        ok: false,
        message: cRes.error?.message ?? tRes.error?.message ?? 'Could not refresh categories or tags.',
      }
    }
    setCategories((cRes.data as CatalogCategory[]) ?? [])
    setTags((tRes.data as CatalogTag[]) ?? [])
    return { ok: true }
  }, [supabase])

  useEffect(() => {
    if (categories.length === 0) return
    const t = window.setTimeout(() => {
      setNewTagCategoryId((prev) =>
        prev && categories.some((c) => c.id === prev) ? prev : categories[0].id
      )
    }, 0)
    return () => window.clearTimeout(t)
  }, [categories])

  const hydrate = useCallback(async () => {
    if (!supabase || !open) return
    setLoading(true)
    setFormError(null)
    setResolveError(null)

    const [cRes, tRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
    ])
    if (cRes.error || tRes.error) {
      setLoading(false)
      setFormError(cRes.error?.message ?? tRes.error?.message ?? 'Load failed')
      return
    }
    setCategories((cRes.data as CatalogCategory[]) ?? [])
    setTags((tRes.data as CatalogTag[]) ?? [])

    const editId = editingClipId?.trim()
    if (editId) {
      const { data: clip, error: clipErr } = await supabase
        .from('clips')
        .select('id, video_id, start_seconds, title, slug, description')
        .eq('id', editId)
        .maybeSingle()
      if (clipErr) {
        setResolveError(clipErr.message)
        setLoading(false)
        return
      }
      if (!clip) {
        setResolveError('Clip was not found.')
        setLoading(false)
        return
      }
      const [ccRes, ctRes] = await Promise.all([
        supabase.from('clip_categories').select('category_id').eq('clip_id', editId),
        supabase.from('clip_tags').select('tag_id').eq('clip_id', editId),
      ])
      if (ccRes.error || ctRes.error) {
        setResolveError(
          ccRes.error?.message ?? ctRes.error?.message ?? 'Failed to load clip categories or tags.'
        )
        setLoading(false)
        return
      }
      const row = clip as {
        id: string
        video_id: string
        start_seconds: number
        title: string | null
        slug: string | null
        description: string | null
      }
      const startSec = Number(row.start_seconds)
      let resolvedTitle = String(row.title ?? '').trim()
      if (!resolvedTitle) {
        const { data: vRow } = await supabase
          .from('videos')
          .select('title')
          .eq('id', row.video_id)
          .maybeSingle()
        resolvedTitle = String((vRow as { title: string } | null)?.title ?? '').trim()
      }
      if (!resolvedTitle && sourceItem?.title?.trim()) {
        resolvedTitle = sourceItem.title.trim()
      }
      if (!resolvedTitle) {
        const s = Math.max(0, Number.isFinite(startSec) ? startSec : 0)
        resolvedTitle = `Clip at ${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`
      }
      const rawSlug = String(row.slug ?? '').trim()
      const resolvedSlug =
        rawSlug || slugify(resolvedTitle) || `clip-${row.id.slice(0, 8)}`

      const categoryIds = new Set<string>()
      for (const r of ccRes.data ?? []) {
        categoryIds.add((r as { category_id: string }).category_id)
      }
      const tagIds = new Set<string>()
      for (const r of ctRes.data ?? []) {
        tagIds.add((r as { tag_id: string }).tag_id)
      }
      setEditor({
        id: row.id,
        video_id: row.video_id,
        start_seconds: startSec,
        title: resolvedTitle,
        slug: resolvedSlug,
        description: String(row.description ?? '').trim(),
        categoryIds,
        tagIds,
      })
      setLoading(false)
      return
    }

    if (!sourceItem) {
      setLoading(false)
      return
    }

    const resolved = await resolveCatalogVideoForFeedItem(supabase, sourceItem)
    if (!resolved.ok) {
      setResolveError(resolved.message)
      setEditor((e) => ({
        ...e,
        video_id: '',
        start_seconds: Math.max(0, initialStartSeconds),
        title: '',
        slug: '',
      }))
      setLoading(false)
      return
    }
    const videoId = resolved.videoId

    const start = Math.max(0, Math.min(initialStartSeconds, Math.max(0, videoDuration - 0.05) || 0))
    const defaultTitle =
      sourceItem.title?.trim() ||
      `Clip at ${Math.floor(start / 60)}:${Math.floor(start % 60)
        .toString()
        .padStart(2, '0')}`

    setEditor({
      id: null,
      video_id: videoId,
      start_seconds: start,
      title: defaultTitle,
      slug: slugify(defaultTitle) || `clip-${Date.now().toString(36)}`,
      description: '',
      categoryIds: new Set(),
      tagIds: new Set(),
    })
    setLoading(false)
  }, [supabase, open, editingClipId, sourceItem, initialStartSeconds, videoDuration])

  useEffect(() => {
    if (!open) return
    if (!editingClipId?.trim() && !sourceItem) return
    const t = window.setTimeout(() => void hydrate(), 0)
    return () => window.clearTimeout(t)
  }, [open, sourceItem, editingClipId, hydrate])

  async function createCategoryInline(e?: FormEvent) {
    e?.preventDefault()
    setNewCatErr(null)
    if (!supabase) return
    const name = newCatName.trim()
    if (!name) {
      setNewCatErr('Name is required.')
      return
    }
    const slug = (newCatSlug.trim() || slugify(name)).toLowerCase()
    if (!isValidSlug(slug)) {
      setNewCatErr('Slug must be lowercase letters, numbers, and hyphens.')
      return
    }
    setNewCatBusy(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({
        name,
        slug,
        description: null,
        sort_order: 0,
      })
      .select('*')
      .single()
    setNewCatBusy(false)
    if (error) {
      setNewCatErr(error.message)
      return
    }
    const row = data as CatalogCategory
    setEditor((prev) => {
      const next = new Set(prev.categoryIds)
      next.add(row.id)
      return { ...prev, categoryIds: next }
    })
    setNewCatName('')
    setNewCatSlug('')
    const r = await refreshTaxonomy()
    if (!r.ok) setNewCatErr(r.message)
  }

  async function createTagInline(e?: FormEvent) {
    e?.preventDefault()
    setNewTagErr(null)
    if (!supabase) return
    if (!newTagCategoryId) {
      setNewTagErr('Create a category first.')
      return
    }
    const name = newTagName.trim()
    if (!name) {
      setNewTagErr('Name is required.')
      return
    }
    const slug = (newTagSlug.trim() || slugify(name)).toLowerCase()
    if (!isValidSlug(slug)) {
      setNewTagErr('Invalid slug format.')
      return
    }
    setNewTagBusy(true)
    const { data, error } = await supabase
      .from('tags')
      .insert({
        category_id: newTagCategoryId,
        name,
        slug,
      })
      .select('*')
      .single()
    setNewTagBusy(false)
    if (error) {
      setNewTagErr(error.message)
      return
    }
    const row = data as CatalogTag
    setEditor((prev) => {
      const next = new Set(prev.tagIds)
      next.add(row.id)
      return { ...prev, tagIds: next }
    })
    setNewTagName('')
    setNewTagSlug('')
    const r = await refreshTaxonomy()
    if (!r.ok) setNewTagErr(r.message)
  }

  async function save() {
    if (!supabase) return
    setFormError(null)
    if (!editor.video_id) {
      setFormError(resolveError ?? 'Save the video to the catalog before creating a clip.')
      return
    }
    if (!editor.title.trim()) {
      setFormError('Title is required.')
      return
    }
    if (!isValidSlug(editor.slug.trim())) {
      setFormError('Slug must be lowercase letters, numbers, and hyphens.')
      return
    }
    if (!Number.isFinite(editor.start_seconds) || editor.start_seconds < 0) {
      setFormError('Start time must be zero or positive.')
      return
    }
    setSaving(true)
    const result = await persistCatalogClip(supabase, editor)
    setSaving(false)
    if (!result.ok) {
      setFormError(result.message)
      return
    }
    onSaved()
    onClose()
  }

  if (!open || typeof document === 'undefined') return null

  const isEditMode = Boolean(editingClipId?.trim())

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-foreground/45 backdrop-blur-sm dark:bg-black/70"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-clip-title"
        className="relative flex max-h-[min(90dvh,640px)] w-full max-w-lg flex-col rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 id="create-clip-title" className="text-base font-medium text-foreground">
            {isEditMode ? 'Edit clip' : 'New clip'}
          </h2>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="shrink-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="size-5" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="flex flex-col gap-4">
              {resolveError ? (
                <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
                  {resolveError}
                </p>
              ) : null}

              <div className="space-y-1.5">
                <FieldLabel htmlFor="clip-start">Start time (seconds)</FieldLabel>
                <FieldInput
                  id="clip-start"
                  type="number"
                  min={0}
                  step={0.1}
                  value={editor.start_seconds}
                  disabled={!editor.video_id}
                  onChange={(e) =>
                    setEditor((x) => ({ ...x, start_seconds: Number(e.target.value) }))
                  }
                />
                <p className="text-[11px] text-muted-foreground">
                  Playback begins here. Use 0 for the full video. Scrubber can still jump to file start.
                </p>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="clip-title">Title</FieldLabel>
                <FieldInput
                  id="clip-title"
                  value={editor.title}
                  disabled={!editor.video_id}
                  onChange={(e) => setEditor((x) => ({ ...x, title: e.target.value }))}
                  onBlur={() =>
                    setEditor((x) => {
                      if (!x.slug.trim() && x.title.trim()) {
                        return { ...x, slug: slugify(x.title) || x.slug }
                      }
                      return x
                    })
                  }
                />
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <FieldLabel htmlFor="clip-slug">Slug</FieldLabel>
                  <FieldInput
                    id="clip-slug"
                    value={editor.slug}
                    disabled={!editor.video_id}
                    onChange={(e) =>
                      setEditor((x) => ({ ...x, slug: e.target.value.toLowerCase() }))
                    }
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  disabled={!editor.video_id}
                  onClick={() =>
                    setEditor((x) => ({
                      ...x,
                      slug: slugify(x.title) || x.slug,
                    }))
                  }
                >
                  Regenerate
                </Button>
              </div>

              <div className="space-y-1.5">
                <FieldLabel htmlFor="clip-desc">Description</FieldLabel>
                <FieldTextarea
                  id="clip-desc"
                  value={editor.description}
                  disabled={!editor.video_id}
                  onChange={(e) => setEditor((x) => ({ ...x, description: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <section className="rounded-2xl border border-border bg-card/70 p-4">
                <h3 className="text-sm font-medium text-foreground">Categories</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Tap to attach or detach. Create a new one below — it will be attached to this clip
                  automatically.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categoriesSorted.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No categories yet — add your first below.</p>
                  ) : (
                    categoriesSorted.map((c) => {
                      const on = editor.categoryIds.has(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          disabled={!editor.video_id}
                          onClick={() =>
                            setEditor((e) => {
                              const next = new Set(e.categoryIds)
                              if (next.has(c.id)) next.delete(c.id)
                              else next.add(c.id)
                              return { ...e, categoryIds: next }
                            })
                          }
                          className={chipClass(on)}
                        >
                          {c.name}
                        </button>
                      )
                    })
                  )}
                </div>

                {supabase ? (
                  <form
                    className="mt-4 space-y-2 border-t border-border pt-4"
                    onSubmit={(e) => void createCategoryInline(e)}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      New category
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div className="space-y-1 sm:col-span-2">
                        <FieldLabel htmlFor={id('new-cat-name')}>Name</FieldLabel>
                        <FieldInput
                          id={id('new-cat-name')}
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          onBlur={() => {
                            if (!newCatSlug.trim() && newCatName.trim()) {
                              setNewCatSlug(slugify(newCatName))
                            }
                          }}
                          placeholder="e.g. Genre"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <FieldLabel htmlFor={id('new-cat-slug')}>Slug</FieldLabel>
                        <FieldInput
                          id={id('new-cat-slug')}
                          value={newCatSlug}
                          onChange={(e) => setNewCatSlug(e.target.value.toLowerCase())}
                          placeholder="genre"
                        />
                      </div>
                    </div>
                    <FieldError>{newCatErr}</FieldError>
                    <Button
                      type="submit"
                      size="sm"
                      className="w-full rounded-lg sm:w-auto"
                      disabled={newCatBusy}
                    >
                      {newCatBusy ? 'Creating…' : 'Create & attach category'}
                    </Button>
                  </form>
                ) : null}
              </section>

              <section className="rounded-2xl border border-border bg-card/70 p-4">
                <h3 className="text-sm font-medium text-foreground">Tags</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Grouped by category. Create a tag below — it will be attached to this clip automatically.
                </p>
                <div className="mt-4 flex flex-col gap-4">
                  {categories.map((cat) => {
                    const list = tagsByCategory.get(cat.id) ?? []
                    if (!list.length) return null
                    return (
                      <div key={cat.id} className="flex flex-col gap-2">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {cat.name}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {list.map((t) => {
                            const on = editor.tagIds.has(t.id)
                            return (
                              <button
                                key={t.id}
                                type="button"
                                disabled={!editor.video_id}
                                onClick={() =>
                                  setEditor((e) => {
                                    const next = new Set(e.tagIds)
                                    if (next.has(t.id)) next.delete(t.id)
                                    else next.add(t.id)
                                    return { ...e, tagIds: next }
                                  })
                                }
                                className={chipClass(on)}
                              >
                                {t.name}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                  {allTagsCount === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      {categories.length === 0
                        ? 'Add a category above, then create tags here.'
                        : 'No tags yet — add your first below.'}
                    </p>
                  ) : null}
                </div>

                {supabase ? (
                  <div className="mt-4 space-y-2 border-t border-border pt-4">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      New tag
                    </p>
                    {categories.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Create a category first.</p>
                    ) : (
                      <form className="space-y-2" onSubmit={(e) => void createTagInline(e)}>
                        <div className="space-y-1">
                          <FieldLabel htmlFor={id('new-tag-cat')}>Category</FieldLabel>
                          <select
                            id={id('new-tag-cat')}
                            value={newTagCategoryId}
                            onChange={(e) => setNewTagCategoryId(e.target.value)}
                            className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                          >
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor={id('new-tag-name')}>Name</FieldLabel>
                          <FieldInput
                            id={id('new-tag-name')}
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onBlur={() => {
                              if (!newTagSlug.trim() && newTagName.trim()) {
                                setNewTagSlug(slugify(newTagName))
                              }
                            }}
                            placeholder="e.g. Acoustic"
                          />
                        </div>
                        <div className="space-y-1">
                          <FieldLabel htmlFor={id('new-tag-slug')}>Slug</FieldLabel>
                          <FieldInput
                            id={id('new-tag-slug')}
                            value={newTagSlug}
                            onChange={(e) => setNewTagSlug(e.target.value.toLowerCase())}
                            placeholder="acoustic"
                          />
                        </div>
                        <FieldError>{newTagErr}</FieldError>
                        <Button
                          type="submit"
                          size="sm"
                          className="w-full rounded-lg sm:w-auto"
                          disabled={newTagBusy || !newTagCategoryId}
                        >
                          {newTagBusy ? 'Creating…' : 'Create & attach tag'}
                        </Button>
                      </form>
                    )}
                  </div>
                ) : null}
              </section>

              <FieldError>{formError}</FieldError>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-border p-4">
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={loading || saving || !editor.video_id}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : isEditMode ? 'Save changes' : 'Save clip'}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
