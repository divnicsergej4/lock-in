// Names written by users that go out in emails and push notifications.

export const MAX_NAME = 40; // same as profiles.display_name

/**
 * Keeps only letters, digits, spaces, apostrophes and hyphens: no < > " & (no HTML), no dots, colons, slashes or
 * @ (mail and notification apps turn "evil.com", "https://…" and "a@b.co" into links even in plain text), no line
 * breaks (no extra header lines), no invisible or right-to-left control characters. Look-alike characters
 * (full-width "ｅｖｉｌ．ｃｏｍ") are folded first, so they are caught too. At most `max` characters.
 */
export function safeName(s: string | null | undefined, max = MAX_NAME): string {
  const kept = (s ?? '').normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(kept).slice(0, max).join('').trim();
}
