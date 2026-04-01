import { useCallback, useEffect, useMemo, useState } from 'react'

import { feedItemFilterKey } from '@/lib/feed-item-filter-key'
import { normalizeCatalogPerformers } from '@/lib/normalize-catalog-performer'
import { getSupabase } from '@/lib/supabase'
import type { FeedPathAnnotation } from '@/types/feed-filters'
import type { CatalogCategory, CatalogPerformer, CatalogTag } from '@/types/catalog'
import type { VideoItem } from '@/types/video'

type LoadState = {
  loading: boolean
  error: string | null
  categories: CatalogCategory[]
  tags: CatalogTag[]
  performers: CatalogPerformer[]
  /** Keyed by feedItemFilterKey(item). */
  annotationByFeedKey: Map<string, FeedPathAnnotation>
}

const empty: LoadState = {
  loading: false,
  error: null,
  categories: [],
  tags: [],
  performers: [],
  annotationByFeedKey: new Map(),
}

export function useFeedCatalogFilterData(videos: VideoItem[]) {
  const keysKey = useMemo(() => {
    const keys = new Set<string>()
    for (const v of videos) {
      keys.add(feedItemFilterKey(v))
    }
    return JSON.stringify([...keys].sort())
  }, [videos])

  const [state, setState] = useState<LoadState>(empty)

  const reload = useCallback(async () => {
    const feedKeys = JSON.parse(keysKey) as string[]
    const paths = new Set<string>()
    const clipIds: string[] = []
    for (const k of feedKeys) {
      if (k.startsWith('path:')) {
        paths.add(k.slice('path:'.length))
      } else if (k.startsWith('clip:')) {
        clipIds.push(k.slice('clip:'.length))
      }
    }

    const emptyAnnotations = (): Map<string, FeedPathAnnotation> =>
      new Map(
        feedKeys.map((key) => [
          key,
          {
            performerIds: new Set<string>(),
            categoryIds: new Set<string>(),
            tagIds: new Set<string>(),
          },
        ])
      )

    if (feedKeys.length === 0) {
      setState({ ...empty, loading: false, annotationByFeedKey: new Map() })
      return
    }

    const supabase = getSupabase()

    if (!supabase) {
      setState({
        ...empty,
        loading: false,
        error: null,
        annotationByFeedKey: emptyAnnotations(),
      })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    const [cRes, tRes, pRes, vRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
      paths.size > 0
        ? supabase.from('videos').select('id, storage_path').in('storage_path', [...paths])
        : Promise.resolve({ data: [], error: null } as const),
    ])

    if (cRes.error || tRes.error || pRes.error || vRes.error) {
      setState({
        ...empty,
        loading: false,
        error:
          cRes.error?.message ??
          tRes.error?.message ??
          pRes.error?.message ??
          vRes.error?.message ??
          'Failed to load catalog',
      })
      return
    }

    const categories = (cRes.data as CatalogCategory[]) ?? []
    const tags = (tRes.data as CatalogTag[]) ?? []
    const performers = normalizeCatalogPerformers(pRes.data)
    const rows = (vRes.data as { id: string; storage_path: string }[]) ?? []

    const pathByVideoId = new Map<string, string>()
    for (const r of rows) {
      pathByVideoId.set(r.id, r.storage_path)
    }
    const videoIds = rows.map((r) => r.id)

    const byKey = emptyAnnotations()

    if (videoIds.length > 0) {
      const [vpRes, vcRes, vtRes] = await Promise.all([
        supabase.from('video_performers').select('video_id, performer_id').in('video_id', videoIds),
        supabase.from('video_categories').select('video_id, category_id').in('video_id', videoIds),
        supabase.from('video_tags').select('video_id, tag_id').in('video_id', videoIds),
      ])
      if (vpRes.error || vcRes.error || vtRes.error) {
        setState({
          ...empty,
          loading: false,
          error:
            vpRes.error?.message ?? vcRes.error?.message ?? vtRes.error?.message ?? 'Failed to load links',
        })
        return
      }
      const addPath = (videoId: string, fn: (ann: FeedPathAnnotation) => void) => {
        const path = pathByVideoId.get(videoId)
        if (!path) return
        const ann = byKey.get(`path:${path}`)
        if (ann) fn(ann)
      }
      for (const r of vpRes.data ?? []) {
        const row = r as { video_id: string; performer_id: string }
        addPath(row.video_id, (a) => a.performerIds.add(row.performer_id))
      }
      for (const r of vcRes.data ?? []) {
        const row = r as { video_id: string; category_id: string }
        addPath(row.video_id, (a) => a.categoryIds.add(row.category_id))
      }
      for (const r of vtRes.data ?? []) {
        const row = r as { video_id: string; tag_id: string }
        addPath(row.video_id, (a) => a.tagIds.add(row.tag_id))
      }
    }

    if (clipIds.length > 0) {
      const [clipsRes, ccRes, ctRes] = await Promise.all([
        supabase.from('clips').select('id, video_id').in('id', clipIds),
        supabase.from('clip_categories').select('clip_id, category_id').in('clip_id', clipIds),
        supabase.from('clip_tags').select('clip_id, tag_id').in('clip_id', clipIds),
      ])
      if (clipsRes.error || ccRes.error || ctRes.error) {
        setState({
          ...empty,
          loading: false,
          error:
            clipsRes.error?.message ?? ccRes.error?.message ?? ctRes.error?.message ?? 'Failed to load clips',
        })
        return
      }

      const clipRows = (clipsRes.data ?? []) as { id: string; video_id: string }[]
      const clipVideoIds = [...new Set(clipRows.map((c) => c.video_id))]

      let vpForClips: { video_id: string; performer_id: string }[] = []
      if (clipVideoIds.length > 0) {
        const vpRes = await supabase
          .from('video_performers')
          .select('video_id, performer_id')
          .in('video_id', clipVideoIds)
        if (vpRes.error) {
          setState({
            ...empty,
            loading: false,
            error: vpRes.error.message,
          })
          return
        }
        vpForClips = (vpRes.data ?? []) as { video_id: string; performer_id: string }[]
      }

      const performersByVideoId = new Map<string, Set<string>>()
      for (const r of vpForClips) {
        let s = performersByVideoId.get(r.video_id)
        if (!s) {
          s = new Set()
          performersByVideoId.set(r.video_id, s)
        }
        s.add(r.performer_id)
      }

      for (const c of clipRows) {
        const ann = byKey.get(`clip:${c.id}`)
        if (!ann) continue
        const pset = performersByVideoId.get(c.video_id)
        if (pset) {
          for (const pid of pset) {
            ann.performerIds.add(pid)
          }
        }
      }

      for (const r of ccRes.data ?? []) {
        const row = r as { clip_id: string; category_id: string }
        const ann = byKey.get(`clip:${row.clip_id}`)
        if (ann) ann.categoryIds.add(row.category_id)
      }
      for (const r of ctRes.data ?? []) {
        const row = r as { clip_id: string; tag_id: string }
        const ann = byKey.get(`clip:${row.clip_id}`)
        if (ann) ann.tagIds.add(row.tag_id)
      }
    }

    setState({
      loading: false,
      error: null,
      categories,
      tags,
      performers,
      annotationByFeedKey: byKey,
    })
  }, [keysKey])

  useEffect(() => {
    const id = window.setTimeout(() => void reload(), 0)
    return () => window.clearTimeout(id)
  }, [reload])

  const supabaseConfigured = getSupabase() !== null

  return {
    ...state,
    reload,
    supabaseConfigured,
  }
}
