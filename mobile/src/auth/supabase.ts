// The one Supabase client. It only ever has the public key: everything on the server is protected by the
// database rules (RLS and the RPC checks), not by the app. See docs/ZASTITA.md.

import 'react-native-url-polyfill/auto';
import './webCrypto'; // SHA-256 for the PKCE challenge of the Google sign-in

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { encryptedSessionStorage, wipeSession } from './sessionStorage';

export const STORAGE_KEY = 'lockin-session';
// Everything supabase-js may save under STORAGE_KEY (the session, the PKCE verifier of a Google sign-in, the user).
export const STORAGE_ITEMS = [STORAGE_KEY, `${STORAGE_KEY}-code-verifier`, `${STORAGE_KEY}-user`];

/**
 * Only a public key may ever be in the app: the anon JWT or a `sb_publishable_…` key. A secret key
 * (`sb_secret_…` or a service_role JWT) would skip every database rule, so the app refuses to start with one.
 */
export function isPublicKey(key: string): boolean {
  if (key.startsWith('sb_publishable_')) return true;
  if (key.startsWith('sb_secret_')) return false;
  const part = key.split('.')[1];
  if (!part) return false;
  try {
    const json = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')));
    return json.role === 'anon';
  } catch {
    return false;
  }
}

export function makeClient(url: string, key: string, fetchImpl?: typeof fetch): SupabaseClient {
  if (!isPublicKey(key)) throw new Error('Only the public (anon / publishable) Supabase key may be used in the app.');
  return createClient(url, key, {
    auth: {
      storage: encryptedSessionStorage,
      storageKey: STORAGE_KEY,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce', // Google: the code from the browser is useless without the verifier kept on this phone
    },
    global: fetchImpl ? { fetch: fetchImpl } : undefined,
  });
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** null when the app is not connected (no keys in .env) or on the web preview (no Keychain there). */
export const supabase: SupabaseClient | null = url && key && Platform.OS !== 'web' ? makeClient(url, key) : null;

/** Removes the saved login and its key from this phone, whatever state supabase-js is in. */
export const wipeLocalSession = () => wipeSession(STORAGE_ITEMS);

// Refresh the login only while the app is on screen (Supabase's advice for React Native).
if (supabase) {
  const client = supabase;
  AppState.addEventListener('change', (s) => (s === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()));
}
