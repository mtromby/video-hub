import type { SupabaseClient } from '@supabase/supabase-js'

import { isValidSlug } from '@/lib/slug'
import type { CatalogClipEditorState } from '@/types/catalog-editor'

export type PersistCatalogClipResult =
  | { ok: true; clipId: string }
  | { ok: false; message: string }

export async function persistCatalogClip(
  supabase: SupabaseClient,
  editor: CatalogClipEditorState
): Promise<PersistCatalogClipResult> {
  const videoId = editor.video_id.trim()
  const title = editor.title.trim()
  const slug = editor.slug.trim()
  const start = editor.start_seconds

  if (!videoId) {
    return { ok: false, message: 'Video is required.' }
  }
  if (!Number.isFinite(start) || start < 0) {
    return { ok: false, message: 'Start time must be a non-negative number.' }
  }
  if (!title) {
    return { ok: false, message: 'Title is required.' }
  }
  if (!isValidSlug(slug)) {
    return { ok: false, message: 'Slug must be lowercase letters, numbers, and hyphens.' }
  }

  let clipId = editor.id
  if (editor.id) {
    const { error: upErr } = await supabase
      .from('clips')
      .update({
        video_id: videoId,
        start_seconds: start,
        title,
        slug,
        description: editor.description.trim() || null,
      })
      .eq('id', editor.id)
    if (upErr) {
      return { ok: false, message: upErr.message }
    }
  } else {
    const { data: inserted, error: insErr } = await supabase
      .from('clips')
      .insert({
        video_id: videoId,
        start_seconds: start,
        title,
        slug,
        description: editor.description.trim() || null,
      })
      .select('id')
      .single()
    if (insErr) {
      return { ok: false, message: insErr.message }
    }
    clipId = (inserted as { id: string }).id
  }

  if (!clipId) {
    return { ok: false, message: 'Save failed.' }
  }

  await supabase.from('clip_categories').delete().eq('clip_id', clipId)
  await supabase.from('clip_tags').delete().eq('clip_id', clipId)

  const catRows = [...editor.categoryIds].map((category_id) => ({ clip_id: clipId, category_id }))
  if (catRows.length > 0) {
    const { error: e1 } = await supabase.from('clip_categories').insert(catRows)
    if (e1) {
      return { ok: false, message: e1.message }
    }
  }

  const tagRows = [...editor.tagIds].map((tag_id) => ({ clip_id: clipId, tag_id }))
  if (tagRows.length > 0) {
    const { error: e2 } = await supabase.from('clip_tags').insert(tagRows)
    if (e2) {
      return { ok: false, message: e2.message }
    }
  }

  return { ok: true, clipId }
}
