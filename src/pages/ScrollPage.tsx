import type { ReactNode } from 'react'
import { Loader2, RefreshCw, VideoOff } from 'lucide-react'

import { ScrollFeedWithFilters } from '@/components/feed/ScrollFeedWithFilters'
import { Button } from '@/components/ui/button'
import { useMergedScrollFeed } from '@/hooks/useMergedScrollFeed'
import { useVideoManifest } from '@/hooks/useVideoManifest'
import { hasVideoBucketOrSourcesConfig } from '@/lib/env'
import { getSupabaseConfig } from '@/lib/supabase'

const codeClass = 'rounded-md bg-muted/90 px-1.5 py-0.5 font-mono text-[11px] text-foreground'

function StatePanel({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof VideoOff
  title: string
  children: ReactNode
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-8 pb-28 text-center">
      <div className="relative">
        <div className="absolute -inset-6 rounded-full bg-primary/10 blur-2xl" aria-hidden />
        <div className="relative flex size-16 items-center justify-center rounded-2xl border border-primary/20 bg-card/80 shadow-lg backdrop-blur-sm">
          <Icon className="size-8 text-primary" strokeWidth={1.25} aria-hidden />
        </div>
      </div>
      <div className="max-w-sm space-y-3">
        <h2 className="text-xl font-light tracking-tight text-foreground">{title}</h2>
        <div className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

export function ScrollPage() {
  const { videos: manifestVideos, loading: manifestLoading, error: manifestError, reload } =
    useVideoManifest()
  const { feedVideos, reloadClips, clipsError, clipsLoading } = useMergedScrollFeed(manifestVideos)
  const configured = hasVideoBucketOrSourcesConfig()
  const supabaseConfigured = Boolean(getSupabaseConfig())
  const feedLoading = manifestLoading || (supabaseConfigured && clipsLoading)

  if (!configured) {
    return (
      <StatePanel icon={VideoOff} title="Connect your bucket">
        {import.meta.env.PROD ? (
          <>
            This build has no video env vars. In GitHub: Settings → Secrets and variables → Actions — add the same{' '}
            <code className={codeClass}>VITE_*</code> keys as local <code className={codeClass}>.env</code> (see{' '}
            <code className={codeClass}>.env.example</code>), then redeploy.
          </>
        ) : (
          <>
            In <code className={codeClass}>.env</code>, set <code className={codeClass}>VITE_VIDEO_SOURCES</code> or{' '}
            <code className={codeClass}>VITE_GCS_PUBLIC_BASE_URL</code> (and listing vars as needed). Restart{' '}
            <code className={codeClass}>npm run dev</code>.
          </>
        )}
      </StatePanel>
    )
  }

  if (feedLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 pb-28 text-muted-foreground">
        <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
        <p className="text-sm font-medium tracking-wide">Loading feed…</p>
      </div>
    )
  }

  const emptyFeed = feedVideos.length === 0
  const blockingError =
    emptyFeed && (manifestError ?? (clipsError && !manifestVideos.length ? clipsError : null))

  if (emptyFeed) {
    return (
      <StatePanel icon={VideoOff} title="Couldn&apos;t load videos">
        <p>
          {blockingError ??
            'No videos in manifest and no playable clips. Add manifest entries or catalog clips.'}
        </p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="mt-4 gap-2"
          onClick={() => {
            void reload()
            reloadClips()
          }}
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </StatePanel>
    )
  }

  return <ScrollFeedWithFilters videos={feedVideos} clipsLoadError={clipsError} />
}
