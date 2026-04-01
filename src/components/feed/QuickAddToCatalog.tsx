import { useEffect, useState } from 'react'
import { Settings } from 'lucide-react'

import { CatalogVideoDialog } from '@/components/feed/CatalogVideoDialog'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import { getSupabase, getSupabaseConfig } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { VideoItem } from '@/types/video'

type QuickAddToCatalogProps = {
  /** Currently visible / focused clip in the feed. */
  current: VideoItem | null
  className?: string
}

type CatalogIndicator = 'loading' | 'no-path' | 'none' | 'incomplete' | 'complete'

function indicatorTitle(s: CatalogIndicator): string {
  switch (s) {
    case 'complete':
      return 'Catalog: complete (performers, categories & tags). Tap to manage.'
    case 'incomplete':
      return 'Catalog: saved — add performers, categories, and tags. Tap to manage.'
    case 'none':
      return 'Not in catalog yet. Tap to add.'
    case 'no-path':
      return 'Cannot resolve GCS path for catalog. Check env / manifest. Tap to try anyway.'
    case 'loading':
    default:
      return 'Checking catalog…'
  }
}

export function QuickAddToCatalog({ current, className }: QuickAddToCatalogProps) {
  const { user } = useAuth()
  const isAdmin = useIsAdmin()
  const supabaseConfigured = Boolean(getSupabaseConfig())

  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogSource, setDialogSource] = useState<VideoItem | null>(null)
  const [indicator, setIndicator] = useState<CatalogIndicator>('loading')

  function openDialog() {
    if (!current) return
    setDialogSource(current)
    setDialogOpen(true)
  }

  function closeDialog() {
    setDialogOpen(false)
  }

  useEffect(() => {
    if (!supabaseConfigured || !user || isAdmin !== true || !current) {
      return
    }
    const supabase = getSupabase()
    if (!supabase) {
      return
    }

    let cancelled = false
    const tick = window.setTimeout(() => {
      const path = storagePathFromVideoSrc(current.src)
      if (!path) {
        setIndicator('no-path')
        return
      }
      setIndicator('loading')
      void (async () => {
        const { data: v } = await supabase
          .from('videos')
          .select('id')
          .eq('storage_path', path)
          .maybeSingle()
        if (cancelled) return
        if (!v) {
          setIndicator('none')
          return
        }
        const videoId = (v as { id: string }).id
        const [p, c, tags] = await Promise.all([
          supabase
            .from('video_performers')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', videoId),
          supabase
            .from('video_categories')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', videoId),
          supabase
            .from('video_tags')
            .select('*', { count: 'exact', head: true })
            .eq('video_id', videoId),
        ])
        if (cancelled) return
        const hasP = (p.count ?? 0) > 0
        const hasC = (c.count ?? 0) > 0
        const hasT = (tags.count ?? 0) > 0
        setIndicator(hasP && hasC && hasT ? 'complete' : 'incomplete')
      })()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(tick)
    }
  }, [supabaseConfigured, user, isAdmin, current, dialogOpen])

  if (!supabaseConfigured || !user || isAdmin !== true || !current) {
    return null
  }

  const buttonShell = cn(
    'size-11 rounded-full border shadow-lg backdrop-blur-md transition-colors',
    indicator === 'complete' &&
      'border-emerald-400/90 bg-emerald-600/90 text-white hover:bg-emerald-500 hover:border-emerald-300',
    indicator === 'incomplete' &&
      'border-amber-400/90 bg-amber-500/90 text-amber-950 hover:bg-amber-400 hover:border-amber-300',
    (indicator === 'none' || indicator === 'no-path') &&
      'border-red-400/90 bg-red-600/90 text-white hover:bg-red-500 hover:border-red-300',
    indicator === 'loading' &&
      'border-white/25 bg-black/60 text-white hover:bg-black/70 hover:border-white/35'
  )

  return (
    <>
      <div
        className={cn(
          'pointer-events-auto fixed right-3 z-30',
          'top-[max(0.75rem,env(safe-area-inset-top))]',
          className
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className={buttonShell}
          aria-label={indicatorTitle(indicator)}
          title={indicatorTitle(indicator)}
          onClick={openDialog}
        >
          <Settings className="size-5" strokeWidth={2} aria-hidden />
        </Button>
      </div>

      <CatalogVideoDialog open={dialogOpen} onClose={closeDialog} sourceItem={dialogSource} />
    </>
  )
}
