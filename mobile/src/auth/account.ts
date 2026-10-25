// Signing out and deleting the account. Both end with the login and its key gone from this phone, even when
// the server cannot be reached. Personal data on the phone (spending, envelopes…) is not touched by either.

import type { SupabaseClient } from '@supabase/supabase-js';

export type Result = { ok: true } | { ok: false; error: string };

/** Signs out on this phone (other phones stay signed in). Always succeeds locally. */
export async function signOutHere(client: SupabaseClient, wipe: () => Promise<void>): Promise<void> {
  try {
    await client.auth.signOut({ scope: 'local' });
  } finally {
    await wipe();
  }
}

/**
 * Deletes the account on the server (function delete-account: it deletes only the caller, the database
 * removes their profile, friends, goals they were alone in and their contributions), then signs out here.
 * If the server did not confirm, nothing is signed out and the user can try again.
 */
export async function deleteAccount(client: SupabaseClient, wipe: () => Promise<void>): Promise<Result> {
  const { data } = await client.auth.getSession();
  if (!data.session) return { ok: false, error: 'Sign in first.' };
  const { error } = await client.functions.invoke('delete-account', { method: 'POST', body: {} });
  if (error) {
    return { ok: false, error: error.name === 'FunctionsFetchError' ? 'Couldn’t reach the server. Check your connection.' : 'Couldn’t delete your account. Try again.' };
  }
  await signOutHere(client, wipe);
  return { ok: true };
}
