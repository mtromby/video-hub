import type { VideoItem } from '@/types/video'

const VIDEO_EXT = /\.(mp4|webm|mov|m4v|ogv|ogg|mkv)$/i

function trimSlash(s: string) {
  return s.replace(/\/+$/, '')
}

/**
 * Listing uses https://storage.googleapis.com/BUCKET — only the default public host
 * with a single path segment (bucket name) is supported.
 */
export function parseGcsBucketFromPublicBase(base: string): string | null {
  let u: URL
  try {
    u = new URL(base)
  } catch {
    return null
  }
  if (u.hostname !== 'storage.googleapis.com') return null
  const path = u.pathname.replace(/^\/+|\/+$/g, '')
  if (!path || path.includes('/')) return null
  return decodeURIComponent(path)
}

/** Build a public object URL with correct encoding per path segment. */
export function publicGcsObjectUrl(publicBase: string, objectKey: string): string {
  const base = trimSlash(publicBase)
  const path = objectKey
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  return `${base}/${path}`
}

function keysFromListXml(xml: string): {
  keys: string[]
  truncated: boolean
  nextMarker: string | null
} {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.querySelector('parsererror')) {
    return { keys: [], truncated: false, nextMarker: null }
  }

  const keys: string[] = []
  for (const keyEl of doc.getElementsByTagName('Key')) {
    const key = (keyEl.textContent ?? '').trim()
    if (key && !key.endsWith('/')) keys.push(key)
  }

  const truncated = doc.getElementsByTagName('IsTruncated')[0]?.textContent === 'true'
  const nextMarker =
    doc.getElementsByTagName('NextMarker')[0]?.textContent?.trim() || null

  return { keys, truncated, nextMarker }
}

/**
 * Lists object names via the XML API (same as console-style bucket browsing when
 * access is public). Filters to common video extensions.
 */
export async function listGcsVideoKeysViaXml(
  publicBase: string,
  listPrefix: string | undefined,
  options?: { signal?: AbortSignal }
): Promise<{ keys: string[]; error: string | null }> {
  const signal = options?.signal
  const bucket = parseGcsBucketFromPublicBase(publicBase)
  if (!bucket) {
    return {
      keys: [],
      error:
        'Bucket listing needs VITE_GCS_PUBLIC_BASE_URL=https://storage.googleapis.com/YOUR_BUCKET (bucket name only — no folder in the URL). Use a manifest, or VITE_GCS_LIST_PREFIX for a virtual folder.',
    }
  }

  const prefix = listPrefix?.replace(/^\//, '') ?? ''
  const collected: string[] = []
  let marker: string | undefined
  const maxPages = 50

  for (let page = 0; page < maxPages; page++) {
    if (signal?.aborted) {
      return { keys: [], error: null }
    }

    const u = new URL(`https://storage.googleapis.com/${encodeURIComponent(bucket)}`)
    if (prefix) u.searchParams.set('prefix', prefix)
    u.searchParams.set('max-keys', '1000')
    if (marker) u.searchParams.set('marker', marker)

    const res = await fetch(u.toString(), { cache: 'no-store', signal })

    if (res.status === 403) {
      return {
        keys: [],
        error:
          'Listing returned 403. The browser cannot use your console login. Grant anonymous list+read on the bucket (IAM), or use manifest.json / VITE_VIDEO_SOURCES. Do not put service account keys in the frontend.',
      }
    }
    if (!res.ok) {
      return {
        keys: [],
        error: `Bucket listing failed (HTTP ${res.status}).`,
      }
    }

    const text = await res.text()
    const { keys, truncated, nextMarker } = keysFromListXml(text)

    if (keys.length === 0 && !truncated && collected.length === 0) {
      const code = text.match(/<Code>([^<]+)<\/Code>/)?.[1]
      if (code) {
        return { keys: [], error: `GCS: ${code}` }
      }
    }

    collected.push(...keys)

    if (!truncated) break

    const lastKey = keys[keys.length - 1]
    marker = nextMarker || lastKey
    if (!marker) break
  }

  const videoKeys = collected.filter((k) => VIDEO_EXT.test(k))
  return { keys: videoKeys, error: null }
}

export function gcsKeysToVideoItems(publicBase: string, keys: string[]): VideoItem[] {
  return keys.map((key, i) => ({
    id: `gcs-xml-${i}-${key}`,
    src: publicGcsObjectUrl(publicBase, key),
  }))
}
