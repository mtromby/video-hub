import { feedItemFilterKey } from '@/lib/feed-item-filter-key'
import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import type { FeedPathAnnotation } from '@/types/feed-filters'
import type { VideoItem } from '@/types/video'

/** Resolve annotation for a feed item (manifest rows use path key; clips use clip key). */
export function getAnnotationForVideoItem(
  item: VideoItem,
  annotationByFeedKey: Map<string, FeedPathAnnotation>
): FeedPathAnnotation | undefined {
  const direct = annotationByFeedKey.get(feedItemFilterKey(item))
  if (direct) return direct
  if (!item.clipId) {
    const path = storagePathFromVideoSrc(item.src)
    if (path) return annotationByFeedKey.get(`path:${path}`)
  }
  return undefined
}
