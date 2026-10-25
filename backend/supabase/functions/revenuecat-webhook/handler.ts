// RevenueCat webhook: turns store events (trial, renewal, cancellation, expiration...) into
// public.subscriptions.active_until. Only requests carrying the secret Authorization value set in the
// RevenueCat dashboard are accepted; everything else gets 401 and touches nothing.

export type StoreUpdate = { userId: string; activeUntil: string; product: string | null; eventAt: string };

export type Deps = {
  // The exact Authorization header value configured in RevenueCat (Supabase secret REVENUECAT_WEBHOOK_AUTH).
  expectedAuth: string | undefined;
  // Writes through public.apply_store_event; false when no such user exists.
  apply: (u: StoreUpdate) => Promise<boolean>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY = 64 * 1024;
// Events that say nothing new about how long access lasts.
const IGNORED = new Set(['TEST', 'TRANSFER', 'SUBSCRIPTION_PAUSED', 'INVOICE_ISSUANCE', 'EXPERIMENT_ENROLLMENT',
  'VIRTUAL_CURRENCY_TRANSACTION']);

import { sameSecret } from '../_shared/secret.ts';
export { sameSecret };

const reply = (status: number, body: string) => new Response(body, { status });

export async function handle(req: Request, deps: Deps): Promise<Response> {
  if (!deps.expectedAuth || deps.expectedAuth.length < 32) return reply(500, 'webhook secret not configured');
  if (req.method !== 'POST') return reply(405, 'method not allowed');
  if (!sameSecret(req.headers.get('authorization') ?? '', deps.expectedAuth)) return reply(401, 'unauthorized');

  const raw = await req.text();
  if (raw.length > MAX_BODY) return reply(413, 'too large');
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(raw).event;
    if (!event || typeof event !== 'object') throw new Error();
  } catch {
    return reply(400, 'bad body');
  }

  const type = String(event.type ?? '');
  if (IGNORED.has(type)) return reply(200, 'ignored');

  // The app logs in to RevenueCat with the Supabase user id; anonymous RevenueCat ids cannot be matched.
  const ids = [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])];
  const userId = ids.find((id): id is string => typeof id === 'string' && UUID.test(id));
  if (!userId) return reply(200, 'ignored: no app user');

  const exp = event.expiration_at_ms;
  if (exp !== null && typeof exp !== 'number') return reply(200, 'ignored: no expiration');
  const at = typeof event.event_timestamp_ms === 'number' ? event.event_timestamp_ms : Date.now();

  const found = await deps.apply({
    userId,
    // No expiration means a one-time (lifetime) purchase.
    activeUntil: exp === null ? 'infinity' : new Date(exp).toISOString(),
    product: typeof event.product_id === 'string' ? event.product_id.slice(0, 100) : null,
    eventAt: new Date(at).toISOString(),
  });
  return reply(200, found ? 'ok' : 'ignored: unknown user');
}
