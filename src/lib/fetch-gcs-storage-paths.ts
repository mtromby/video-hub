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
import type { VideoItem, VideoManifestEntry } from '@/types/video'

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

function normalizeEntry(entry: VideoManifestEntry, base: string): VideoItem {
  if (typeof entry === 'string') {
    const path = entry.replace(/^\/+/, '')
    return {
      id: path,
      src: `${base}/${path}`,
    }
  }
  const path = entry.src.replace(/^\/+/, '')
  return {
    id: path,
    src: `${base}/${path}`,
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
    .map((e) => normalizeEntry(e, base))
}

/** Derive GCS object key from manifest/video src and configured base URL. */
export function storagePathFromVideoSrc(src: string): string | null {
  const base = getGcsPublicBaseUrl()
  if (base) {
    const b = base.replace(/\/+$/, '')
    const prefix = `${b}/`
    if (src.startsWith(prefix)) {
      try {
        return decodeURIComponent(src.slice(prefix.length))
      } catch {
        return src.slice(prefix.length)
      }
    }
  }
  try {
    const u = new URL(src)
    if (u.hostname === 'storage.googleapis.com') {
      const segs = u.pathname.split('/').filter(Boolean)
      if (segs.length >= 2) {
        return segs.slice(1).map((s) => decodeURIComponent(s)).join('/')
      }
    }
  } catch {
    /* ignore */
  }
  return null
}

/**
 * Lists video object keys the same way the feed does (inline env → manifest → XML list),
 * without shuffling. Used to pick storage_path when editing catalog videos.
 */
export async function fetchGcsVideoStoragePaths(options?: {
  signal?: AbortSignal
}): Promise<{ paths: string[]; error: string | null }> {
  const signal = options?.signal

  const { videos: fromEnv, error: envError } = parseInlineVideoSources()
  if (envError) return { paths: [], error: envError }
  if (fromEnv.length > 0) {
    const paths = fromEnv
      .map((v) => storagePathFromVideoSrc(v.src))
      .filter((p): p is string => Boolean(p))
    return { paths: [...new Set(paths)], error: null }
  }

  const base = getGcsPublicBaseUrl()
  if (!base) {
    return {
      paths: [],
      error:
        'Set VITE_GCS_PUBLIC_BASE_URL (and manifest or listing), or VITE_VIDEO_SOURCES, to load paths from your bucket.',
    }
  }

  if (getUseGcsXmlList()) {
    try {
      const { keys, error: listErr } = await listGcsVideoKeysViaXml(
        base,
        getGcsListPrefix(),
        { signal }
      )
      if (signal?.aborted) return { paths: [], error: null }
      if (listErr) return { paths: [], error: listErr }
      return { paths: keys, error: null }
    } catch (e) {
      if (isAbortError(e)) return { paths: [], error: null }
      return { paths: [], error: e instanceof Error ? e.message : 'Bucket listing failed.' }
    }
  }

  const manifestUrl = `${base}/${getVideoManifestPath()}`
  try {
    const res = await fetch(manifestUrl, { cache: 'no-store', signal })
    if (signal?.aborted) return { paths: [], error: null }

    if (res.status === 404 && parseGcsBucketFromPublicBase(base)) {
      const { keys, error: listErr } = await listGcsVideoKeysViaXml(
        base,
        getGcsListPrefix(),
        { signal }
      )
      if (signal?.aborted) return { paths: [], error: null }
      if (!listErr && keys.length > 0) return { paths: keys, error: null }
      return {
        paths: [],
        error:
          listErr ??
          'manifest.json was not found and bucket listing returned no video files.',
      }
    }

    if (!res.ok) {
      return {
        paths: [],
        error: `Manifest request failed (${res.status}).`,
      }
    }

    const data: unknown = await res.json()
    if (signal?.aborted) return { paths: [], error: null }

    const items = parseManifest(data, base)
    const paths = items
      .map((v) => storagePathFromVideoSrc(v.src))
      .filter((p): p is string => Boolean(p))
    return { paths: [...new Set(paths)], error: null }
  } catch (e) {
    if (isAbortError(e)) return { paths: [], error: null }
    return { paths: [], error: e instanceof Error ? e.message : 'Failed to load manifest.' }
  }
}

/** For display: public URL from storage path when base is set. */
export function publicUrlForStoragePath(storagePath: string): string | null {
  const base = getGcsPublicBaseUrl()
  if (!base) return null
  const items = gcsKeysToVideoItems(base, [storagePath])
  return items[0]?.src ?? null
}
