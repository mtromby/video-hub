import { FieldInput, FieldLabel, FieldTextarea } from '@/components/admin/field'

export type PerformerFormFieldValues = {
  name: string
  slug: string
  imageUrl: string
}

type PerformerFormFieldsProps = {
  idPrefix: string
  values: PerformerFormFieldValues
  onChange: (next: PerformerFormFieldValues) => void
  onNameBlurSlug?: () => void
}

export function PerformerFormFields({
  idPrefix,
  values,
  onChange,
  onNameBlurSlug,
}: PerformerFormFieldsProps) {
  const p = (s: string) => `${idPrefix}-${s}`

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <div className="space-y-1 sm:col-span-2">
        <FieldLabel htmlFor={p('perf-name')}>Name</FieldLabel>
        <FieldInput
          id={p('perf-name')}
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          onBlur={onNameBlurSlug}
          placeholder="e.g. Jane Doe"
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <FieldLabel htmlFor={p('perf-slug')}>Slug</FieldLabel>
        <FieldInput
          id={p('perf-slug')}
          value={values.slug}
          onChange={(e) => onChange({ ...values, slug: e.target.value.toLowerCase() })}
          placeholder="jane-doe"
        />
      </div>
      <div className="space-y-1 sm:col-span-2">
        <FieldLabel htmlFor={p('perf-image')}>Profile image URL</FieldLabel>
        <FieldTextarea
          id={p('perf-image')}
          value={values.imageUrl}
          onChange={(e) => onChange({ ...values, imageUrl: e.target.value })}
          placeholder="https://…"
          rows={2}
          className="resize-y font-mono text-[13px]"
        />
        <p className="text-[11px] text-zinc-500">Optional. Use a direct image link (HTTPS).</p>
      </div>
    </div>
  )
}
