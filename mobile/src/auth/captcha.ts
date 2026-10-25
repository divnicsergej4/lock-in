// Cloudflare Turnstile (CAPTCHA), docs/ZASTITA.md 3.2 step 9 and 3.3.
// With passwordless sign-in Supabase asks for a CAPTCHA token only when a code is sent (signInWithOtp);
// Apple and Google sign-in, checking the code and refreshing the login never need one.
//
// Both values are public (like the anon key) and come from .env.local:
//   EXPO_PUBLIC_TURNSTILE_SITE_KEY  the widget's site key from Cloudflare
//   EXPO_PUBLIC_TURNSTILE_HOSTNAME  a host name in the widget's hostname list (e.g. your domain); the WebView
//                                   page is loaded as if it came from https://<that name>
// Without both, no token is sent, so CAPTCHA must stay OFF in Supabase, or "Send code" fails (captcha_failed).
// The page itself runs in TurnstileHost (on the sign-in screen); the logic is in turnstile.ts.

import { isHostname, isSiteKey, TokenBroker } from './turnstile';

export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
export const TURNSTILE_HOSTNAME = process.env.EXPO_PUBLIC_TURNSTILE_HOSTNAME;

export const captchaOn = (key = TURNSTILE_SITE_KEY, host = TURNSTILE_HOSTNAME) => isSiteKey(key) && isHostname(host);

export const captchaBroker = new TokenBroker();

/** A fresh Turnstile token for one request, or undefined when Turnstile is not set up in this build. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!captchaOn()) return undefined;
  return captchaBroker.request();
}
