function trimSlash(s: string) {
  return s.replace(/\/+$/, '')
}

/** Public base URL for your GCS bucket (no trailing slash). */
export function getGcsPublicBaseUrl(): string | null {
  const raw = import.meta.env.VITE_GCS_PUBLIC_BASE_URL as string | undefined
  if (!raw?.trim()) return null
  return trimSlash(raw.trim())
}

/** Path to JSON manifest inside the bucket (default: manifest.json). */
export function getVideoManifestPath(): string {
  const p = import.meta.env.VITE_VIDEO_MANIFEST_PATH as string | undefined
  const trimmed = p?.trim()
  return trimmed && trimmed.length > 0 ? trimmed.replace(/^\/+/, '') : 'manifest.json'
}

/** True if the user configured either a bucket base URL or inline video list. */
export function hasVideoBucketOrSourcesConfig(): boolean {
  if (getGcsPublicBaseUrl()) return true
  const raw = import.meta.env.VITE_VIDEO_SOURCES as string | undefined
  return Boolean(raw?.trim())
}

/** Use GCS XML List Bucket API (requires public list permission on the bucket). */
export function getUseGcsXmlList(): boolean {
  const v = import.meta.env.VITE_GCS_USE_XML_LIST as string | undefined
  if (!v) return false
  const t = v.trim().toLowerCase()
  return t === '1' || t === 'true' || t === 'yes'
}

/** Optional object key prefix when listing (e.g. uploads/). */
export function getGcsListPrefix(): string | undefined {
  const p = import.meta.env.VITE_GCS_LIST_PREFIX as string | undefined
  const t = p?.trim()
  return t && t.length > 0 ? t.replace(/^\//, '') : undefined
}

/**
 * Set to `anonymous` if GCS CORS returns Access-Control-Allow-Origin for your
 * app origin (helps some Safari/iOS builds with cross-origin media + Range).
 */
export function getVideoCrossOrigin(): 'anonymous' | 'use-credentials' | undefined {
  const v = (import.meta.env.VITE_VIDEO_CROSS_ORIGIN as string | undefined)
    ?.trim()
    .toLowerCase()
  if (v === 'anonymous' || v === 'use-credentials') return v
  return undefined
}
