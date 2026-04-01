import { useCallback, useEffect, useState } from 'react'

import {
  getGcsListPrefix,
  getGcsPublicBaseUrl,
  getUseGcsXmlList,
  getVideoManifestPath,
} from '@/lib/env'
import {
  gcsKeysToVideoItems,
  listGcsVideoKeysViaXml,
  parseGcsBucketFromPublicBase,
} from '@/lib/gcs-xml-list'
import { parseInlineVideoSources } from '@/lib/inline-video-sources'
import { shuffled } from '@/lib/shuffle-array'
import type { VideoItem, VideoManifestEntry } from '@/types/video'

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function normalizeEntry(entry: VideoManifestEntry, index: number, base: string): VideoItem {
  if (typeof entry === 'string') {
    const path = entry.replace(/^\/+/, '')
    return {
      id: `${index}-${path}`,
      src: `${base}/${path}`,
    }
  }
  const path = entry.src.replace(/^\/+/, '')
  return {
    id: `${index}-${path}`,
    src: `${base}/${path}`,
    title: entry.title,
    performer: entry.performer,
  }
}

function parseManifest(json: unknown, base: string): VideoItem[] {
  if (!Array.isArray(json)) return []
  return json
    .filter((x): x is VideoManifestEntry => {
      if (typeof x === 'string') return x.length > 0
      return (
        !!x &&
        typeof x === 'object' &&
        'src' in x &&
        typeof (x as { src: unknown }).src === 'string'
      )
    })
    .map((e, i) => normalizeEntry(e, i, base))
}

export function useVideoManifest() {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    const { videos: fromEnv, error: envError } = parseInlineVideoSources()
    if (envError) {
      setVideos([])
      setError(envError)
      setLoading(false)
      return
    }
    if (fromEnv.length > 0) {
      setVideos(shuffled(fromEnv))
      setError(null)
      setLoading(false)
      return
    }

    const base = getGcsPublicBaseUrl()
    if (!base) {
      setVideos([])
      setError(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    if (getUseGcsXmlList()) {
      try {
        const { keys, error: listErr } = await listGcsVideoKeysViaXml(
          base,
          getGcsListPrefix(),
          { signal }
        )
        if (signal?.aborted) return
        if (listErr) {
          setVideos([])
          setError(listErr)
          return
        }
        const items = shuffled(gcsKeysToVideoItems(base, keys))
        setVideos(items)
        if (items.length === 0) {
          setError(
            'Bucket listing returned no video files (.mp4, .webm, .mov, …). Check VITE_GCS_LIST_PREFIX and IAM/CORS.'
          )
        } else {
          setError(null)
        }
      } catch (e) {
        if (isAbortError(e)) return
        setVideos([])
        setError(e instanceof Error ? e.message : 'Bucket listing failed.')
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
      return
    }

    const manifestUrl = `${base}/${getVideoManifestPath()}`

    try {
      const res = await fetch(manifestUrl, { cache: 'no-store', signal })
      if (signal?.aborted) return

      if (res.status === 404 && parseGcsBucketFromPublicBase(base)) {
        const { keys, error: listErr } = await listGcsVideoKeysViaXml(
          base,
          getGcsListPrefix(),
          { signal }
        )
        if (signal?.aborted) return

        if (!listErr && keys.length > 0) {
          setVideos(shuffled(gcsKeysToVideoItems(base, keys)))
          setError(null)
          return
        }

        setVideos([])
        if (listErr) {
          setError(
            `manifest.json was not found (404). Tried listing the bucket instead: ${listErr} You can upload manifest.json to the bucket root, set VITE_GCS_USE_XML_LIST=true with public list IAM, or use VITE_VIDEO_SOURCES.`
          )
        } else {
          setError(
            'manifest.json was not found (404), and bucket listing found no video files (.mp4, .webm, …). Upload manifest.json, put videos in the bucket, or set VITE_VIDEO_SOURCES.'
          )
        }
        return
      }

      if (!res.ok) {
        throw new Error(
          `Manifest request failed (${res.status}). Check the file name (VITE_VIDEO_MANIFEST_PATH) and that the object is public.`
        )
      }

      const data: unknown = await res.json()
      if (signal?.aborted) return

      const items = shuffled(parseManifest(data, base))
      setVideos(items)
      if (items.length === 0) {
        setError('Manifest is empty or invalid JSON array.')
      } else {
        setError(null)
      }
    } catch (e) {
      if (isAbortError(e)) return
      setVideos([])
      setError(e instanceof Error ? e.message : 'Failed to load manifest.')
    } finally {
      if (!signal?.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const ac = new AbortController()
    void load(ac.signal)
    return () => ac.abort()
  }, [load])

  return { videos, loading, error, reload: () => void load() }
}
