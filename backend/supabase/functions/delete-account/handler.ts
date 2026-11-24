// "Delete account" from Settings (Apple requires it in the app). The caller can only ever delete themselves:
// who they are comes from their own login token, never from the request body. Deleting the auth user is all
// it takes: every table that points at auth.users cascades (profile, subscription, friend requests,
// friendships, goal memberships and their contributions), and a goal whose last member is gone is removed
// by the goal_member_left trigger. Goals other people are still in stay theirs.

export type Deps = {
  // The user id behind this Authorization header, or null if the token is not a valid login.
  whoAmI: (authorization: string) => Promise<string | null>;
  // Deletes the auth user (server side, service role). False if the auth server refused.
  deleteUser: (userId: string) => Promise<boolean>;
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  const authorization = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(authorization)) return json(401, { error: 'not signed in' });

  const uid = await deps.whoAmI(authorization);
  if (!uid) return json(401, { error: 'not signed in' });

  if (!(await deps.deleteUser(uid))) return json(502, { error: 'account not deleted' });
  return json(200, { deleted: true });
}
