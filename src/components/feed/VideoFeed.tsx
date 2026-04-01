import {
  memo,
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
  ChevronsLeft,
  ChevronsRight,
  FastForward,
  Info,
  Loader2,
  Pause,
  Play,
  Rewind,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react'

import { CatalogVideoDialog } from '@/components/feed/CatalogVideoDialog'
import { CreateClipDialog } from '@/components/feed/CreateClipDialog'
import { Button } from '@/components/ui/button'
import { useFeedVideoClipInfo } from '@/hooks/useFeedVideoClipInfo'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import { useParentVideoClipMarkers } from '@/hooks/useParentVideoClipMarkers'
import { storagePathFromVideoSrc } from '@/lib/fetch-gcs-storage-paths'
import { getVideoCrossOrigin } from '@/lib/env'
import { getSupabase } from '@/lib/supabase'
import { appendMediaFragmentForStart } from '@/lib/video-playback-url'
import { cn } from '@/lib/utils'
import type { VideoItem } from '@/types/video'

const SKIP_SECONDS = 10
/** When you release the scrubber, snap to a clip start if this close (seconds). */
const SCRUB_SNAP_MAX_DISTANCE_SEC = 1.15
/** Treat playhead as “past” a jump point only if this far past (float-safe). */
const CLIP_JUMP_EPS = 0.05

function finiteSortedClipStarts(markers: { start_seconds: number }[], maxT: number): number[] {
  const set = new Set<number>()
  for (const m of markers) {
    const t = m.start_seconds
    if (Number.isFinite(t) && t >= 0 && t <= maxT) set.add(t)
  }
  return [...set].sort((a, b) => a - b)
}

/** 0:00 plus every clip start (deduped), sorted — rewind/forward jump targets. */
function clipJumpPointsIncludingZero(markers: { start_seconds: number }[], maxT: number): number[] {
  const set = new Set<number>([0])
  for (const t of finiteSortedClipStarts(markers, maxT)) set.add(t)
  return [...set].sort((a, b) => a - b)
}

/**
 * Start time of the clip before the one the playhead is in.
 * Uses marker starts only: never jumps to the start of the current clip—always n−1 (or 0 before the first marker).
 */
function findPrevClipJumpTime(
  t: number,
  markers: { start_seconds: number }[],
  duration: number
): number {
  if (markers.length === 0 || !Number.isFinite(duration) || duration <= 0) {
    return Math.max(0, t - SKIP_SECONDS)
  }
  const starts = finiteSortedClipStarts(markers, duration)
  if (starts.length === 0) return Math.max(0, t - SKIP_SECONDS)

  let j = -1
  for (let i = 0; i < starts.length; i++) {
    if (starts[i] <= t + CLIP_JUMP_EPS) j = i
    else break
  }
  if (j < 0) return 0
  if (j === 0) return 0
  return starts[j - 1]
}

/** Next clip start strictly after `t`, or null if only coarse skip applies (e.g. past last marker). */
function findNextClipJumpTime(
  t: number,
  markers: { start_seconds: number }[],
  duration: number
): number | null {
  if (markers.length === 0 || !Number.isFinite(duration) || duration <= 0) return null
  const starts = finiteSortedClipStarts(markers, duration)
  if (starts.length === 0) return null
  const lastStart = starts[starts.length - 1]
  if (t > lastStart + CLIP_JUMP_EPS) return null
  const points = clipJumpPointsIncludingZero(markers, duration)
  const nxt = points.find((jp) => jp > t + CLIP_JUMP_EPS)
  if (nxt == null) return null
  return duration > 0.05 ? Math.min(nxt, duration - 0.05) : nxt
}

function hasUsableClipStarts(markers: { start_seconds: number }[], duration: number): boolean {
  return finiteSortedClipStarts(markers, duration).length > 0
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Progressive playback: HTTP Range streaming. Active slide uses preload="auto";
 * immediate neighbor uses "metadata" to save bandwidth; radius uses "metadata".
 */

/** Slides within this distance keep a <video> with src attached (keep small for mobile decoder limits). */
const LOAD_RADIUS = 1

function guessVideoType(url: string): string | undefined {
  const u = url.split('?')[0]?.toLowerCase() ?? ''
  if (u.endsWith('.webm')) return 'video/webm'
  if (u.endsWith('.mov')) return 'video/quicktime'
  if (u.endsWith('.m4v') || u.endsWith('.mp4')) return 'video/mp4'
  return undefined
}

/**
 * Active slide from scroll position. Must use each slide’s real height — not `root.clientHeight` alone.
 * Slides are sized to the scrollport (`min-h-full`), but if they were ever taller than the port (e.g. old
 * `100dvh` inside a shorter main+nav layout), `floor(midpoint / clientHeight)` drifts and breaks playback
 * after several swipes.
 */
function readActiveIndex(root: HTMLElement, slideCount: number): number {
  if (slideCount < 1) return 0
  // Skip inline <style> and any non-slide nodes — firstElementChild is not the slide row.
  const first = root.querySelector('[data-feed-slide]') as HTMLElement | null
  const slideH =
    first && first.offsetHeight > 0 ? first.offsetHeight : root.clientHeight
  const ch = root.clientHeight
  if (slideH < 1 || ch < 1) return 0
  const midpoint = root.scrollTop + ch * 0.5
  return Math.min(slideCount - 1, Math.max(0, Math.floor(midpoint / slideH)))
}

function snapTimeToNearestClipStart(
  seconds: number,
  markers: { start_seconds: number }[],
  maxDistance: number
): number | null {
  let best: number | null = null
  let bestD = maxDistance
  for (const m of markers) {
    const t = m.start_seconds
    if (!Number.isFinite(t) || t < 0) continue
    const d = Math.abs(seconds - t)
    if (d < bestD) {
      bestD = d
      best = t
    }
  }
  return best
}

/**
 * Clip whose start is the latest still at or before `currentTime` (same file timeline).
 */
function clipCoveringPlayhead<T extends { id: string; start_seconds: number }>(
  currentTime: number,
  markers: T[]
): T | null {
  if (markers.length === 0) return null
  const sorted = [...markers].sort((a, b) => a.start_seconds - b.start_seconds)
  let best: T | null = null
  for (const m of sorted) {
    if (m.start_seconds <= currentTime + 1e-9) best = m
    else break
  }
  return best
}

type VideoSlideProps = {
  item: VideoItem
  index: number
  activeIndex: number
  feedMuted: boolean
  setFeedMuted: Dispatch<SetStateAction<boolean>>
  /** Parent / file title from catalog or manifest (not the active clip name). */
  videoTitle: string | null
  isAdmin: boolean
  onOpenManageVideo: (item: VideoItem) => void
  onOpenEditClip?: (clipId: string, item: VideoItem, duration: number) => void
  /** Opens create-clip dialog with start time = current playhead (full-file timeline). */
  onOpenCreateClipAtTime?: (item: VideoItem, duration: number, startSeconds: number) => void
}

function InfoChipList({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <div className="space-y-1">
      <p className="text-[10px] font-medium uppercase tracking-wide text-on-video/55">{label}</p>
      <ul className="flex flex-wrap gap-1">
        {items.map((x) => (
          <li
            key={x}
            className="rounded-full border border-on-video/15 bg-on-video/10 px-2 py-0.5 text-[11px] text-on-video/90"
          >
            {x}
          </li>
        ))}
      </ul>
    </div>
  )
}

const VideoSlide = memo(function VideoSlide({
  item,
  index,
  activeIndex,
  feedMuted,
  setFeedMuted,
  videoTitle,
  isAdmin,
  onOpenManageVideo,
  onOpenEditClip,
  onOpenCreateClipAtTime,
}: VideoSlideProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const settingsWrapRef = useRef<HTMLDivElement>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const crossOrigin = getVideoCrossOrigin()
  const sourceType = guessVideoType(item.src)
  const [stalling, setStalling] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [mediaPaused, setMediaPaused] = useState(true)
  const [controlsVisible, setControlsVisible] = useState(false)

  const dist = Math.abs(index - activeIndex)
  const shouldLoad = dist <= LOAD_RADIUS
  const clipMarkers = useParentVideoClipMarkers(item, shouldLoad)
  const isPlaying = index === activeIndex
  const showTransport = isPlaying && shouldLoad && controlsVisible

  const segmentStart =
    item.startSeconds != null && Number.isFinite(item.startSeconds)
      ? Math.max(0, item.startSeconds)
      : null
  const isSegmentLoop = segmentStart != null && segmentStart > 0
  const needsSegmentSeek =
    segmentStart != null && Number.isFinite(segmentStart) && segmentStart > 0

  const playbackSrc = useMemo(
    () => appendMediaFragmentForStart(item.src, segmentStart),
    [item.src, segmentStart]
  )

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
    dist === 0 ? 'auto' : dist === 1 ? 'metadata' : dist <= LOAD_RADIUS ? 'metadata' : 'none'

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

    if (!shouldLoad || !playbackSrc) {
      v.pause()
      v.removeAttribute('src')
      while (v.firstChild) v.removeChild(v.firstChild)
      v.load()
      return
    }

    v.pause()
    while (v.firstChild) v.removeChild(v.firstChild)
    const s = document.createElement('source')
    s.src = playbackSrc
    if (sourceType) s.type = sourceType
    v.appendChild(s)
    v.load()
  }, [shouldLoad, playbackSrc, sourceType])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad) return
    v.muted = feedMuted
  }, [feedMuted, shouldLoad])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad) return

    if (!isPlaying) {
      v.pause()
      return
    }

    if (!needsSegmentSeek) {
      void v.play().catch(() => {
        /* autoplay blocked — user can tap play */
      })
      return
    }

    let cancelled = false
    let timeoutId = 0
    let seekHandler: (() => void) | null = null
    const start = segmentStart!

    const kickPlay = () => {
      if (!cancelled) {
        void v.play().catch(() => {
          /* autoplay blocked */
        })
      }
    }

    const doSeekThenPlay = () => {
      if (cancelled) return
      const d = v.duration
      if (!Number.isFinite(d) || d <= 0) return
      const cap = Math.max(0, d - 0.05)
      const target = Math.min(start, cap)

      if (Math.abs(v.currentTime - target) <= 0.08) {
        kickPlay()
        return
      }

      seekHandler = () => {
        if (cancelled) return
        window.clearTimeout(timeoutId)
        if (seekHandler) v.removeEventListener('seeked', seekHandler)
        seekHandler = null
        kickPlay()
      }
      v.addEventListener('seeked', seekHandler)
      v.currentTime = target
      timeoutId = window.setTimeout(() => {
        if (cancelled) return
        if (seekHandler) {
          v.removeEventListener('seeked', seekHandler)
          seekHandler = null
        }
        if (Math.abs(v.currentTime - target) <= 0.25) kickPlay()
      }, 600)
    }

    const onMeta = () => {
      if (cancelled) return
      v.removeEventListener('loadedmetadata', onMeta)
      doSeekThenPlay()
    }

    if (Number.isFinite(v.duration) && v.duration > 0) {
      doSeekThenPlay()
    } else {
      v.addEventListener('loadedmetadata', onMeta)
    }

    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      v.removeEventListener('loadedmetadata', onMeta)
      if (seekHandler) v.removeEventListener('seeked', seekHandler)
    }
  }, [isPlaying, shouldLoad, needsSegmentSeek, segmentStart, playbackSrc])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad || !isSegmentLoop || segmentStart == null) return

    const start = segmentStart
    const onTime = () => {
      const d = v.duration
      if (!Number.isFinite(d) || d <= 0) return
      if (v.currentTime >= d - 0.12) {
        v.currentTime = start
      }
    }
    const onEnded = () => {
      v.currentTime = start
      void v.play().catch(() => {})
    }
    v.addEventListener('timeupdate', onTime)
    v.addEventListener('ended', onEnded)
    return () => {
      v.removeEventListener('timeupdate', onTime)
      v.removeEventListener('ended', onEnded)
    }
  }, [shouldLoad, isSegmentLoop, segmentStart, playbackSrc])

  const trackPlaybackClock = isPlaying || showTransport
  useEffect(() => {
    const v = videoRef.current
    if (!v || !shouldLoad || !trackPlaybackClock) return

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
  }, [shouldLoad, trackPlaybackClock, playbackSrc, setFeedMuted])

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

  const applySeek = useCallback((seconds: number) => {
    const v = videoRef.current
    if (!v) return
    const d = Number.isFinite(v.duration) ? v.duration : 0
    const t = Number.isFinite(seconds) ? seconds : 0
    const next = d > 0 ? Math.min(Math.max(0, t), Math.max(0, d - 0.05)) : Math.max(0, t)
    v.currentTime = next
    setCurrentTime(next)
  }, [])

  const goToPrevClip = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const d = Number.isFinite(v.duration) ? v.duration : duration
    if (clipMarkers.length === 0 || !Number.isFinite(d) || d <= 0) return
    if (!hasUsableClipStarts(clipMarkers, d)) return
    const t = v.currentTime
    const target = findPrevClipJumpTime(t, clipMarkers, d)
    if (Math.abs(target - t) <= CLIP_JUMP_EPS) return
    applySeek(target)
  }, [clipMarkers, duration, applySeek])

  const goToNextClip = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const d = Number.isFinite(v.duration) ? v.duration : duration
    if (clipMarkers.length === 0 || !Number.isFinite(d) || d <= 0) return
    const t = v.currentTime
    const nxt = findNextClipJumpTime(t, clipMarkers, d)
    if (nxt == null || Math.abs(nxt - t) <= CLIP_JUMP_EPS) return
    applySeek(nxt)
  }, [clipMarkers, duration, applySeek])

  const onSeek = useCallback((value: number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = value
    setCurrentTime(value)
  }, [])

  const clipAtPlayhead = useMemo(
    () => clipCoveringPlayhead(currentTime, clipMarkers),
    [currentTime, clipMarkers]
  )

  const resolvedCatalogClipId = clipAtPlayhead?.id ?? item.clipId ?? null
  const catalogInfo = useFeedVideoClipInfo(item, resolvedCatalogClipId, isPlaying && shouldLoad && infoOpen)

  useEffect(() => {
    if (!isPlaying) {
      setSettingsOpen(false)
      setInfoOpen(false)
    }
  }, [isPlaying])

  useEffect(() => {
    if (!settingsOpen) return
    function onDown(e: MouseEvent | TouchEvent) {
      const el = settingsWrapRef.current
      const target = e.target instanceof Node ? e.target : null
      if (el && target && !el.contains(target)) setSettingsOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
    }
  }, [settingsOpen])

  const currentClipTitle = useMemo(() => {
    if (clipAtPlayhead?.title?.trim()) return clipAtPlayhead.title.trim()
    if (item.clipId && clipMarkers.length === 0 && item.title?.trim()) return item.title.trim()
    return null
  }, [clipAtPlayhead, clipMarkers.length, item.clipId, item.title])

  const canPrevClip = useMemo(() => {
    if (clipMarkers.length === 0 || duration <= 0) return false
    if (!hasUsableClipStarts(clipMarkers, duration)) return false
    const target = findPrevClipJumpTime(currentTime, clipMarkers, duration)
    return Math.abs(target - currentTime) > CLIP_JUMP_EPS
  }, [clipMarkers, currentTime, duration])

  const canNextClip = useMemo(() => {
    if (clipMarkers.length === 0 || duration <= 0) return false
    const nxt = findNextClipJumpTime(currentTime, clipMarkers, duration)
    return nxt != null && Math.abs(nxt - currentTime) > CLIP_JUMP_EPS
  }, [clipMarkers, currentTime, duration])

  const handleScrubRelease = useCallback(() => {
    const v = videoRef.current
    if (!v || duration <= 0 || clipMarkers.length === 0) return
    const t = v.currentTime
    const snap = snapTimeToNearestClipStart(t, clipMarkers, SCRUB_SNAP_MAX_DISTANCE_SEC)
    if (snap !== null && Math.abs(snap - t) > 0.04) {
      v.currentTime = snap
      setCurrentTime(snap)
    }
  }, [duration, clipMarkers])

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
    <div
      data-feed-slide
      className="relative isolate h-full min-h-full w-full shrink-0 snap-start snap-always touch-pan-y bg-video-scrim"
    >
      {/* Video layer: full slide; layout independent of bottom chrome */}
      <div
        className="absolute inset-0 z-0 flex cursor-pointer items-center justify-center bg-video-scrim"
        onClick={onVideoAreaClick}
        role="presentation"
      >
        <video
          ref={videoRef}
          className="box-border h-full w-full max-h-full max-w-full object-contain bg-video-scrim"
          {...(crossOrigin ? { crossOrigin } : {})}
          playsInline
          muted={feedMuted}
          loop={!isSegmentLoop}
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
            className="pointer-events-none absolute inset-0 flex items-center justify-center bg-video-scrim/40"
            aria-hidden
          >
            <Loader2 className="size-10 animate-spin text-on-video/70" />
          </div>
        ) : null}
      </div>

      {/* Bottom chrome: stacked above video; slide already ends above app nav — only safe-area inset */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] flex flex-col justify-end bg-gradient-to-t from-video-scrim/92 via-video-gradient-mid/30 to-transparent pt-12 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {showTransport ? (
          <div
            className="pointer-events-auto mb-3 touch-none space-y-2.5 px-3"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 text-[11px] tabular-nums text-on-video/80">
              <span className="min-w-[2.25rem]">{formatTime(currentTime)}</span>
              <div
                className="relative min-h-4 min-w-0 flex-1 touch-manipulation"
                role="group"
                aria-label="Seek; gold ticks are clip starts. Tap a tick to jump. Release near a tick to snap."
              >
                <div
                  className="pointer-events-none absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-on-video/25"
                  aria-hidden
                />
                {duration > 0 &&
                  clipMarkers.map((m) => {
                    const t = m.start_seconds
                    if (!Number.isFinite(t) || t < 0 || t > duration) return null
                    const pct = Math.min(100, Math.max(0, (t / duration) * 100))
                    const isCurrentFeedClip = item.clipId === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        title={m.title}
                        aria-label={`Jump to clip “${m.title}” at ${formatTime(t)}`}
                        className={cn(
                          'absolute top-1/2 z-20 h-2.5 min-w-[6px] max-w-[9px] -translate-x-1/2 -translate-y-1/2 touch-manipulation rounded-sm border border-video-scrim/30 shadow-sm sm:min-w-2 sm:max-w-[10px]',
                          isCurrentFeedClip ? 'bg-primary' : 'bg-primary/65 hover:bg-primary/80'
                        )}
                        style={{ left: `${pct}%` }}
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation()
                          onSeek(t)
                        }}
                      />
                    )
                  })}
                <input
                  type="range"
                  aria-label="Seek"
                  className="feed-scrub absolute inset-0 z-10 h-full w-full min-w-0 cursor-pointer"
                  min={0}
                  max={duration > 0 ? duration : 0}
                  step={0.05}
                  value={duration > 0 ? Math.min(currentTime, duration) : 0}
                  onChange={(e) => onSeek(Number(e.target.value))}
                  onPointerUp={handleScrubRelease}
                />
              </div>
              <span className="min-w-[2.25rem] text-right">{formatTime(duration)}</span>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-9 shrink-0 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-md backdrop-blur-md hover:bg-video-control/65"
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
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                disabled={!canPrevClip}
                title={canPrevClip ? 'Previous clip' : 'No previous clip'}
                className="size-10 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-lg backdrop-blur-md hover:bg-video-control/65 disabled:opacity-35"
                aria-label="Previous clip"
                onClick={goToPrevClip}
              >
                <ChevronsLeft className="size-5" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-11 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-lg backdrop-blur-md hover:bg-video-control/65"
                aria-label={`Rewind ${SKIP_SECONDS} seconds`}
                onClick={() => skip(-SKIP_SECONDS)}
              >
                <Rewind className="size-5" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="size-14 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-lg backdrop-blur-md hover:bg-video-control/65"
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
                className="size-11 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-lg backdrop-blur-md hover:bg-video-control/65"
                aria-label={`Forward ${SKIP_SECONDS} seconds`}
                onClick={() => skip(SKIP_SECONDS)}
              >
                <FastForward className="size-5" strokeWidth={2} />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="secondary"
                disabled={!canNextClip}
                title={canNextClip ? 'Next clip' : 'No next clip'}
                className="size-10 rounded-full border border-on-video/15 bg-video-control/50 text-on-video shadow-lg backdrop-blur-md hover:bg-video-control/65 disabled:opacity-35"
                aria-label="Next clip"
                onClick={goToNextClip}
              >
                <ChevronsRight className="size-5" strokeWidth={2} />
              </Button>
            </div>
          </div>
        ) : null}

        <div className="pointer-events-auto flex w-full flex-row items-end gap-3 px-4 pb-0.5">
          <div className="min-w-0 max-w-[66.666%] flex-[2] basis-0 text-left">
            {videoTitle ? (
              <p className="text-balance text-base font-semibold leading-snug tracking-tight text-primary [text-shadow:0_1px_2px_rgba(0,0,0,0.9),0_2px_14px_rgba(0,0,0,0.75)] sm:text-lg">
                {videoTitle}
              </p>
            ) : null}
            {currentClipTitle ? (
              <p
                className={cn(
                  'line-clamp-3 text-sm font-normal leading-snug text-on-video/88 drop-shadow-sm [text-shadow:0_1px_2px_rgba(0,0,0,0.75)] sm:text-base',
                  videoTitle ? 'mt-1' : ''
                )}
              >
                {currentClipTitle}
              </p>
            ) : null}
            {item.performer ? (
              <p
                className={cn(
                  'text-xs font-normal text-on-video/75 drop-shadow-sm',
                  videoTitle || currentClipTitle ? 'mt-1.5' : ''
                )}
              >
                @{item.performer}
              </p>
            ) : null}
          </div>

          {isPlaying && shouldLoad ? (
            <div className="flex w-1/3 max-w-[33.333%] flex-none flex-col items-end justify-end gap-2 pb-0.5">
              <div className="relative">
                {infoOpen ? (
                  <div
                    className="absolute bottom-full right-0 z-30 mb-2 max-h-[min(52vh,22rem)] w-[min(18rem,78vw)] overflow-y-auto overscroll-contain rounded-xl border border-on-video/15 bg-video-control/92 p-3 shadow-xl backdrop-blur-md"
                    onPointerDown={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-label="Clip and video details"
                  >
                    <p className="mb-2 text-xs font-semibold text-primary">Details</p>
                    {catalogInfo.loading ? (
                      <p className="text-xs text-on-video/70">Loading catalog…</p>
                    ) : null}
                    {catalogInfo.error ? (
                      <p className="text-xs leading-snug text-on-video/80">{catalogInfo.error}</p>
                    ) : null}
                    {!catalogInfo.loading && !catalogInfo.error ? (
                      <div className="space-y-3">
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-on-video/50">
                            Video
                          </p>
                          <div className="space-y-2.5">
                            <InfoChipList label="Performers" items={catalogInfo.videoPerformers} />
                            <InfoChipList label="Categories" items={catalogInfo.videoCategories} />
                            <InfoChipList label="Tags" items={catalogInfo.videoTags} />
                            {catalogInfo.videoPerformers.length === 0 &&
                            catalogInfo.videoCategories.length === 0 &&
                            catalogInfo.videoTags.length === 0 ? (
                              <p className="text-[11px] text-on-video/60">No catalog metadata on file.</p>
                            ) : null}
                          </div>
                        </div>
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-on-video/50">
                            This clip
                          </p>
                          <div className="space-y-2.5">
                            <InfoChipList label="Categories" items={catalogInfo.clipCategories} />
                            <InfoChipList label="Tags" items={catalogInfo.clipTags} />
                            {!resolvedCatalogClipId ? (
                              <p className="text-[11px] text-on-video/60">
                                No catalog clip at this position.
                              </p>
                            ) : null}
                            {resolvedCatalogClipId &&
                            catalogInfo.clipCategories.length === 0 &&
                            catalogInfo.clipTags.length === 0 ? (
                              <p className="text-[11px] text-on-video/60">No categories or tags on clip.</p>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {item.performer?.trim() ? (
                      <p className="mt-3 border-t border-on-video/10 pt-2 text-[10px] text-on-video/55">
                        Manifest: @{item.performer.trim()}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  aria-expanded={infoOpen}
                  aria-label={infoOpen ? 'Close details' : 'Clip and video details'}
                  className={cn(
                    'size-10 shrink-0 rounded-full border border-on-video/20 bg-video-control/55 text-on-video shadow-md backdrop-blur-md hover:bg-video-control/70',
                    infoOpen && 'ring-2 ring-primary/50'
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSettingsOpen(false)
                    setInfoOpen((o) => !o)
                  }}
                >
                  <Info className="size-5" strokeWidth={2} aria-hidden />
                </Button>
              </div>

              {isAdmin ? (
                <div ref={settingsWrapRef} className="relative flex flex-col items-end">
                  {settingsOpen ? (
                    <div
                      className="absolute bottom-full right-0 z-30 mb-2 min-w-[12.5rem] overflow-hidden rounded-xl border border-on-video/15 bg-video-control/92 py-1 shadow-xl backdrop-blur-md"
                      onPointerDown={(e) => e.stopPropagation()}
                      role="menu"
                      aria-label="Video actions"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        disabled={clipAtPlayhead == null || !onOpenEditClip}
                        title={
                          clipAtPlayhead == null
                            ? 'Move the playhead into a catalog clip to edit'
                            : `Edit “${clipAtPlayhead.title}”`
                        }
                        className="flex w-full px-3 py-2.5 text-left text-sm text-on-video transition-colors hover:bg-on-video/10 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!clipAtPlayhead || !onOpenEditClip) return
                          const v = videoRef.current
                          const d = Number.isFinite(v?.duration ?? NaN) ? (v!.duration as number) : duration
                          onOpenEditClip(clipAtPlayhead.id, item, d)
                          setSettingsOpen(false)
                        }}
                      >
                        Edit current clip
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        disabled={!onOpenCreateClipAtTime || !Number.isFinite(duration) || duration <= 0}
                        title={
                          !onOpenCreateClipAtTime
                            ? 'Unavailable'
                            : !Number.isFinite(duration) || duration <= 0
                              ? 'Wait for video to load'
                              : 'Create a new catalog clip starting at the playhead'
                        }
                        className="flex w-full px-3 py-2.5 text-left text-sm text-on-video transition-colors hover:bg-on-video/10 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (!onOpenCreateClipAtTime) return
                          const v = videoRef.current
                          const d = Number.isFinite(v?.duration ?? NaN) ? (v!.duration as number) : duration
                          if (!Number.isFinite(d) || d <= 0) return
                          const t = v && Number.isFinite(v.currentTime) ? v.currentTime : currentTime
                          const start = Math.max(0, Math.min(t, Math.max(0, d - 0.05)))
                          onOpenCreateClipAtTime(item, d, start)
                          setSettingsOpen(false)
                        }}
                      >
                        New clip at current time
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full px-3 py-2.5 text-left text-sm text-on-video transition-colors hover:bg-on-video/10"
                        onClick={(e) => {
                          e.stopPropagation()
                          onOpenManageVideo(item)
                          setSettingsOpen(false)
                        }}
                      >
                        Manage video
                      </button>
                    </div>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="secondary"
                    aria-expanded={settingsOpen}
                    aria-haspopup="menu"
                    aria-label="Video settings"
                    className={cn(
                      'size-10 shrink-0 rounded-full border border-on-video/20 bg-video-control/55 text-on-video shadow-md backdrop-blur-md hover:bg-video-control/70',
                      settingsOpen && 'ring-2 ring-primary/50'
                    )}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation()
                      setInfoOpen(false)
                      setSettingsOpen((o) => !o)
                    }}
                  >
                    <Settings className="size-5" strokeWidth={2} aria-hidden />
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
})

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

    /** After snap ends, layout can settle next frame (esp. iOS); double rAF avoids stale activeIndex. */
    const onScrollEnd = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          sync()
        })
      })
    }

    root.addEventListener('scroll', tick, { passive: true })
    root.addEventListener('scrollend', onScrollEnd)

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
      root.removeEventListener('scrollend', onScrollEnd)
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
  const isAdmin = useIsAdmin()
  const [clipDialog, setClipDialog] = useState<
    | { mode: 'edit'; clipId: string; item: VideoItem; duration: number }
    | { mode: 'create'; item: VideoItem; duration: number; initialStartSeconds: number }
    | null
  >(null)
  const [catalogSourceItem, setCatalogSourceItem] = useState<VideoItem | null>(null)

  const onOpenEditClip = useCallback((clipId: string, it: VideoItem, dur: number) => {
    setClipDialog({ mode: 'edit', clipId, item: it, duration: dur })
  }, [])

  const onOpenCreateClipAtTime = useCallback((it: VideoItem, dur: number, startSeconds: number) => {
    setClipDialog({ mode: 'create', item: it, duration: dur, initialStartSeconds: startSeconds })
  }, [])

  const onOpenManageVideo = useCallback((it: VideoItem) => {
    setCatalogSourceItem(it)
  }, [])

  if (videos.length === 0) return null

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
      <style>{`
[data-feed-scroll]::-webkit-scrollbar { display: none; }
.feed-scrub { -webkit-appearance: none; appearance: none; margin: 0; background: transparent; }
.feed-scrub:focus { outline: none; }
.feed-scrub:focus-visible { outline: 2px solid hsl(var(--primary) / 0.55); outline-offset: 2px; border-radius: 4px; }
.feed-scrub::-webkit-slider-runnable-track { height: 10px; border-radius: 9999px; background: transparent; }
.feed-scrub::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; height: 14px; width: 14px; margin-top: -2px; border-radius: 9999px; background: hsl(var(--on-video)); box-shadow: 0 1px 4px rgba(0,0,0,0.45); cursor: pointer; }
.feed-scrub::-moz-range-track { height: 10px; border-radius: 9999px; background: transparent; }
.feed-scrub::-moz-range-thumb { height: 14px; width: 14px; border-radius: 9999px; background: hsl(var(--on-video)); border: 0; box-shadow: 0 1px 4px rgba(0,0,0,0.45); cursor: pointer; }
`}</style>
      <CatalogVideoDialog
        open={catalogSourceItem != null}
        onClose={() => setCatalogSourceItem(null)}
        sourceItem={catalogSourceItem}
      />
      <CreateClipDialog
        open={clipDialog != null}
        editingClipId={clipDialog?.mode === 'edit' ? clipDialog.clipId : null}
        sourceItem={clipDialog?.item ?? null}
        initialStartSeconds={clipDialog?.mode === 'create' ? clipDialog.initialStartSeconds : 0}
        videoDuration={clipDialog?.duration ?? 0}
        onClose={() => setClipDialog(null)}
        onSaved={() => setClipDialog(null)}
      />
      {videos.map((item, index) => {
        const path = storagePathFromVideoSrc(item.src)
        const catalogTitle = path ? (catalogTitles.get(path) ?? null) : null
        const catalog = catalogTitle?.trim() ?? null
        const videoTitle =
          catalog ?? (!item.clipId ? item.title?.trim() ?? null : null)
        return (
          <VideoSlide
            key={item.id}
            index={index}
            item={item}
            activeIndex={activeIndex}
            feedMuted={feedMuted}
            setFeedMuted={setFeedMuted}
            videoTitle={videoTitle}
            isAdmin={isAdmin === true}
            onOpenManageVideo={onOpenManageVideo}
            onOpenEditClip={isAdmin === true ? onOpenEditClip : undefined}
            onOpenCreateClipAtTime={isAdmin === true ? onOpenCreateClipAtTime : undefined}
          />
        )
      })}
    </div>
  )
}
