/** Matches DB check constraints on slug columns. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function isValidSlug(s: string): boolean {
  return SLUG_PATTERN.test(s)
}

/** Turn a title or filename into a slug; may need manual fix if empty. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}
