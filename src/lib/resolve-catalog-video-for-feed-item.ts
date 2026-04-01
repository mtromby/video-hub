import type { SupabaseClient } from '@supabase/supabase-js'

import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import type { VideoItem } from '@/types/video'

export type ResolveCatalogVideoResult =
  | { ok: true; videoId: string }
  | { ok: false; message: string }

/**
 * Resolves the catalog `videos.id` for a feed row (manifest URL, clip row, etc.).
 */
export async function resolveCatalogVideoForFeedItem(
  supabase: SupabaseClient,
  item: VideoItem
): Promise<ResolveCatalogVideoResult> {
  let videoId = item.parentVideoId?.trim() ?? ''
  if (!videoId && item.clipId?.trim()) {
    const { data: clipRow, error: clipErr } = await supabase
      .from('clips')
      .select('video_id')
      .eq('id', item.clipId.trim())
      .maybeSingle()
    if (clipErr) return { ok: false, message: clipErr.message }
    if (clipRow) {
      videoId = (clipRow as { video_id: string }).video_id?.trim() ?? ''
    }
  }
  if (!videoId) {
    const path = storagePathFromVideoSrc(item.src)
    if (!path) {
      return {
        ok: false,
        message: 'Could not resolve storage path for this video. Add it to the catalog first.',
      }
    }
    const { data: row, error: ve } = await supabase
      .from('videos')
      .select('id')
      .eq('storage_path', path)
      .maybeSingle()
    if (ve) return { ok: false, message: ve.message }
    if (!row) {
      return {
        ok: false,
        message:
          'This video is not in the catalog yet. Use the catalog button to add it, then create a clip.',
      }
    }
    videoId = (row as { id: string }).id
  }
  return { ok: true, videoId }
}
