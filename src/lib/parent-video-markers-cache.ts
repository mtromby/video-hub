import type { SupabaseClient } from '@supabase/supabase-js'

import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import { resolveCatalogVideoForFeedItem } from '@/lib/resolve-catalog-video-for-feed-item'
import type { VideoItem } from '@/types/video'

export type ParentVideoClipMarkerRow = {
  id: string
  start_seconds: number
  title: string
}

function markersCacheKey(item: VideoItem): string | null {
  const pid = item.parentVideoId?.trim()
  if (pid) return `v:${pid}`
  const path = storagePathFromVideoSrc(item.src)
  if (path) return `p:${path}`
  const cid = item.clipId?.trim()
  if (cid) return `c:${cid}`
  return null
}

async function fetchMarkersForItem(
  supabase: SupabaseClient,
  item: VideoItem
): Promise<ParentVideoClipMarkerRow[]> {
  const resolved = await resolveCatalogVideoForFeedItem(supabase, item)
  if (!resolved.ok) return []
  const { data, error } = await supabase
    .from('clips')
    .select('id, start_seconds, title')
    .eq('video_id', resolved.videoId)
    .order('start_seconds', { ascending: true })
  if (error || !data) return []
  return (data as { id: string; start_seconds: number; title: string }[]).map((r) => ({
    id: r.id,
    start_seconds: Number(r.start_seconds),
    title: r.title?.trim() || 'Clip',
  }))
}

const resultCache = new Map<string, ParentVideoClipMarkerRow[]>()
const inflight = new Map<string, Promise<ParentVideoClipMarkerRow[]>>()

/**
 * One clips query per parent video (or storage path), shared by all feed slides that use the same file.
 */
export function getParentVideoMarkersCached(
  supabase: SupabaseClient,
  item: VideoItem
): Promise<ParentVideoClipMarkerRow[]> {
  const key = markersCacheKey(item)
  if (!key) return fetchMarkersForItem(supabase, item)

  const cached = resultCache.get(key)
  if (cached) return Promise.resolve(cached)

  const pending = inflight.get(key)
  if (pending) return pending

  const p = fetchMarkersForItem(supabase, item)
    .then((markers) => {
      resultCache.set(key, markers)
      return markers
    })
    .finally(() => {
      inflight.delete(key)
    })
  inflight.set(key, p)
  return p
}
