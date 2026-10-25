// The place for Cloudflare Turnstile (invisible), docs/ZASTITA.md 3.2 step 4 and 3.3.
// With passwordless sign-in Supabase asks for a CAPTCHA token only when a code is sent (signInWithOtp);
// Apple and Google sign-in and refreshing the login never need one.
//
// To build: a hidden WebView loads the Turnstile widget with TURNSTILE_SITE_KEY (public, like the anon key)
// and resolves with the token; a challenge is only shown when Cloudflare suspects a bot.
// Until then this returns undefined, so CAPTCHA must stay OFF in Supabase, or "Send code" fails (captcha_failed).

export const TURNSTILE_SITE_KEY = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY;

/** A fresh Turnstile token for one request, or undefined while Turnstile is not built in. */
export async function getCaptchaToken(): Promise<string | undefined> {
  return undefined;
}
