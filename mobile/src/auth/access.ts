// Does this person have a trial or subscription? The app never decides that itself and never saves the
// answer: it is asked again on every start and every return to the app, from two places:
//   * the server, RPC my_access() (public.subscriptions, written only by the RevenueCat webhook);
//   * RevenueCat (the store), which knows about a purchase a few seconds before the webhook arrives.
// This only changes what the screens show. Anything that goes to the server is still checked by the
// database (app.require_access and RLS), whatever the app thinks.

export type Access =
  | { kind: 'signed-out' }
  | { kind: 'checking' }
  | { kind: 'active'; until: number | null; syncing?: boolean } // until null: no end (lifetime) or not on the server yet
  | { kind: 'none' }
  | { kind: 'unknown' }; // could not ask (offline)

/** my_access() result: a timestamp, 'infinity' (lifetime), or null (never had one). */
export function parseUntil(v: unknown): number | null | 'bad' {
  if (v == null) return null;
  if (v === 'infinity') return Infinity;
  if (typeof v !== 'string') return 'bad';
  const t = Date.parse(v);
  return Number.isNaN(t) ? 'bad' : t;
}

/**
 * server: what my_access() returned, or 'error' if it could not be asked.
 * store: RevenueCat says the entitlement is active (true / false), or null if RevenueCat is not set up or unreachable.
 */
export function decideAccess(server: unknown | 'error', store: boolean | null, now: number): Access {
  const until = server === 'error' ? 'bad' : parseUntil(server);
  if (typeof until === 'number' && until > now) return { kind: 'active', until: until === Infinity ? null : until };
  if (store === true) return { kind: 'active', until: null, syncing: true };
  if (until === 'bad') return { kind: 'unknown' };
  return { kind: 'none' };
}

/** The line under the account in Settings. */
export function accessText(a: Access, now: number): string {
  switch (a.kind) {
    case 'signed-out':
      return 'Not signed in';
    case 'checking':
      return 'Checking your plan…';
    case 'unknown':
      return 'Couldn’t check your plan right now';
    case 'none':
      return 'No active trial or plan';
    case 'active': {
      if (a.syncing) return 'Plan active (finishing setup…)';
      if (a.until == null) return 'Plan active, no end date';
      const d = new Date(a.until);
      const days = Math.ceil((a.until - now) / 86400000);
      return days <= 31 ? `Active until ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : 'Plan active';
    }
  }
}
