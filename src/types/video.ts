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
}
