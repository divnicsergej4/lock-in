// Sends the "Add a friend" invite email. The app calls this right after send_friend_request, with the user's
// own login. The database (public.claim_invite_email) decides whether an email may go out: only the sender's
// own pending invite, once per (re)send, at most 30 a day per user and a daily cap for the whole app.

export type Claim = { to_email: string; from_name: string };
export type ClaimError = { message: string; hint?: string | null; code?: string | null };

export type Deps = {
  // Calls claim_invite_email as the signed-in user (their token, never the service role).
  claim: (requestId: string) => Promise<{ data: Claim | null; error: ClaimError | null }>;
  send: (email: { to: string; subject: string; text: string }) => Promise<boolean>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

// Names come from users: no line breaks or control characters in an email subject.
const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 60);

export function inviteEmail(to: string, fromName: string) {
  const name = clean(fromName) || 'A friend';
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

  if (!(await deps.send(inviteEmail(data.to_email, data.from_name)))) return json(502, { error: 'email not sent' });
  return json(200, { sent: true });
}
