/** In-progress values for create/update catalog video + junctions. */
export type CatalogVideoEditorState = {
  id: string | null
  storage_path: string
  title: string
  slug: string
  description: string
  categoryIds: Set<string>
  tagIds: Set<string>
  performerIds: Set<string>
}

export function emptyCatalogVideoEditor(): CatalogVideoEditorState {
  return {
    id: null,
    storage_path: '',
    title: '',
    slug: '',
    description: '',
    categoryIds: new Set(),
    tagIds: new Set(),
    performerIds: new Set(),
  }
}

/** In-progress values for create/update catalog clip + junctions (no performer junctions on clips). */
export type CatalogClipEditorState = {
  id: string | null
  video_id: string
  start_seconds: number
  title: string
  slug: string
  description: string
  categoryIds: Set<string>
  tagIds: Set<string>
}

export function emptyCatalogClipEditor(): CatalogClipEditorState {
  return {
    id: null,
    video_id: '',
    start_seconds: 0,
    title: '',
    slug: '',
    description: '',
    categoryIds: new Set(),
    tagIds: new Set(),
  }
}
