// Cloudflare Turnstile (CAPTCHA), docs/ZASTITA.md 3.2 step 9 and 3.3.
// With passwordless sign-in Supabase asks for a CAPTCHA token only when a code is sent (signInWithOtp);
// Apple and Google sign-in, checking the code and refreshing the login never need one.
//
// The widget runs on Lock In's own page https://<DOMAIN>/turnstile/ (folder web/turnstile, Cloudflare Pages),
// opened in a WebView by TurnstileHost on the sign-in screen; this is how Cloudflare says to use it in apps.
// Needs both: the domain (src/config/domain.ts) and the public site key from .env.local
// (EXPO_PUBLIC_TURNSTILE_SITE_KEY). Without them no token is sent, so CAPTCHA must stay OFF in Supabase, or
// "Send code" fails (captcha_failed). The logic is in turnstile.ts.

import { DOMAIN } from '@/config/domain';

import { isHostname, isSiteKey, TokenBroker } from './turnstile';

export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;
export const TURNSTILE_HOSTNAME = DOMAIN ?? undefined;

export const captchaOn = (key = TURNSTILE_SITE_KEY, host = TURNSTILE_HOSTNAME) => isSiteKey(key) && isHostname(host);

export const captchaBroker = new TokenBroker();

/** A fresh Turnstile token for one request, or undefined when Turnstile is not set up in this build. */
export async function getCaptchaToken(): Promise<string | undefined> {
  if (!captchaOn()) return undefined;
  return captchaBroker.request();
}
