import { useCallback, useEffect, useMemo, useState } from 'react'

import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
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
  annotationByPath: Map<string, FeedPathAnnotation>
}

const empty: LoadState = {
  loading: false,
  error: null,
  categories: [],
  tags: [],
  performers: [],
  annotationByPath: new Map(),
}

export function useFeedCatalogFilterData(videos: VideoItem[]) {
  const pathsKey = useMemo(() => {
    const s = new Set<string>()
    for (const v of videos) {
      const p = storagePathFromVideoSrc(v.src)
      if (p) s.add(p)
    }
    return JSON.stringify([...s].sort())
  }, [videos])

  const [state, setState] = useState<LoadState>(empty)

  const reload = useCallback(async () => {
    const paths = JSON.parse(pathsKey) as string[]
    const supabase = getSupabase()

    const emptyAnnotations = (): Map<string, FeedPathAnnotation> =>
      new Map(
        paths.map((p) => [
          p,
          {
            performerIds: new Set<string>(),
            categoryIds: new Set<string>(),
            tagIds: new Set<string>(),
          },
        ])
      )

    if (paths.length === 0) {
      setState({ ...empty, loading: false, annotationByPath: new Map() })
      return
    }

    if (!supabase) {
      setState({
        ...empty,
        loading: false,
        error: null,
        annotationByPath: emptyAnnotations(),
      })
      return
    }

    setState((prev) => ({ ...prev, loading: true, error: null }))

    const [cRes, tRes, pRes, vRes] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order', { ascending: true }).order('name'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('performers').select('*').order('name'),
      supabase.from('videos').select('id, storage_path').in('storage_path', paths),
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

    const byPath = new Map<string, FeedPathAnnotation>()
    for (const p of paths) {
      byPath.set(p, {
        performerIds: new Set<string>(),
        categoryIds: new Set<string>(),
        tagIds: new Set<string>(),
      })
    }

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
      const add = (videoId: string, fn: (ann: FeedPathAnnotation) => void) => {
        const path = pathByVideoId.get(videoId)
        if (!path) return
        const ann = byPath.get(path)
        if (ann) fn(ann)
      }
      for (const r of vpRes.data ?? []) {
        const row = r as { video_id: string; performer_id: string }
        add(row.video_id, (a) => a.performerIds.add(row.performer_id))
      }
      for (const r of vcRes.data ?? []) {
        const row = r as { video_id: string; category_id: string }
        add(row.video_id, (a) => a.categoryIds.add(row.category_id))
      }
      for (const r of vtRes.data ?? []) {
        const row = r as { video_id: string; tag_id: string }
        add(row.video_id, (a) => a.tagIds.add(row.tag_id))
      }
    }

    setState({
      loading: false,
      error: null,
      categories,
      tags,
      performers,
      annotationByPath: byPath,
    })
  }, [pathsKey])

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
