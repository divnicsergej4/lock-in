// Deploy: supabase functions deploy delete-account   (keeps Supabase's login check on: signed-in users only)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase itself; the key never leaves the server.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

Deno.serve((req) =>
  handle(req, {
    // Asks the auth server, so a token that was signed out or belongs to a deleted user does not count.
    whoAmI: async (authorization) => {
      const { data, error } = await admin.auth.getUser(authorization.slice('Bearer '.length));
      return error ? null : data.user?.id ?? null;
    },
    deleteUser: async (userId) => {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error('deleteUser', error.status, error.message);
      return !error;
    },
  }).catch((e) => {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  })
);
