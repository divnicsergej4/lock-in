// Deploy: supabase functions deploy sync-store-access   (keeps Supabase's login check on: signed-in users only)
// Secret (Edge Functions > Secrets): REVENUECAT_SECRET_KEY, a RevenueCat secret API key (v1, sk_…), set by you in
// the dashboard; it never goes into the app or the repo. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY come from Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');

Deno.serve((req) => {
  if (!rcKey) return new Response(JSON.stringify({ error: 'store not configured' }), { status: 500 });
  return handle(req, {
    whoAmI: async (authorization) => {
      const { data, error } = await admin.auth.getUser(authorization.slice('Bearer '.length));
      return error ? null : data.user?.id ?? null;
    },
    subscriber: async (userId) => {
      const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`, {
        headers: { authorization: `Bearer ${rcKey}`, accept: 'application/json' },
      });
      if (!res.ok) {
        console.error('revenuecat', res.status);
        return null;
      }
      return await res.json();
    },
    apply: async (u) => {
      const { data, error } = await admin.rpc('apply_store_event', {
        user_id: u.userId, active_until: u.activeUntil, product: u.product, event_at: u.eventAt,
      });
      if (error) throw new Error(error.message);
      return data === true;
    },
  }).catch((e) => {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  });
});
