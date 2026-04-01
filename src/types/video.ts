export type VideoManifestEntry =
  | string
  | {
      src: string
      title?: string
      performer?: string
    }

export type VideoItem = {
  id: string
  src: string
  title?: string
  performer?: string
  /** Supabase clip id when this feed row is a catalog clip. */
  clipId?: string
  /** Start offset in seconds for playback (0 = from file start). */
  startSeconds?: number
  /** Parent catalog video id (for admin clip creation / debugging). */
  parentVideoId?: string
}
