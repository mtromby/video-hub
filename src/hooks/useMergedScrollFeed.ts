import { useCallback, useEffect, useMemo, useState } from 'react'

function newFeedOrderSalt(): string {
  if (typeof globalThis.crypto !== 'undefined' && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

import { publicUrlForStoragePath } from '@/lib/fetch-gcs-storage-paths'
import { getSupabase } from '@/lib/supabase'
import { stableShuffledById } from '@/lib/shuffle-array'
import type { VideoItem } from '@/types/video'

type ClipRow = {
  id: string
  video_id: string
  start_seconds: number
  title: string
  slug: string
  videos: { storage_path: string } | { storage_path: string }[] | null
}

function normalizeClipVideo(
  v: ClipRow['videos']
): { storage_path: string } | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] ?? null
  return v
}

export function useMergedScrollFeed(manifestVideos: VideoItem[]) {
  const [feedOrderSalt] = useState(newFeedOrderSalt)
  const [clipItems, setClipItems] = useState<VideoItem[]>([])
  const [clipsTick, setClipsTick] = useState(0)
  const [clipsError, setClipsError] = useState<string | null>(null)
  const [clipsLoading, setClipsLoading] = useState(false)

  const reloadClips = useCallback(() => {
    setClipsTick((t) => t + 1)
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setClipItems([])
      setClipsError(null)
      setClipsLoading(false)
      return
    }

    let cancelled = false
    setClipsLoading(true)
    void (async () => {
      try {
        const { data, error } = await supabase
          .from('clips')
          .select('id, video_id, start_seconds, title, slug, videos(storage_path)')
          .order('created_at', { ascending: false })

        if (cancelled) return
        if (error) {
          setClipItems([])
          setClipsError(error.message)
          return
        }

        const rows = (data ?? []) as ClipRow[]
        const next: VideoItem[] = []
        for (const row of rows) {
          const vid = normalizeClipVideo(row.videos)
          if (!vid?.storage_path) continue
          const src = publicUrlForStoragePath(vid.storage_path.trim())
          if (!src) continue
          next.push({
            id: `clip:${row.id}`,
            src,
            title: row.title,
            clipId: row.id,
            startSeconds: row.start_seconds,
            parentVideoId: row.video_id,
          })
        }
        setClipItems(next)
        setClipsError(null)
      } finally {
        if (!cancelled) setClipsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [clipsTick])

  const feedVideos = useMemo(
    () => stableShuffledById([...manifestVideos, ...clipItems], feedOrderSalt),
    [manifestVideos, clipItems, feedOrderSalt]
  )

  return { feedVideos, reloadClips, clipsError, clipsLoading }
}
