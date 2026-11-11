// "Ask RevenueCat about me": the app calls this when the store says the user has a trial or plan but the server
// does not know yet. That happens when someone starts the free week before they have an account (personal
// spending works without one, so the purchase is made under an anonymous RevenueCat id): after they sign in,
// RevenueCat merges that purchase into their account, but sends no webhook for it until the next renewal.
// The caller only ever syncs themselves: who they are comes from their own login token, never from the body.
// The answer is RevenueCat's own (REST API with the secret key, server side), not what the phone says.
// Only an active trial or plan is written, so this can never shorten or end access (the webhook does that).

export type StoreUpdate = { userId: string; activeUntil: string; product: string | null; eventAt: string };

export type Deps = {
  // The user id behind this Authorization header, or null if the token is not a valid login.
  whoAmI: (authorization: string) => Promise<string | null>;
  // RevenueCat GET /v1/subscribers/{id} body, or null if RevenueCat could not be asked.
  subscriber: (userId: string) => Promise<unknown | null>;
  // Writes through public.apply_store_event (same as the webhook).
  apply: (u: StoreUpdate) => Promise<boolean>;
  now?: () => number;
};

export const ENTITLEMENT = 'access';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const time = (v: unknown): number | null => {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : t;
};

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });
  const authorization = req.headers.get('authorization') ?? '';
  if (!/^Bearer \S+$/.test(authorization)) return json(401, { error: 'not signed in' });
  const uid = await deps.whoAmI(authorization);
  if (!uid) return json(401, { error: 'not signed in' });

  const body = await deps.subscriber(uid);
  if (body == null) return json(502, { error: 'store not reachable' });
  const ent = (body as { subscriber?: { entitlements?: Record<string, Record<string, unknown>> } }).subscriber?.entitlements?.[ENTITLEMENT];
  if (!ent || typeof ent !== 'object') return json(200, { active: false });

  const now = (deps.now ?? Date.now)();
  const lifetime = ent.expires_date === null;
  const until = Math.max(time(ent.expires_date) ?? 0, time(ent.grace_period_expires_date) ?? 0);
  if (!lifetime && !(until > now)) return json(200, { active: false });

  await deps.apply({
    userId: uid,
    activeUntil: lifetime ? 'infinity' : new Date(until).toISOString(),
    product: typeof ent.product_identifier === 'string' ? ent.product_identifier.slice(0, 100) : null,
    eventAt: new Date(now).toISOString(),
  });
  return json(200, { active: true });
}
