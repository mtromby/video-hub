import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

import { FieldError } from '@/components/admin/field'
import { PerformerFormFields, type PerformerFormFieldValues } from '@/components/performer/PerformerFormFields'
import { Button } from '@/components/ui/button'
import { getSupabase } from '@/lib/supabase'
import { isValidSlug, slugify } from '@/lib/slug'
import type { CatalogPerformer } from '@/types/catalog'

function emptyValues(): PerformerFormFieldValues {
  return { name: '', slug: '', imageUrl: '' }
}

function valuesFromPerformer(p: CatalogPerformer): PerformerFormFieldValues {
  return {
    name: p.name,
    slug: p.slug,
    imageUrl: p.image_url?.trim() ?? '',
  }
}

type ManagePerformerDialogProps = {
  open: boolean
  onClose: () => void
  /** When null, dialog creates a new performer. */
  performer: CatalogPerformer | null
  onSaved: () => void | Promise<void>
}

export function ManagePerformerDialog({
  open,
  onClose,
  performer,
  onSaved,
}: ManagePerformerDialogProps) {
  const supabase = getSupabase()
  const [values, setValues] = useState<PerformerFormFieldValues>(emptyValues)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => {
      setErr(null)
      setValues(performer ? valuesFromPerformer(performer) : emptyValues())
    }, 0)
    return () => window.clearTimeout(t)
  }, [open, performer])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  async function onSubmit() {
    setErr(null)
    if (!supabase) {
      setErr('Supabase is not configured.')
      return
    }
    const name = values.name.trim()
    if (!name) {
      setErr('Name is required.')
      return
    }
    const slug = (values.slug.trim() || slugify(name)).toLowerCase()
    if (!isValidSlug(slug)) {
      setErr('Slug must be lowercase letters, numbers, and hyphens.')
      return
    }
    const image_url = values.imageUrl.trim() || null

    setBusy(true)
    if (performer) {
      const { error } = await supabase
        .from('performers')
        .update({ name, slug, image_url })
        .eq('id', performer.id)
      setBusy(false)
      if (error) {
        setErr(error.message)
        return
      }
    } else {
      const { error } = await supabase.from('performers').insert({ name, slug, image_url })
      setBusy(false)
      if (error) {
        setErr(error.message)
        return
      }
    }
    await onSaved()
    onClose()
  }

  if (!open || typeof document === 'undefined') {
    return null
  }

  const title = performer ? 'Edit performer' : 'New performer'
  const idPrefix = performer ? `edit-perf-${performer.id}` : 'new-perf-dialog'

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center"
      role="presentation"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-sm dark:bg-black/70"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-performer-title"
        className="relative flex max-h-[min(88dvh,560px)] w-full max-w-lg flex-col rounded-t-3xl border border-primary/25 bg-card shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3 pr-2">
          <h2 id="manage-performer-title" className="text-base font-medium text-foreground">
            {title}
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
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-muted/30 p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Profile
              </p>
              <div className="mt-3">
                <PerformerFormFields
                  idPrefix={idPrefix}
                  values={values}
                  onChange={setValues}
                  onNameBlurSlug={() => {
                    setValues((v) =>
                      !v.slug.trim() && v.name.trim() ? { ...v, slug: slugify(v.name) } : v
                    )
                  }}
                />
              </div>
              <FieldError>{err}</FieldError>
            </section>

            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
                Cancel
              </Button>
              <Button type="button" disabled={busy} onClick={() => void onSubmit()}>
                {busy ? 'Saving…' : performer ? 'Save changes' : 'Create performer'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
