/** Per feed item key (see feedItemFilterKey): catalog junctions; empty sets if unknown. */
export type FeedPathAnnotation = {
  performerIds: Set<string>
  categoryIds: Set<string>
  tagIds: Set<string>
}

export type TagCombinationMode = 'all' | 'any'

/** User selections for scroll feed filtering. */
export type FeedFilterSelections = {
  performerIds: string[]
  /** Match `VideoItem.performer` (manifest) case-insensitively when catalog is unavailable or as extra criteria. */
  manifestPerformerLiterals: string[]
  categoryIds: string[]
  tagIds: string[]
  tagMode: TagCombinationMode
}

export function emptyFeedFilterSelections(): FeedFilterSelections {
  return {
    performerIds: [],
    manifestPerformerLiterals: [],
    categoryIds: [],
    tagIds: [],
    tagMode: 'all',
  }
}

export function countActiveFeedFilters(s: FeedFilterSelections): number {
  return (
    s.performerIds.length +
    s.manifestPerformerLiterals.length +
    s.categoryIds.length +
    s.tagIds.length
  )
}
