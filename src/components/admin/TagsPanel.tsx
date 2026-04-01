import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { FieldError, FieldInput, FieldLabel } from '@/components/admin/field'
import { getSupabase } from '@/lib/supabase'
import { isValidSlug, slugify } from '@/lib/slug'
import type { CatalogCategory, CatalogTag } from '@/types/catalog'

export function TagsPanel() {
  const supabase = getSupabase()!
  const [categories, setCategories] = useState<CatalogCategory[]>([])
  const [categoryId, setCategoryId] = useState<string>('')
  const [tags, setTags] = useState<CatalogTag[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTags, setLoadingTags] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const loadCategories = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('categories')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const list = (data as CatalogCategory[]) ?? []
    setCategories(list)
    setCategoryId((prev) => {
      if (prev && list.some((c) => c.id === prev)) return prev
      return list[0]?.id ?? ''
    })
  }, [supabase])

  const loadTags = useCallback(
    async (catId: string) => {
      if (!catId) {
        setTags([])
        return
      }
      setLoadingTags(true)
      const { data, error: err } = await supabase
        .from('tags')
        .select('*')
        .eq('category_id', catId)
        .order('name', { ascending: true })
      setLoadingTags(false)
      if (err) {
        setError(err.message)
        setTags([])
        return
      }
      setTags((data as CatalogTag[]) ?? [])
    },
    [supabase]
  )

  useEffect(() => {
    const t = window.setTimeout(() => void loadCategories(), 0)
    return () => window.clearTimeout(t)
  }, [loadCategories])

  useEffect(() => {
    const t = window.setTimeout(() => void loadTags(categoryId), 0)
    return () => window.clearTimeout(t)
  }, [categoryId, loadTags])

  const activeCategory = useMemo(
    () => categories.find((c) => c.id === categoryId),
    [categories, categoryId]
  )

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!categoryId) {
      setFormError('Create a category first.')
      return
    }
    const s = slug.trim()
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!isValidSlug(s)) {
      setFormError('Invalid slug (lowercase, hyphens).')
      return
    }
    setSaving(true)
    const { error: err } = await supabase.from('tags').insert({
      category_id: categoryId,
      name: name.trim(),
      slug: s,
    })
    setSaving(false)
    if (err) {
      setFormError(err.message)
      return
    }
    setName('')
    setSlug('')
    void loadTags(categoryId)
  }

  function startEdit(t: CatalogTag) {
    setEditingId(t.id)
    setEditName(t.name)
    setEditSlug(t.slug)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setEditError(null)
    if (!editName.trim() || !isValidSlug(editSlug.trim())) {
      setEditError('Check name and slug.')
      return
    }
    setSaving(true)
    const { error: err } = await supabase
      .from('tags')
      .update({ name: editName.trim(), slug: editSlug.trim() })
      .eq('id', editingId)
    setSaving(false)
    if (err) {
      setEditError(err.message)
      return
    }
    setEditingId(null)
    void loadTags(categoryId)
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete tag “${label}”?`)) return
    const { error: err } = await supabase.from('tags').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    void loadTags(categoryId)
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Tags</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Tags live inside a category. Videos link to individual tags.
        </p>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="tag-category">Category</FieldLabel>
        <select
          id="tag-category"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="h-10 w-full rounded-xl border border-white/10 bg-zinc-950 px-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
        >
          {categories.length === 0 ? (
            <option value="">No categories yet</option>
          ) : (
            categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))
          )}
        </select>
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 space-y-3"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Add tag {activeCategory ? `to “${activeCategory.name}”` : ''}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel htmlFor="tag-name">Name</FieldLabel>
            <FieldInput
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!slug.trim() && name.trim()) setSlug(slugify(name))
              }}
              placeholder="e.g. Acoustic"
              disabled={!categoryId}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel htmlFor="tag-slug">Slug</FieldLabel>
            <FieldInput
              id="tag-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="acoustic"
              disabled={!categoryId}
            />
          </div>
        </div>
        <FieldError>{formError}</FieldError>
        <Button
          type="submit"
          disabled={saving || !categoryId}
          className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          {saving ? 'Saving…' : 'Add tag'}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading categories…</p>
      ) : !categoryId ? (
        <p className="text-sm text-zinc-500">Add a category first to manage tags.</p>
      ) : loadingTags ? (
        <p className="text-sm text-zinc-500">Loading tags…</p>
      ) : (
        <ul className="space-y-2">
          {tags.map((t) => (
            <li
              key={t.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/60 p-3"
            >
              {editingId === t.id ? (
                <div className="space-y-2">
                  <FieldInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <FieldInput value={editSlug} onChange={(e) => setEditSlug(e.target.value.toLowerCase())} />
                  <FieldError>{editError}</FieldError>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-violet-600 text-white"
                      onClick={() => void saveEdit()}
                      disabled={saving}
                    >
                      Save
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-transparent text-zinc-300"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="font-mono text-xs text-violet-300/90">{t.slug}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-transparent text-xs text-zinc-200"
                      onClick={() => startEdit(t)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 text-xs text-red-400"
                      onClick={() => void remove(t.id, t.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {tags.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-zinc-500">
              No tags in this category yet.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  )
}
