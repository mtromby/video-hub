import { titleFromStoragePath } from '@/lib/catalog-helpers'
import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import { slugify } from '@/lib/slug'
import type { CatalogVideoEditorState } from '@/types/catalog-editor'
import { emptyCatalogVideoEditor } from '@/types/catalog-editor'
import type { VideoItem } from '@/types/video'

/** Seed editor state from the scroll feed item (new catalog row). */
export function catalogEditorFromFeedItem(item: VideoItem): CatalogVideoEditorState {
  const path = storagePathFromVideoSrc(item.src) ?? ''
  const base = emptyCatalogVideoEditor()
  const title = item.title?.trim() || (path ? titleFromStoragePath(path) : '')
  const slug = slugify(title) || (path ? slugify(path) : '') || ''
  return {
    ...base,
    storage_path: path,
    title,
    slug,
    performerIds: new Set<string>(),
  }
}
