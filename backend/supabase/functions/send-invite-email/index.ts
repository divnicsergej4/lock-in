// Deploy: supabase functions deploy send-invite-email   (keeps Supabase's login check on: signed-in users only)
// Secrets (Supabase dashboard -> Edge Functions -> Secrets): RESEND_API_KEY, INVITE_FROM (e.g. "Lock In <invites@your-domain>").
// SUPABASE_URL and SUPABASE_ANON_KEY are provided by Supabase itself.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type Claim, handle } from './handler.ts';

Deno.serve((req) => {
  // The user's own token: the database sees who is asking and applies their limits.
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('authorization') ?? '' } },
    auth: { persistSession: false },
  });
  return handle(req, {
    claim: async (requestId) => {
      const { data, error } = await db.rpc('claim_invite_email', { request_id: requestId });
      return { data: (data as Claim[] | null)?.[0] ?? null, error };
    },
    send: async (email) => {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: Deno.env.get('INVITE_FROM'), ...email }),
      });
      if (!res.ok) console.error('resend', res.status, await res.text());
      return res.ok;
    },
  }).catch((e) => {
    console.error(e);
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500 });
  });
});
