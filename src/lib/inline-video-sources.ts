import { getGcsPublicBaseUrl } from '@/lib/env'
import type { VideoItem } from '@/types/video'

/**
 * Comma-separated list in VITE_VIDEO_SOURCES:
 * - Full URLs: https://storage.googleapis.com/bucket/obj.mp4
 * - Or object paths (requires VITE_GCS_PUBLIC_BASE_URL): uploads/clip.mp4
 */
export function parseInlineVideoSources(): {
  videos: VideoItem[]
  error: string | null
} {
  const raw = import.meta.env.VITE_VIDEO_SOURCES as string | undefined
  if (!raw?.trim()) return { videos: [], error: null }

  const base = getGcsPublicBaseUrl()
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const videos: VideoItem[] = []

  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (/^https?:\/\//i.test(p)) {
      try {
        const u = new URL(p)
        if (u.protocol !== 'http:' && u.protocol !== 'https:') {
          return {
            videos: [],
            error: 'VITE_VIDEO_SOURCES URLs must use http:// or https:// only.',
          }
        }
      } catch {
        return {
          videos: [],
          error: 'VITE_VIDEO_SOURCES contains an invalid URL.',
        }
      }
      videos.push({ id: `env-${i}-${p}`, src: p })
      continue
    }
    if (!base) {
      return {
        videos: [],
        error:
          'VITE_VIDEO_SOURCES has a bucket path, but VITE_GCS_PUBLIC_BASE_URL is not set. Use full https:// URLs for each file, or set the base URL.',
      }
    }
    const path = p.replace(/^\/+/, '')
    videos.push({ id: `env-${i}-${path}`, src: `${base}/${path}` })
  }

  return { videos, error: null }
}
