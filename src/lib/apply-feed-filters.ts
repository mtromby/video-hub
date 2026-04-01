import { getAnnotationForVideoItem } from '@/lib/feed-annotation'
import { matchPerformerIdsFromHint } from '@/lib/catalog-helpers'
import type { FeedFilterSelections, FeedPathAnnotation } from '@/types/feed-filters'
import type { CatalogPerformer } from '@/types/catalog'
import type { VideoItem } from '@/types/video'

function hasAnySelection(s: FeedFilterSelections): boolean {
  return (
    s.performerIds.length > 0 ||
    s.manifestPerformerLiterals.length > 0 ||
    s.categoryIds.length > 0 ||
    s.tagIds.length > 0
  )
}

function passesCatalogPerformers(
  item: VideoItem,
  ann: FeedPathAnnotation | undefined,
  selected: Set<string>,
  performers: CatalogPerformer[]
): boolean {
  if (selected.size === 0) return true
  if (ann?.performerIds.size) {
    for (const id of ann.performerIds) {
      if (selected.has(id)) return true
    }
  }
  if (item.performer) {
    const hinted = matchPerformerIdsFromHint(item.performer, performers)
    for (const id of hinted) {
      if (selected.has(id)) return true
    }
  }
  return false
}

function passesManifestPerformers(item: VideoItem, selectedLiterals: string[]): boolean {
  if (selectedLiterals.length === 0) return true
  const hint = item.performer?.trim().toLowerCase()
  if (!hint) return false
  return selectedLiterals.some((l) => l.trim().toLowerCase() === hint)
}

/** Catalog performer IDs and/or manifest strings; both axes use AND when both are set. */
function passesPerformerDimension(
  item: VideoItem,
  ann: FeedPathAnnotation | undefined,
  selections: FeedFilterSelections,
  performers: CatalogPerformer[]
): boolean {
  const catSel = new Set(selections.performerIds)
  const wantCat = catSel.size > 0
  const wantMan = selections.manifestPerformerLiterals.length > 0
  if (!wantCat && !wantMan) return true

  const okCat = !wantCat || passesCatalogPerformers(item, ann, catSel, performers)
  const okMan = !wantMan || passesManifestPerformers(item, selections.manifestPerformerLiterals)

  if (wantCat && wantMan) return okCat && okMan
  if (wantCat) return okCat
  return okMan
}

function passesCategories(ann: FeedPathAnnotation | undefined, selected: Set<string>): boolean {
  if (selected.size === 0) return true
  if (!ann?.categoryIds.size) return false
  for (const id of selected) {
    if (ann.categoryIds.has(id)) return true
  }
  return false
}

function passesTags(
  ann: FeedPathAnnotation | undefined,
  selected: Set<string>,
  mode: FeedFilterSelections['tagMode']
): boolean {
  if (selected.size === 0) return true
  if (!ann?.tagIds.size) return false
  if (mode === 'any') {
    for (const id of selected) {
      if (ann.tagIds.has(id)) return true
    }
    return false
  }
  for (const id of selected) {
    if (!ann.tagIds.has(id)) return false
  }
  return true
}

export function videoMatchesFeedFilters(
  item: VideoItem,
  annotationByFeedKey: Map<string, FeedPathAnnotation>,
  selections: FeedFilterSelections,
  performers: CatalogPerformer[]
): boolean {
  if (!hasAnySelection(selections)) return true

  const ann = getAnnotationForVideoItem(item, annotationByFeedKey)
  const catSel = new Set(selections.categoryIds)
  const tagSel = new Set(selections.tagIds)

  if (!passesPerformerDimension(item, ann, selections, performers)) return false
  if (!passesCategories(ann, catSel)) return false
  if (!passesTags(ann, tagSel, selections.tagMode)) return false
  return true
}

export function applyFeedFilters(
  videos: VideoItem[],
  selections: FeedFilterSelections,
  annotationByFeedKey: Map<string, FeedPathAnnotation>,
  performers: CatalogPerformer[]
): VideoItem[] {
  if (!hasAnySelection(selections)) return videos
  return videos.filter((item) => videoMatchesFeedFilters(item, annotationByFeedKey, selections, performers))
}
