import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import type { VideoItem } from '@/types/video'

/**
 * Stable key for catalog filter annotations: clip rows use clip id; manifest rows use storage path when derivable.
 */
export function feedItemFilterKey(item: VideoItem): string {
  if (item.clipId) {
    return `clip:${item.clipId}`
  }
  const path = storagePathFromVideoSrc(item.src)
  if (path) {
    return `path:${path}`
  }
  return `id:${item.id}`
}
