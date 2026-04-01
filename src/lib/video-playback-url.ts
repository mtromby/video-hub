/**
 * Append Media Fragments `#t=` so the engine can start decoding near the clip start
 * (reduces wrong-frame flash; seek-after-metadata still applied for precision).
 */
export function appendMediaFragmentForStart(src: string, startSeconds: number | null): string {
  if (startSeconds == null || !Number.isFinite(startSeconds) || startSeconds <= 0) {
    return src
  }
  try {
    const u = new URL(src)
    u.hash = `t=${startSeconds}`
    return u.toString()
  } catch {
    const base = src.includes('#') ? (src.split('#')[0] ?? src) : src
    return `${base}#t=${startSeconds}`
  }
}
