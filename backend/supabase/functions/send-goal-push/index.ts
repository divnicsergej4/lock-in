// Deploy: supabase functions deploy send-goal-push --no-verify-jwt
// (pg_cron has no Supabase login; the secret Authorization header PUSH_CRON_AUTH is checked in handler.ts instead.)
// Secrets: PUSH_CRON_AUTH (same value as the Vault secret the cron job sends), optional EXPO_ACCESS_TOKEN (only if
// "Enhanced push security" is on in Expo). SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type Group, handle, type PushMessage, type Ticket } from './handler.ts';

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const expoToken = Deno.env.get('EXPO_ACCESS_TOKEN');

Deno.serve((req) =>
  handle(req, {
    expectedAuth: Deno.env.get('PUSH_CRON_AUTH'),
    claim: async () => {
      const { data, error } = await db.rpc('claim_goal_pushes', { max_groups: 500 });
      if (error) throw new Error(error.message);
      return (data ?? []) as Group[];
    },
    send: async (messages: PushMessage[]) => {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            accept: 'application/json',
            ...(expoToken ? { authorization: `Bearer ${expoToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) {
          console.error('expo push', res.status, await res.text());
          return null;
        }
        return ((await res.json()).data ?? []) as Ticket[];
      } catch (e) {
        console.error('expo push', e);
        return null;
      }
    },
    release: async (ids) => {
      const { error } = await db.rpc('release_goal_pushes', { ids });
      if (error) console.error('release', error.message);
    },
    dropTokens: async (tokens) => {
      const { error } = await db.rpc('drop_push_tokens', { tokens });
      if (error) console.error('drop tokens', error.message);
    },
  }).catch((e) => {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  })
);
