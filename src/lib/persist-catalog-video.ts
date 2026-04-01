import type { SupabaseClient } from '@supabase/supabase-js'

import { isValidSlug } from '@/lib/slug'
import type { CatalogVideoEditorState } from '@/types/catalog-editor'

export type PersistCatalogVideoResult =
  | { ok: true; videoId: string }
  | { ok: false; message: string }

export async function persistCatalogVideo(
  supabase: SupabaseClient,
  editor: CatalogVideoEditorState
): Promise<PersistCatalogVideoResult> {
  const path = editor.storage_path.trim()
  const title = editor.title.trim()
  const slug = editor.slug.trim()
  if (!path) {
    return { ok: false, message: 'Storage path is required (GCS object key).' }
  }
  if (!title) {
    return { ok: false, message: 'Title is required.' }
  }
  if (!isValidSlug(slug)) {
    return { ok: false, message: 'Slug must be lowercase letters, numbers, and hyphens.' }
  }

  let videoId = editor.id
  if (editor.id) {
    const { error: upErr } = await supabase
      .from('videos')
      .update({
        storage_path: path,
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
      .from('videos')
      .insert({
        storage_path: path,
        title,
        slug,
        description: editor.description.trim() || null,
      })
      .select('id')
      .single()
    if (insErr) {
      return { ok: false, message: insErr.message }
    }
    videoId = (inserted as { id: string }).id
  }

  if (!videoId) {
    return { ok: false, message: 'Save failed.' }
  }

  await supabase.from('video_categories').delete().eq('video_id', videoId)
  await supabase.from('video_tags').delete().eq('video_id', videoId)
  await supabase.from('video_performers').delete().eq('video_id', videoId)

  const perfRows = [...editor.performerIds].map((performer_id) => ({ video_id: videoId, performer_id }))
  if (perfRows.length > 0) {
    const { error: ep } = await supabase.from('video_performers').insert(perfRows)
    if (ep) {
      return { ok: false, message: ep.message }
    }
  }

  const catRows = [...editor.categoryIds].map((category_id) => ({ video_id: videoId, category_id }))
  if (catRows.length > 0) {
    const { error: e1 } = await supabase.from('video_categories').insert(catRows)
    if (e1) {
      return { ok: false, message: e1.message }
    }
  }

  const tagRows = [...editor.tagIds].map((tag_id) => ({ video_id: videoId, tag_id }))
  if (tagRows.length > 0) {
    const { error: e2 } = await supabase.from('video_tags').insert(tagRows)
    if (e2) {
      return { ok: false, message: e2.message }
    }
  }

  return { ok: true, videoId }
}
