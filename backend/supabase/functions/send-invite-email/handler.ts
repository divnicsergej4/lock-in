// Sends the "Add a friend" invite email. The app calls this right after send_friend_request, with the user's
// own login. The database (public.claim_invite_email) decides whether an email may go out: only the sender's
// own pending invite, once per (re)send, at most 30 a day per user and a daily cap for the whole app.

export type Claim = { to_email: string; from_name: string | null }; // from_name: display name only, never an email
export type ClaimError = { message: string; hint?: string | null; code?: string | null };

export type Deps = {
  // Calls claim_invite_email as the signed-in user (their token, never the service role).
  claim: (requestId: string) => Promise<{ data: Claim | null; error: ClaimError | null }>;
  send: (email: { to: string; subject: string; text: string }) => Promise<boolean>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const MAX_NAME = 40; // same as profiles.display_name

/**
 * The sender's name comes from a user and goes into the subject and the text. The email is plain text only
 * (no HTML part), and the name keeps only letters, digits, spaces, apostrophes and hyphens: no < > " & (no HTML),
 * no dots, colons, slashes or @ (mail apps turn "evil.com", "https://…" and "a@b.co" into links even in plain
 * text), no line breaks (no extra headers in the subject), no invisible or right-to-left control characters.
 * Look-alike characters (full-width "ｅｖｉｌ．ｃｏｍ") are folded first, so they are caught too.
 */
export function safeName(s: string | null | undefined): string {
  const kept = (s ?? '').normalize('NFKC').replace(/[^\p{L}\p{M}\p{N} '’-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return Array.from(kept).slice(0, MAX_NAME).join('').trim();
}

// The recipient's address goes into the text: only a plain address, nothing a mail app could show as markup.
export const SAFE_EMAIL = /^[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

export function inviteEmail(to: string, fromName: string | null) {
  const name = safeName(fromName) || 'A friend';
  return {
    to,
    subject: `${name} invited you to Lock In`,
    text: `${name} wants to add you as a friend on Lock In, so you can save for goals together.\n\n` +
      `Get Lock In and sign up with this email address (${to}) to accept.\n\n` +
      `If you don't know who this is, just ignore this email.`,
  };
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  if (!req.headers.get('authorization')) return json(401, { error: 'not signed in' });
  let requestId: unknown;
  try {
    requestId = (await req.json()).request_id;
  } catch {
    return json(400, { error: 'bad body' });
  }
  if (typeof requestId !== 'string' || !UUID.test(requestId)) return json(400, { error: 'bad request_id' });

  const { data, error } = await deps.claim(requestId);
  if (error) {
    const status = error.hint === 'rate_limited' ? 429 : error.hint === 'no_access' ? 402
      : error.code === 'P0002' ? 404 : error.code === '28000' ? 401 : 400;
    return json(status, { error: error.message, hint: error.hint ?? null });
  }
  if (!data) return json(404, { error: 'request not found' });
  if (!SAFE_EMAIL.test(data.to_email) || data.to_email.length > 254) return json(400, { error: 'bad address' });

  if (!(await deps.send(inviteEmail(data.to_email, data.from_name)))) return json(502, { error: 'email not sent' });
  return json(200, { sent: true });
}
