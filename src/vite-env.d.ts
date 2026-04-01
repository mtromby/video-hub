/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GCS_PUBLIC_BASE_URL?: string
  readonly VITE_VIDEO_MANIFEST_PATH?: string
  /** Comma-separated full video URLs and/or bucket object paths (see .env.example). */
  readonly VITE_VIDEO_SOURCES?: string
  /** If true, list objects via GCS XML API (requires public list on bucket). */
  readonly VITE_GCS_USE_XML_LIST?: string
  /** Object key prefix for XML listing (e.g. uploads/). */
  readonly VITE_GCS_LIST_PREFIX?: string
  /** `anonymous` | `use-credentials` — only if bucket CORS allows your origin. */
  readonly VITE_VIDEO_CROSS_ORIGIN?: string

  /** Supabase project URL (Settings → API). */
  readonly VITE_SUPABASE_URL?: string
  /** Supabase anon (public) key — safe to expose in the browser. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
