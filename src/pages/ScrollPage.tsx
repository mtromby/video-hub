import { Loader2, RefreshCw } from 'lucide-react'

import { ScrollFeedWithFilters } from '@/components/feed/ScrollFeedWithFilters'
import { Button } from '@/components/ui/button'
import { useVideoManifest } from '@/hooks/useVideoManifest'
import { hasVideoBucketOrSourcesConfig } from '@/lib/env'

export function ScrollPage() {
  const { videos, loading, error, reload } = useVideoManifest()
  const configured = hasVideoBucketOrSourcesConfig()

  if (!configured) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium text-white">Connect your bucket</p>
        <p className="max-w-sm text-sm text-zinc-400">
          {import.meta.env.PROD ? (
            <>
              This site was built without video env vars. In your GitHub repo, open Settings → Secrets and variables →
              Actions and add the same <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_*</code> names
              you use in local <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.env</code> (at minimum{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_VIDEO_SOURCES</code> or{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_GCS_PUBLIC_BASE_URL</code> plus manifest
              / listing vars per <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.env.example</code>). Then
              push to <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">main</code> or re-run the Pages
              workflow so the build picks them up.
            </>
          ) : (
            <>
              In <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">.env</code>, set either{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_VIDEO_SOURCES</code> (comma-separated
              URLs or paths) or <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_GCS_PUBLIC_BASE_URL</code>{' '}
              (for <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">manifest.json</code>, or set{' '}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">VITE_GCS_USE_XML_LIST=true</code> for public
              bucket listing). Then restart <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">npm run dev</code>.
            </>
          )}
        </p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-zinc-400">
        <Loader2 className="size-8 animate-spin" aria-hidden />
        <p className="text-sm">Loading feed…</p>
      </div>
    )
  }

  if (error || videos.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-lg font-medium text-white">Couldn&apos;t load videos</p>
        <p className="max-w-sm text-sm text-zinc-400">{error ?? 'No videos in manifest.'}</p>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-2"
          onClick={() => void reload()}
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </Button>
      </div>
    )
  }

  return <ScrollFeedWithFilters videos={videos} />
}
