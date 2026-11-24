// Sign-in with a 6-digit code from email (no passwords, no magic link). The rules the screen follows:
// "Send code" is locked for 60 s after each send, and after 5 wrong codes that code is dropped and a new one
// must be sent. These are for the user; the real limits are on the server (docs/ZASTITA.md, Rate Limits).

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;
export const MAX_WRONG_CODES = 5;

export type OtpState = { email: string; sentAt: number | null; wrong: number };
export const otpStart: OtpState = { email: '', sentAt: null, wrong: 0 };

export const normalizeEmail = (s: string) => s.trim().toLowerCase();
// Same check as the database (friend_requests.to_email).
export const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

/** Seconds until "Send code" works again (0 = now). */
export function resendIn(st: OtpState, now: number): number {
  if (st.sentAt == null) return 0;
  return Math.max(0, Math.ceil((st.sentAt + RESEND_SECONDS * 1000 - now) / 1000));
}

export const codeSent = (email: string, now: number): OtpState => ({ email, sentAt: now, wrong: 0 });
export const wrongCode = (st: OtpState): OtpState => ({ ...st, wrong: st.wrong + 1 });
/** The code field is open: a code was sent and fewer than 5 wrong ones were typed. */
export const canEnterCode = (st: OtpState) => st.sentAt != null && st.wrong < MAX_WRONG_CODES;
export const needsNewCode = (st: OtpState) => st.wrong >= MAX_WRONG_CODES;

/** Only digits, at most 6 (pasting "123 456" or "Code: 123456" works). */
export const cleanCode = (s: string) => s.replace(/\D/g, '').slice(0, CODE_LENGTH);

type AuthErr = { code?: string; status?: number; message?: string; name?: string } | null | undefined;

/** A wrong or expired code (counts towards the 5). Anything else, e.g. no connection, does not count. */
export const isWrongCode = (e: AuthErr) => e?.code === 'otp_expired' || e?.code === 'invalid_credentials' || (e?.status === 403 && !e?.code);

/** What the user sees for an auth error. Never the raw server text. */
export function authMessage(e: AuthErr): string {
  if (!e) return '';
  if (e.status === 429 || e.code?.startsWith('over_')) return 'Too many tries. Wait a few minutes and try again.';
  if (isWrongCode(e)) return 'That code is wrong or expired.';
  if (e.code === 'captcha_failed') return 'Couldn’t check that you’re human. Try again.';
  if (e.code === 'email_address_invalid' || e.code === 'validation_failed') return 'Check the email address.';
  if (e.code === 'signup_disabled' || e.code === 'email_provider_disabled') return 'Sign-up is closed right now.';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'Couldn’t reach the server. Check your connection.';
  return 'Something went wrong. Try again.';
}
