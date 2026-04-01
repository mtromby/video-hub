import { useCallback, useEffect, useState, type FormEvent } from 'react'

import { Button } from '@/components/ui/button'
import { FieldError, FieldInput, FieldLabel } from '@/components/admin/field'
import { getSupabase } from '@/lib/supabase'
import { isValidSlug, slugify } from '@/lib/slug'
import type { CatalogCategory } from '@/types/catalog'

export function CategoriesPanel() {
  const supabase = getSupabase()!
  const [rows, setRows] = useState<CatalogCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [sortOrder, setSortOrder] = useState('0')
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSort, setEditSort] = useState('0')
  const [editError, setEditError] = useState<string | null>(null)

  const load = useCallback(async () => {
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
    setRows((data as CatalogCategory[]) ?? [])
  }, [supabase])

  useEffect(() => {
    const t = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(t)
  }, [load])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const s = slug.trim()
    if (!name.trim()) {
      setFormError('Name is required.')
      return
    }
    if (!isValidSlug(s)) {
      setFormError('Slug must be lowercase letters, numbers, and hyphens (e.g. my-genre).')
      return
    }
    const so = Number.parseInt(sortOrder, 10)
    setSaving(true)
    const { error: err } = await supabase.from('categories').insert({
      name: name.trim(),
      slug: s,
      description: description.trim() || null,
      sort_order: Number.isFinite(so) ? so : 0,
    })
    setSaving(false)
    if (err) {
      setFormError(err.message)
      return
    }
    setName('')
    setSlug('')
    setDescription('')
    setSortOrder('0')
    void load()
  }

  function startEdit(c: CatalogCategory) {
    setEditingId(c.id)
    setEditName(c.name)
    setEditSlug(c.slug)
    setEditDescription(c.description ?? '')
    setEditSort(String(c.sort_order))
    setEditError(null)
  }

  async function saveEdit() {
    if (!editingId) return
    setEditError(null)
    if (!editName.trim()) {
      setEditError('Name is required.')
      return
    }
    if (!isValidSlug(editSlug.trim())) {
      setEditError('Invalid slug format.')
      return
    }
    const so = Number.parseInt(editSort, 10)
    setSaving(true)
    const { error: err } = await supabase
      .from('categories')
      .update({
        name: editName.trim(),
        slug: editSlug.trim(),
        description: editDescription.trim() || null,
        sort_order: Number.isFinite(so) ? so : 0,
      })
      .eq('id', editingId)
    setSaving(false)
    if (err) {
      setEditError(err.message)
      return
    }
    setEditingId(null)
    void load()
  }

  async function remove(id: string, label: string) {
    if (!confirm(`Delete category “${label}”? Tags in this category will be removed (cascade).`)) return
    const { error: err } = await supabase.from('categories').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    void load()
  }

  return (
    <div className="flex flex-col gap-6 pb-8">
      <div>
        <h2 className="text-lg font-semibold text-white">Categories</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Top-level groups. Tags belong to one category; videos can link many categories.
        </p>
      </div>

      <form
        onSubmit={onCreate}
        className="rounded-2xl border border-white/10 bg-zinc-950/80 p-4 space-y-3"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Add category</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel htmlFor="cat-name">Name</FieldLabel>
            <FieldInput
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (!slug.trim() && name.trim()) setSlug(slugify(name))
              }}
              placeholder="e.g. Genre"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="cat-slug">Slug</FieldLabel>
            <FieldInput
              id="cat-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder="genre"
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="cat-sort">Sort order</FieldLabel>
            <FieldInput
              id="cat-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <FieldLabel htmlFor="cat-desc">Description (optional)</FieldLabel>
            <FieldInput
              id="cat-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Shown in admin only for now"
            />
          </div>
        </div>
        <FieldError>{formError}</FieldError>
        <Button
          type="submit"
          disabled={saving}
          className="w-full rounded-xl bg-violet-600 text-white hover:bg-violet-500"
        >
          {saving ? 'Saving…' : 'Add category'}
        </Button>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="rounded-2xl border border-white/10 bg-zinc-950/60 p-3"
            >
              {editingId === c.id ? (
                <div className="space-y-2">
                  <FieldLabel>Name</FieldLabel>
                  <FieldInput value={editName} onChange={(e) => setEditName(e.target.value)} />
                  <FieldLabel>Slug</FieldLabel>
                  <FieldInput value={editSlug} onChange={(e) => setEditSlug(e.target.value.toLowerCase())} />
                  <FieldLabel>Sort</FieldLabel>
                  <FieldInput value={editSort} onChange={(e) => setEditSort(e.target.value)} type="number" />
                  <FieldLabel>Description</FieldLabel>
                  <FieldInput value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                  <FieldError>{editError}</FieldError>
                  <div className="flex gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      className="rounded-lg bg-violet-600 text-white"
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
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{c.name}</p>
                    <p className="font-mono text-xs text-violet-300/90">{c.slug}</p>
                    {c.description ? (
                      <p className="mt-1 text-xs text-zinc-500">{c.description}</p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-zinc-600">Sort: {c.sort_order}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-white/15 bg-transparent text-xs text-zinc-200"
                      onClick={() => startEdit(c)}
                    >
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-500/30 bg-transparent text-xs text-red-400 hover:bg-red-500/10"
                      onClick={() => void remove(c.id, c.name)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
