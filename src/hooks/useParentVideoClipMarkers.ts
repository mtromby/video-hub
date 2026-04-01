import { useEffect, useMemo, useState } from 'react'

import { getParentVideoMarkersCached } from '@/lib/parent-video-markers-cache'
import { getSupabase } from '@/lib/supabase'
import type { VideoItem } from '@/types/video'

export type FeedClipMarker = {
  id: string
  start_seconds: number
  title: string
}

/**
 * Loads all catalog clips for the parent video backing this feed item (full file timeline).
 */
export function useParentVideoClipMarkers(item: VideoItem, fetchEnabled: boolean) {
  const cacheDeps = useMemo(
    () =>
      `${item.parentVideoId?.trim() ?? ''}\u0000${item.src}\u0000${item.clipId?.trim() ?? ''}`,
    [item.parentVideoId, item.src, item.clipId]
  )
  const [markers, setMarkers] = useState<FeedClipMarker[]>([])

  useEffect(() => {
    if (!fetchEnabled) {
      const t = window.setTimeout(() => setMarkers([]), 0)
      return () => window.clearTimeout(t)
    }
    const supabase = getSupabase()
    if (!supabase) {
      const t = window.setTimeout(() => setMarkers([]), 0)
      return () => window.clearTimeout(t)
    }
    let cancelled = false
    void getParentVideoMarkersCached(supabase, item).then((rows) => {
      if (!cancelled) setMarkers(rows)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- item fields that affect markers are in cacheDeps
  }, [fetchEnabled, cacheDeps])

  return markers
}
