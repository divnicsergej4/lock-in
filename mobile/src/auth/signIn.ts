// The three ways in, none with a password: a 6-digit code by email, Google, and Sign in with Apple.

import type { SupabaseClient } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { getCaptchaToken } from './captcha';
import { authMessage, isWrongCode } from './otp';

export type SignInResult = { ok: true } | { ok: false; error: string; wrongCode?: boolean } | { ok: false; cancelled: true };

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** Emails a 6-digit code (the "Magic Link" email template shows {{ .Token }}, no link). New emails get an account. */
export async function sendCode(client: SupabaseClient, email: string): Promise<SignInResult> {
  let captchaToken: string | undefined;
  try {
    captchaToken = await getCaptchaToken();
  } catch {
    // no token: timed out, no connection, or Cloudflare said no; nothing is sent
    return { ok: false, error: authMessage({ code: 'captcha_failed' }) };
  }
  const { error } = await client.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken },
  });
  return error ? { ok: false, error: authMessage(error) } : { ok: true };
}

export async function verifyCode(client: SupabaseClient, email: string, token: string): Promise<SignInResult> {
  const { error } = await client.auth.verifyOtp({ email, token, type: 'email' });
  return error ? { ok: false, error: authMessage(error), wrongCode: isWrongCode(error) } : { ok: true };
}

/**
 * Where the browser comes back to: lockin://auth-callback in the real app, exp://…/--/auth-callback in Expo Go.
 * Must be in Supabase > Authentication > URL Configuration > Redirect URLs.
 */
export const redirectUrl = () => Linking.createURL('auth-callback');

/** Google in the system browser sheet (works in Expo Go too). PKCE: the code is only good on this phone. */
export async function signInWithGoogle(client: SupabaseClient): Promise<SignInResult> {
  const redirectTo = redirectUrl();
  // In Expo Go this changes with the computer's address; it has to be in Supabase's Redirect URLs (docs/ZASTITA.md 3.2).
  if (__DEV__) console.log('Google redirect URL:', redirectTo);
  const { data, error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return { ok: false, error: authMessage(error) };
  const res = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (res.type !== 'success') return { ok: false, cancelled: true };
  const { queryParams } = Linking.parse(res.url);
  const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
  if (!code) return queryParams?.error === 'access_denied' ? { ok: false, cancelled: true } : { ok: false, error: 'Google sign-in didn’t finish. Try again.' };
  const ex = await client.auth.exchangeCodeForSession(code);
  return ex.error ? { ok: false, error: authMessage(ex.error) } : { ok: true };
}

/** Native Sign in with Apple (iPhone). The nonce ties Apple's token to this one request. */
export async function signInWithApple(client: SupabaseClient): Promise<SignInResult> {
  const nonce = hex(getRandomBytes(32));
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: await digestStringAsync(CryptoDigestAlgorithm.SHA256, nonce),
    });
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return { ok: false, cancelled: true };
    return { ok: false, error: 'Apple sign-in didn’t finish. Try again.' };
  }
  if (!credential.identityToken) return { ok: false, error: 'Apple sign-in didn’t finish. Try again.' };
  const { data, error } = await client.auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce });
  if (error) return { ok: false, error: authMessage(error) };
  // Apple gives the name only the first time: keep it as the name friends see, if there is none yet.
  // (No name yet is NULL; the database refuses names with spaces at the ends, see migration 0004.)
  const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').slice(0, 40).trim();
  if (name && data.user) await client.from('profiles').update({ display_name: name }).eq('id', data.user.id).is('display_name', null);
  return { ok: true };
}
