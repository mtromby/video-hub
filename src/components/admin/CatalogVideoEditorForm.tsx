import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'

import { BucketPathPicker } from '@/components/admin/BucketPathPicker'
import { FieldError, FieldInput, FieldLabel, FieldTextarea } from '@/components/admin/field'
import { PerformerAvatar } from '@/components/performer/PerformerAvatar'
import {
  PerformerFormFields,
  type PerformerFormFieldValues,
} from '@/components/performer/PerformerFormFields'
import { Button } from '@/components/ui/button'
import { publicUrlForStoragePath } from '@/lib/fetch-gcs-storage-paths'
import { normalizeCatalogPerformer } from '@/lib/normalize-catalog-performer'
import { getSupabase } from '@/lib/supabase'
import { isValidSlug, slugify } from '@/lib/slug'
import type { CatalogCategory, CatalogPerformer, CatalogTag } from '@/types/catalog'
import type { CatalogVideoEditorState } from '@/types/catalog-editor'

type CatalogVideoEditorFormProps = {
  editor: CatalogVideoEditorState
  setEditor: Dispatch<SetStateAction<CatalogVideoEditorState>>
  categories: CatalogCategory[]
  performers: CatalogPerformer[]
  tagsByCategory: Map<string, CatalogTag[]>
  allTagsCount: number
  formError: string | null
  /** Prefix for input ids (avoid duplicates when dialog + page both mounted). */
  idPrefix: string
  showBrowse?: boolean
  pickerOpen?: boolean
  onPickerOpenChange?: (open: boolean) => void
  existingPaths?: Set<string>
  /** Reload categories, tags, and performers after inline create (do not reset video fields). */
  onTaxonomyRefresh?: () => void | Promise<void>
}

export function CatalogVideoEditorForm({
  editor,
  setEditor,
  categories,
  performers,
  tagsByCategory,
  allTagsCount,
  formError,
  idPrefix,
  showBrowse = true,
  pickerOpen = false,
  onPickerOpenChange,
  existingPaths = new Set(),
  onTaxonomyRefresh,
}: CatalogVideoEditorFormProps) {
  const p = (s: string) => `${idPrefix}-${s}`
  const previewUrl = publicUrlForStoragePath(editor.storage_path.trim())
  const supabase = getSupabase()

  const [newCatName, setNewCatName] = useState('')
  const [newCatSlug, setNewCatSlug] = useState('')
  const [newCatBusy, setNewCatBusy] = useState(false)
  const [newCatErr, setNewCatErr] = useState<string | null>(null)

  const [newTagCategoryId, setNewTagCategoryId] = useState('')
  const [newTagName, setNewTagName] = useState('')
  const [newTagSlug, setNewTagSlug] = useState('')
  const [newTagBusy, setNewTagBusy] = useState(false)
  const [newTagErr, setNewTagErr] = useState<string | null>(null)

  const [newPerf, setNewPerf] = useState<PerformerFormFieldValues>({
    name: '',
    slug: '',
    imageUrl: '',
  })
  const [newPerfBusy, setNewPerfBusy] = useState(false)
  const [newPerfErr, setNewPerfErr] = useState<string | null>(null)

  const performersSorted = useMemo(
    () => [...performers].sort((a, b) => a.name.localeCompare(b.name)),
    [performers]
  )

  useEffect(() => {
    if (categories.length === 0) return
    setNewTagCategoryId((prev) =>
      prev && categories.some((c) => c.id === prev) ? prev : categories[0].id
    )
  }, [categories])

  async function createCategoryInline() {
    setNewCatErr(null)
    if (!supabase || !onTaxonomyRefresh) return
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
    setEditor((e) => {
      const next = new Set(e.categoryIds)
      next.add(row.id)
      return { ...e, categoryIds: next }
    })
    setNewCatName('')
    setNewCatSlug('')
    await onTaxonomyRefresh()
  }

  async function createTagInline() {
    setNewTagErr(null)
    if (!supabase || !onTaxonomyRefresh) return
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
    setEditor((e) => {
      const next = new Set(e.tagIds)
      next.add(row.id)
      return { ...e, tagIds: next }
    })
    setNewTagName('')
    setNewTagSlug('')
    await onTaxonomyRefresh()
  }

  async function createPerformerInline() {
    setNewPerfErr(null)
    if (!supabase || !onTaxonomyRefresh) return
    const name = newPerf.name.trim()
    if (!name) {
      setNewPerfErr('Name is required.')
      return
    }
    const slug = (newPerf.slug.trim() || slugify(name)).toLowerCase()
    if (!isValidSlug(slug)) {
      setNewPerfErr('Slug must be lowercase letters, numbers, and hyphens.')
      return
    }
    const image_url = newPerf.imageUrl.trim() || null
    setNewPerfBusy(true)
    const { data, error } = await supabase
      .from('performers')
      .insert({ name, slug, image_url })
      .select('*')
      .single()
    setNewPerfBusy(false)
    if (error) {
      setNewPerfErr(error.message)
      return
    }
    const row = normalizeCatalogPerformer(data as Record<string, unknown>)
    setEditor((e) => {
      const next = new Set(e.performerIds)
      next.add(row.id)
      return { ...e, performerIds: next }
    })
    setNewPerf({ name: '', slug: '', imageUrl: '' })
    await onTaxonomyRefresh()
  }

  function toggleCategory(id: string) {
    setEditor((e) => {
      const next = new Set(e.categoryIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...e, categoryIds: next }
    })
  }

  function toggleTag(id: string) {
    setEditor((e) => {
      const next = new Set(e.tagIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...e, tagIds: next }
    })
  }

  function togglePerformer(id: string) {
    setEditor((e) => {
      const next = new Set(e.performerIds)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return { ...e, performerIds: next }
    })
  }

  return (
    <>
      <div className="space-y-1.5">
        <FieldLabel htmlFor={p('path')}>GCS storage path</FieldLabel>
        <div className="flex gap-2">
          <FieldInput
            id={p('path')}
            value={editor.storage_path}
            onChange={(e) => setEditor((x) => ({ ...x, storage_path: e.target.value }))}
            placeholder="clips/my-video.mp4"
            className="flex-1 font-mono text-[13px]"
          />
          {showBrowse && onPickerOpenChange ? (
            <Button type="button" variant="outline" className="shrink-0" onClick={() => onPickerOpenChange(true)}>
              Browse
            </Button>
          ) : null}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Same key as in your manifest or bucket listing (not the full https URL).
        </p>
        {previewUrl ? (
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-xs text-primary underline-offset-2 hover:underline"
          >
            Open public URL
          </a>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={p('title')}>Title</FieldLabel>
        <FieldInput
          id={p('title')}
          value={editor.title}
          onChange={(e) => setEditor((x) => ({ ...x, title: e.target.value }))}
          onBlur={() => {
            setEditor((x) => {
              if (!x.slug.trim() && x.title.trim()) {
                return { ...x, slug: slugify(x.title) }
              }
              return x
            })
          }}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <FieldLabel htmlFor={p('slug')}>Slug</FieldLabel>
          <FieldInput
            id={p('slug')}
            value={editor.slug}
            onChange={(e) => setEditor((x) => ({ ...x, slug: e.target.value.toLowerCase() }))}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="text-xs"
          onClick={() =>
            setEditor((x) => ({
              ...x,
              slug: slugify(x.title) || slugify(x.storage_path) || x.slug,
            }))
          }
        >
          Regenerate
        </Button>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor={p('desc')}>Description</FieldLabel>
        <FieldTextarea
          id={p('desc')}
          value={editor.description}
          onChange={(e) => setEditor((x) => ({ ...x, description: e.target.value }))}
          placeholder="Optional"
        />
      </div>

      <section className="rounded-2xl border border-primary/25 bg-card/70 p-4">
        <h3 className="text-sm font-medium text-foreground">Performers</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tap to attach or detach. Create a new performer below — they will be linked to this video
          automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {performersSorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">No performers yet — add your first below.</p>
          ) : (
            performersSorted.map((perf) => {
              const on = editor.performerIds.has(perf.id)
              return (
                <button
                  key={perf.id}
                  type="button"
                  onClick={() => togglePerformer(perf.id)}
                  className={`inline-flex max-w-full items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-xs font-medium transition-colors ${
                    on
                      ? 'border-primary/55 bg-primary/15 text-foreground'
                      : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  <PerformerAvatar name={perf.name} imageUrl={perf.image_url} size="sm" />
                  <span className="truncate">{perf.name}</span>
                </button>
              )
            })
          )}
        </div>

        {onTaxonomyRefresh && supabase ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              New performer
            </p>
            <PerformerFormFields
              idPrefix={p('new-perf')}
              values={newPerf}
              onChange={setNewPerf}
              onNameBlurSlug={() => {
                setNewPerf((v) =>
                  !v.slug.trim() && v.name.trim() ? { ...v, slug: slugify(v.name) } : v
                )
              }}
            />
            <FieldError>{newPerfErr}</FieldError>
            <Button
              type="button"
              size="sm"
              className="w-full rounded-lg sm:w-auto"
              disabled={newPerfBusy}
              onClick={() => void createPerformerInline()}
            >
              {newPerfBusy ? 'Creating…' : 'Create & attach performer'}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h3 className="text-sm font-medium text-foreground">Categories</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Tap to attach or detach. Create a new one below — it will be attached to this video
          automatically.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet — add your first below.</p>
          ) : (
            categories.map((c) => {
              const on = editor.categoryIds.has(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    on
                      ? 'border-primary/55 bg-primary/18 text-foreground'
                      : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {c.name}
                </button>
              )
            })
          )}
        </div>

        {onTaxonomyRefresh && supabase ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              New category
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <FieldLabel htmlFor={p('new-cat-name')}>Name</FieldLabel>
                <FieldInput
                  id={p('new-cat-name')}
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
                <FieldLabel htmlFor={p('new-cat-slug')}>Slug</FieldLabel>
                <FieldInput
                  id={p('new-cat-slug')}
                  value={newCatSlug}
                  onChange={(e) => setNewCatSlug(e.target.value.toLowerCase())}
                  placeholder="genre"
                />
              </div>
            </div>
            <FieldError>{newCatErr}</FieldError>
            <Button
              type="button"
              size="sm"
              className="w-full rounded-lg sm:w-auto"
              disabled={newCatBusy}
              onClick={() => void createCategoryInline()}
            >
              {newCatBusy ? 'Creating…' : 'Create & attach category'}
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-border bg-card/70 p-4">
        <h3 className="text-sm font-medium text-foreground">Tags</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Grouped by category. Create a tag below — it will be attached to this video automatically.
        </p>
        <div className="mt-4 space-y-4">
          {categories.map((c) => {
            const list = tagsByCategory.get(c.id) ?? []
            if (list.length === 0) return null
            return (
              <div key={c.id}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {c.name}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {list.map((t) => {
                    const on = editor.tagIds.has(t.id)
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleTag(t.id)}
                        className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                          on
                            ? 'border-primary/45 bg-primary/12 text-foreground'
                            : 'border-border bg-muted/40 text-muted-foreground hover:border-primary/25'
                        }`}
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

        {onTaxonomyRefresh && supabase ? (
          <div className="mt-4 space-y-2 border-t border-border pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">New tag</p>
            {categories.length === 0 ? (
              <p className="text-xs text-muted-foreground">Create a category first.</p>
            ) : (
              <>
                <div className="space-y-1">
                  <FieldLabel htmlFor={p('new-tag-cat')}>Category</FieldLabel>
                  <select
                    id={p('new-tag-cat')}
                    value={newTagCategoryId}
                    onChange={(e) => setNewTagCategoryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <FieldLabel htmlFor={p('new-tag-name')}>Name</FieldLabel>
                  <FieldInput
                    id={p('new-tag-name')}
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
                  <FieldLabel htmlFor={p('new-tag-slug')}>Slug</FieldLabel>
                  <FieldInput
                    id={p('new-tag-slug')}
                    value={newTagSlug}
                    onChange={(e) => setNewTagSlug(e.target.value.toLowerCase())}
                    placeholder="acoustic"
                  />
                </div>
                <FieldError>{newTagErr}</FieldError>
                <Button
                  type="button"
                  size="sm"
                  className="w-full rounded-lg sm:w-auto"
                  disabled={newTagBusy || !newTagCategoryId}
                  onClick={() => void createTagInline()}
                >
                  {newTagBusy ? 'Creating…' : 'Create & attach tag'}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </section>

      <FieldError>{formError}</FieldError>

      {showBrowse && onPickerOpenChange ? (
        <BucketPathPicker
          open={pickerOpen}
          onClose={() => onPickerOpenChange(false)}
          existingPaths={existingPaths}
          onPick={(path) => {
            setEditor((x) => ({ ...x, storage_path: path }))
            onPickerOpenChange(false)
          }}
          mode="single"
          title="Pick storage path"
        />
      ) : null}
    </>
  )
}
