function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Order by hash(id + sessionSalt): a new `sessionSalt` (e.g. each page load) reshuffles the feed,
 * but adding rows later only inserts them by rank without permuting existing pairs.
 */
export function stableShuffledById<T extends { id: string }>(items: T[], sessionSalt: string): T[] {
  if (items.length <= 1) return [...items]
  const rank = (id: string) => hashString(`${sessionSalt}\0${id}`)
  return [...items].sort((a, b) => {
    const ra = rank(a.id)
    const rb = rank(b.id)
    if (ra !== rb) return ra - rb
    return a.id.localeCompare(b.id)
  })
}

/** Fisher–Yates shuffle (copy). */
export function shuffled<T>(items: T[]): T[] {
  if (items.length <= 1) return [...items]
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
