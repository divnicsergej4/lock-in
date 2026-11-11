// Deploy: supabase functions deploy revenuecat-webhook --no-verify-jwt
// (RevenueCat does not send a Supabase login; the secret Authorization header is checked in handler.ts instead.)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself; the key never leaves the server.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

Deno.serve((req) =>
  handle(req, {
    expectedAuth: Deno.env.get('REVENUECAT_WEBHOOK_AUTH'),
    apply: async (u) => {
      const { data, error } = await db.rpc('apply_store_event', {
        user_id: u.userId, active_until: u.activeUntil, product: u.product, event_at: u.eventAt,
      });
      if (error) throw new Error(error.message);  // 500: RevenueCat retries later
      return data === true;
    },
  }).catch((e) => {
    console.error(e);
    return new Response('error', { status: 500 });
  })
);
