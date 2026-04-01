import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react'
import {
  FastForward,
  Loader2,
  Pause,
  Play,
  Rewind,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { QuickAddToCatalog } from '@/components/feed/QuickAddToCatalog'
import { Button } from '@/components/ui/button'
import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import { getVideoCrossOrigin } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import type { VideoItem } from '@/types/video'

const SKIP_SECONDS = 10

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Progressive playback: the browser streams via HTTP Range. We use preload="auto"
 * on the focused slide and its neighbors so the next swipe is already buffered.
 */

/** Slides within this distance keep a <video> with src attached. */
const LOAD_RADIUS = 2

function guessVideoType(url: string): string | undefined {
  const u = url.split('?')[0]?.toLowerCase() ?? ''
  if (u.endsWith('.webm')) return 'video/webm'
  if (u.endsWith('.mov')) return 'video/quicktime'
  if (u.endsWith('.m4v') || u.endsWith('.mp4')) return 'video/mp4'
  return undefined
}

/** Whichever slide contains the viewport center line (TikTok-style “most on screen”). */
function readActiveIndex(root: HTMLElement, slideCount: number): number {
  const h = root.clientHeight
  if (h < 1 || slideCount < 1) return 0
  const midpoint = root.scrollTop + h * 0.5
  return Math.min(slideCount - 1, Math.max(0, Math.floor(midpoint / h)))
}

type VideoSlideProps = {
  item: VideoItem
  index: number
  activeIndex: number
  feedMuted: boolean
  setFeedMuted: Dispatch<SetStateAction<boolean>>
  catalogTitle: string | null
}

function VideoSlide({
  item,
  index,
  activeIndex,
  feedMuted,
  setFeedMuted,
  catalogTitle,
}: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const crossOrigin = getVideoCrossOrigin()
  const sourceType = guessVideoType(item.src)
  const [stalling, setStalling] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [mediaPaused, setMediaPaused] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(false)

  const dist = Math.abs(index - activeIndex)
  const shouldLoad = dist <= LOAD_RADIUS
  const isPlaying = index === activeIndex
  const showTransport = isPlaying && shouldLoad && controlsVisible

  useEffect(() => {
    if (!isPlaying) {
      const id = window.setTimeout(() => setControlsVisible(false), 0)
      return () => window.clearTimeout(id)
    }
  }, [isPlaying])

  const onVideoAreaClick = useCallback(() => {
    setControlsVisible((v) => !v)
  }, [])

  const preload: 'auto' | 'metadata' | 'none' =
    dist === 0 ? 'auto' : dist === 1 ? 'auto' : dist <= LOAD_RADIUS ? 'metadata' : 'none'

  useLayoutEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.defaultMuted = true
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return

    if (!shouldLoad || !item.src) {
      v.pause()
      v.removeAttribute('src')
      while (v.firstChild) v.removeChild(v.firstChild)
      v.load()
      return
    }

    v.pause()
    while (v.firstChild) v.removeChild(v.firstChild)
    const s = document.createElement('source')
    s.src = item.src
    if (sourceType) s.type = sourceType
    v.appendChild(s)
    v.load()
  }, [shouldLoad, item.src, sourceType])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad) return
    v.muted = feedMuted
  }, [feedMuted, shouldLoad])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad) return
    if (isPlaying) {
      void v.play().catch(() => {
        /* autoplay blocked — user can tap play */
      })
    } else {
      v.pause()
    }
  }, [isPlaying, shouldLoad])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad || !showTransport) return

    const onTime = () => setCurrentTime(v.currentTime)
    const onDur = () => {
      setDuration(Number.isFinite(v.duration) ? v.duration : 0)
      setCurrentTime(v.currentTime)
    }
    const onSeeked = () => setCurrentTime(v.currentTime)
    const syncPaused = () => setMediaPaused(v.paused)

    v.addEventListener('timeupdate', onTime)
    v.addEventListener('durationchange', onDur)
    v.addEventListener('loadedmetadata', onDur)
    v.addEventListener('seeked', onSeeked)
    v.addEventListener('play', syncPaused)
    v.addEventListener('pause', syncPaused)
    const onVolume = () => setFeedMuted(v.muted)
    v.addEventListener('volumechange', onVolume)
    onDur()
    syncPaused()

    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('durationchange', onDur)
      v.removeEventListener('loadedmetadata', onDur)
      v.removeEventListener('seeked', onSeeked)
      v.removeEventListener('play', syncPaused)
      v.removeEventListener('pause', syncPaused)
      v.removeEventListener('volumechange', onVolume)
    }
  }, [shouldLoad, showTransport, item.src, setFeedMuted])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) {
      void v.play().catch(() => {})
    } else {
      v.pause()
    }
  }, [])

  const skip = useCallback((delta: number) => {
    const v = videoRef.current
    if (!v) return
    const d = Number.isFinite(v.duration) ? v.duration : 0
    const next = Math.min(d || Infinity, Math.max(0, v.currentTime + delta))
    v.currentTime = next
    setCurrentTime(next)
  }, [])

  const onSeek = useCallback((value: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = value
    setCurrentTime(value)
  }, [])

  const toggleMute = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const next = !feedMuted
    v.muted = next
    setFeedMuted(next)
    if (!next && v.paused) {
      void v.play().catch(() => {})
    }
  }, [feedMuted, setFeedMuted])

  return (
    <div className="relative flex h-[100dvh] min-h-[100dvh] w-full shrink-0 snap-start snap-always flex-col bg-black touch-pan-y">
      <div
        className="relative box-border flex min-h-0 w-full flex-1 basis-0 cursor-pointer items-center justify-center"
        onClick={onVideoAreaClick}
        role="presentation"
      >
        <video
          ref={videoRef}
          className="box-border h-full w-full max-h-full max-w-full object-contain bg-black"
          {...(crossOrigin ? { crossOrigin } : {})}
          playsInline
          muted={feedMuted}
          loop
          preload={preload}
          controls={false}
          disablePictureInPicture
          onWaiting={() => setStalling(true)}
          onPlaying={() => setStalling(false)}
          onCanPlay={() => setStalling(false)}
          onError={() => setStalling(false)}
        />

        {stalling && shouldLoad ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40"
            aria-hidden
          >
            <Loader2 className="size-10 animate-spin text-white/70" />
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] bg-gradient-to-t from-black/90 via-black/35 to-transparent pb-[max(5.5rem,env(safe-area-inset-bottom)+4.5rem)] pt-24">
        {showTransport ? (
          <div
            className="pointer-events-auto mb-3 touch-none space-y-2.5 px-3"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[11px] tabular-nums text-white/80">
              <span className="min-w-[2.25rem]">{formatTime(currentTime)}</span>
              <input
                type="range"
                aria-label="Seek"
                className="h-1.5 min-w-0 flex-1 cursor-pointer accent-white"
                min={0}
                max={duration > 0 ? duration : 0}
                step={0.05}
                value={duration > 0 ? Math.min(currentTime, duration) : 0}
                onChange={(e) => onSeek(Number(e.target.value))}
              />
              <span className="min-w-[2.25rem] text-right">{formatTime(duration)}</span>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-9 shrink-0 rounded-full border border-white/15 bg-black/50 text-white shadow-md backdrop-blur-md hover:bg-black/65"
                aria-label={feedMuted ? 'Unmute' : 'Mute'}
                onClick={toggleMute}
              >
                {feedMuted ? (
                  <VolumeX className="size-4" strokeWidth={2} />
                ) : (
                  <Volume2 className="size-4" strokeWidth={2} />
                )}
              </Button>
            </div>
            <div className="flex items-center justify-center gap-3">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-11 rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-md hover:bg-black/65"
                aria-label={`Rewind ${SKIP_SECONDS} seconds`}
                onClick={() => skip(-SKIP_SECONDS)}
              >
                <Rewind className="size-5" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-14 rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-md hover:bg-black/65"
                aria-label={mediaPaused ? 'Play' : 'Pause'}
                onClick={togglePlay}
              >
                {mediaPaused ? (
                  <Play className="size-7 pl-0.5" fill="currentColor" />
                ) : (
                  <Pause className="size-7" fill="currentColor" />
                )}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-11 rounded-full border border-white/15 bg-black/50 text-white shadow-lg backdrop-blur-md hover:bg-black/65"
                aria-label={`Forward ${SKIP_SECONDS} seconds`}
                onClick={() => skip(SKIP_SECONDS)}
              >
                <FastForward className="size-5" strokeWidth={2} />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto px-4 pb-1 text-left">
          {catalogTitle ? (
            <p className="text-balance text-xl font-semibold leading-snug tracking-tight text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_16px_rgba(0,0,0,0.75)] sm:text-2xl">
              {catalogTitle}
            </p>
          ) : null}
          {item.performer ? (
            <p
              className={cn(
                'text-sm font-semibold text-white drop-shadow-md',
                catalogTitle ? 'mt-2' : ''
              )}
            >
              @{item.performer}
            </p>
          ) : null}
          {item.title && !catalogTitle ? (
            <p className="mt-1 line-clamp-3 text-sm text-white/90 drop-shadow-md">
              {item.title}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

type VideoFeedProps = {
  videos: VideoItem[]
  className?: string
}

function useActiveSlideFromScroll(
  scrollRef: RefObject<HTMLDivElement | null>,
  slideCount: number
) {
  const [activeIndex, setActiveIndex] = useState(0)

  const sync = useCallback(() => {
    const root = scrollRef.current
    if (!root || slideCount < 1) return
    const idx = readActiveIndex(root, slideCount)
    setActiveIndex((prev) => (prev === idx ? prev : idx))
  }, [scrollRef, slideCount])

  useEffect(() => {
    const root = scrollRef.current
    if (!root || slideCount < 1) return

    let raf = 0
    const tick = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        sync()
      })
    }

    root.addEventListener('scroll', tick, { passive: true })
    root.addEventListener('scrollend', sync)

    const ro = new ResizeObserver(tick)
    ro.observe(root)

    const vv = window.visualViewport
    vv?.addEventListener('resize', tick)
    vv?.addEventListener('scroll', tick)
    const onOrient = () => window.setTimeout(tick, 200)
    window.addEventListener('orientationchange', onOrient)

    tick()

    return () => {
      root.removeEventListener('scroll', tick)
      root.removeEventListener('scrollend', sync)
      ro.disconnect()
      vv?.removeEventListener('resize', tick)
      vv?.removeEventListener('scroll', tick)
      window.removeEventListener('orientationchange', onOrient)
      cancelAnimationFrame(raf)
    }
  }, [scrollRef, slideCount, sync])

  return activeIndex
}

function useCatalogTitlesByStoragePath(videos: VideoItem[]) {
  const pathsKey = useMemo(() => {
    const s = new Set<string>()
    for (const v of videos) {
      const p = storagePathFromVideoSrc(v.src)
      if (p) s.add(p)
    }
    return JSON.stringify([...s].sort())
  }, [videos])

  const [titleByPath, setTitleByPath] = useState<Map<string, string>>(() => new Map())

  useEffect(() => {
    const paths = (JSON.parse(pathsKey) as string[]) as string[]
    if (paths.length === 0) {
      const id = window.setTimeout(() => setTitleByPath(new Map()), 0)
      return () => window.clearTimeout(id)
    }
    const supabase = getSupabase()
    if (!supabase) {
      const id = window.setTimeout(() => setTitleByPath(new Map()), 0)
      return () => window.clearTimeout(id)
    }
    let cancelled = false
    void (async () => {
      const { data, error } = await supabase
        .from('videos')
        .select('storage_path, title')
        .in('storage_path', paths)
      if (cancelled || error) return
      const m = new Map<string, string>()
      for (const row of data ?? []) {
        const r = row as { storage_path: string; title: string }
        const t = r.title?.trim()
        if (t) m.set(r.storage_path, t)
      }
      setTitleByPath(m)
    })()
    return () => {
      cancelled = true
    }
  }, [pathsKey])

  return titleByPath
}

export function VideoFeed({ videos, className }: VideoFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeIndex = useActiveSlideFromScroll(scrollRef, videos.length)
  const [feedMuted, setFeedMuted] = useState(true)
  const catalogTitles = useCatalogTitlesByStoragePath(videos)

  if (videos.length === 0) return null

  const current = videos[activeIndex] ?? null

  return (
    <div
      ref={scrollRef}
      data-feed-scroll
      className={cn(
        'relative h-full w-full snap-y snap-mandatory overflow-y-auto overscroll-y-contain',
        className
      )}
      style={{
        WebkitOverflowScrolling: 'touch',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
      }}
    >
      <style>{`[data-feed-scroll]::-webkit-scrollbar { display: none; }`}</style>
      <QuickAddToCatalog current={current} />
      {videos.map((item, index) => {
        const path = storagePathFromVideoSrc(item.src)
        const catalogTitle = path ? (catalogTitles.get(path) ?? null) : null
        return (
          <VideoSlide
            key={item.id}
            index={index}
            item={item}
            activeIndex={activeIndex}
            feedMuted={feedMuted}
            setFeedMuted={setFeedMuted}
            catalogTitle={catalogTitle}
          />
        )
      })}
    </div>
  )
}
