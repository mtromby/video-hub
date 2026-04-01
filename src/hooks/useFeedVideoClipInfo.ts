import { useEffect, useState } from 'react'

import { resolveCatalogVideoForFeedItem } from '@/lib/resolve-catalog-video-for-feed-item'
import { getSupabase } from '@/lib/supabase'
import type { VideoItem } from '@/types/video'

export type FeedVideoClipInfo = {
  loading: boolean
  error: string | null
  videoPerformers: string[]
  videoCategories: string[]
  videoTags: string[]
  clipCategories: string[]
  clipTags: string[]
}

const empty: FeedVideoClipInfo = {
  loading: false,
  error: null,
  videoPerformers: [],
  videoCategories: [],
  videoTags: [],
  clipCategories: [],
  clipTags: [],
}

/**
 * Loads catalog performers / categories / tags for the parent video and for a clip row (if any).
 */
export function useFeedVideoClipInfo(
  item: VideoItem,
  clipId: string | null,
  fetchEnabled: boolean
): FeedVideoClipInfo {
  const [state, setState] = useState<FeedVideoClipInfo>(empty)

  useEffect(() => {
    if (!fetchEnabled) {
      const t = window.setTimeout(() => setState(empty), 0)
      return () => window.clearTimeout(t)
    }
    const supabase = getSupabase()
    if (!supabase) {
      setState({ ...empty, error: 'Catalog unavailable' })
      return
    }

    let cancelled = false
    setState({ ...empty, loading: true })

    void (async () => {
      const resolved = await resolveCatalogVideoForFeedItem(supabase, item)
      if (cancelled) return
      if (!resolved.ok) {
        setState({ ...empty, error: resolved.message })
        return
      }
      const videoId = resolved.videoId

      const [vpRes, vcRes, vtRes] = await Promise.all([
        supabase.from('video_performers').select('performer_id').eq('video_id', videoId),
        supabase.from('video_categories').select('category_id').eq('video_id', videoId),
        supabase.from('video_tags').select('tag_id').eq('video_id', videoId),
      ])
      if (cancelled) return
      if (vpRes.error || vcRes.error || vtRes.error) {
        setState({
          ...empty,
          error:
            vpRes.error?.message ?? vcRes.error?.message ?? vtRes.error?.message ?? 'Load failed',
        })
        return
      }

      const performerIds = [...new Set((vpRes.data ?? []).map((r) => (r as { performer_id: string }).performer_id))]
      const categoryIds = [...new Set((vcRes.data ?? []).map((r) => (r as { category_id: string }).category_id))]
      const tagIds = [...new Set((vtRes.data ?? []).map((r) => (r as { tag_id: string }).tag_id))]

      const [perfRes, catRes, tagRes, ccRes, ctRes] = await Promise.all([
        performerIds.length
          ? supabase.from('performers').select('name').in('id', performerIds)
          : Promise.resolve({ data: [] as { name: string }[], error: null }),
        categoryIds.length
          ? supabase.from('categories').select('name').in('id', categoryIds)
          : Promise.resolve({ data: [] as { name: string }[], error: null }),
        tagIds.length
          ? supabase.from('tags').select('name').in('id', tagIds)
          : Promise.resolve({ data: [] as { name: string }[], error: null }),
        clipId
          ? supabase.from('clip_categories').select('category_id').eq('clip_id', clipId)
          : Promise.resolve({ data: [] as { category_id: string }[], error: null }),
        clipId
          ? supabase.from('clip_tags').select('tag_id').eq('clip_id', clipId)
          : Promise.resolve({ data: [] as { tag_id: string }[], error: null }),
      ])

      if (cancelled) return
      if (perfRes.error || catRes.error || tagRes.error || ccRes.error || ctRes.error) {
        setState({
          ...empty,
          error:
            perfRes.error?.message ??
            catRes.error?.message ??
            tagRes.error?.message ??
            ccRes.error?.message ??
            ctRes.error?.message ??
            'Load failed',
        })
        return
      }

      const videoPerformers = ((perfRes.data ?? []) as { name: string }[])
        .map((r) => r.name?.trim())
        .filter(Boolean) as string[]
      videoPerformers.sort((a, b) => a.localeCompare(b))

      const videoCategories = ((catRes.data ?? []) as { name: string }[])
        .map((r) => r.name?.trim())
        .filter(Boolean) as string[]
      videoCategories.sort((a, b) => a.localeCompare(b))

      const videoTags = ((tagRes.data ?? []) as { name: string }[])
        .map((r) => r.name?.trim())
        .filter(Boolean) as string[]
      videoTags.sort((a, b) => a.localeCompare(b))

      const clipCatIds = [...new Set((ccRes.data ?? []).map((r) => (r as { category_id: string }).category_id))]
      const clipTagIds = [...new Set((ctRes.data ?? []).map((r) => (r as { tag_id: string }).tag_id))]

      const [clipCatRes, clipTagRes] = await Promise.all([
        clipCatIds.length
          ? supabase.from('categories').select('name').in('id', clipCatIds)
          : Promise.resolve({ data: [] as { name: string }[], error: null }),
        clipTagIds.length
          ? supabase.from('tags').select('name').in('id', clipTagIds)
          : Promise.resolve({ data: [] as { name: string }[], error: null }),
      ])

      if (cancelled) return
      if (clipCatRes.error || clipTagRes.error) {
        setState({
          ...empty,
          error: clipCatRes.error?.message ?? clipTagRes.error?.message ?? 'Load failed',
        })
        return
      }

      const clipCategories = ((clipCatRes.data ?? []) as { name: string }[])
        .map((r) => r.name?.trim())
        .filter(Boolean) as string[]
      clipCategories.sort((a, b) => a.localeCompare(b))

      const clipTags = ((clipTagRes.data ?? []) as { name: string }[])
        .map((r) => r.name?.trim())
        .filter(Boolean) as string[]
      clipTags.sort((a, b) => a.localeCompare(b))

      setState({
        loading: false,
        error: null,
        videoPerformers,
        videoCategories,
        videoTags,
        clipCategories,
        clipTags,
      })
    })()

    return () => {
      cancelled = true
    }
  }, [item.id, item.src, item.clipId, item.parentVideoId, clipId, fetchEnabled])

  return state
}
