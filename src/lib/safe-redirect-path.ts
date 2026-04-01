/**
 * Post-login redirect target from router location state must stay a same-app path.
 * Rejects protocol-relative URLs, schemes (e.g. javascript:), and absolute URLs.
 */
export function safeAppRedirectPath(raw: unknown): string {
  if (typeof raw !== 'string') return '/'
  const t = raw.trim()
  if (!t.startsWith('/') || t.startsWith('//')) return '/'
  if (/[\n\r\0]/.test(t)) return '/'
  const withoutLeadingSlash = t.slice(1)
  if (/^[a-zA-Z][a-zA-Z+.-]*:/.test(withoutLeadingSlash)) return '/'
  if (t === '/login' || t.startsWith('/login?')) return '/'
  return t
}
