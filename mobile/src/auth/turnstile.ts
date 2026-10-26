// Cloudflare Turnstile (CAPTCHA) without React: where the page is (web/turnstile on Lock In's domain), the
// messages it sends back, and the broker that hands one fresh token to each "Send code". See docs/ZASTITA.md,
// part 4 and 3.3. The page itself is web/turnstile/index.html + turnstile.js (a test checks they match this).
//
// The widget is Managed with appearance "interaction-only": nobody sees it unless Cloudflare wants a click,
// and then it shows in place on the sign-in screen. (A fully invisible widget could not show that click, and
// the user would be stuck.) Each token works once and for 300 s, so a new challenge runs for every send.

export type TurnstileMessage =
  | { type: 'token'; token: string }
  | { type: 'error'; code: string }
  | { type: 'show' } // Cloudflare wants the user to click
  | { type: 'hide' };

const SITE_KEY = /^[0-9A-Za-z_-]{10,64}$/;
export const isSiteKey = (k: string | undefined): k is string => !!k && SITE_KEY.test(k);
// A plain host name: what goes after https:// (and must be in the widget's hostname list in Cloudflare).
export const isHostname = (h: string | undefined): h is string =>
  !!h && /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(h);

export const TURNSTILE_PATH = '/turnstile/';

/** The page the WebView opens: Lock In's own page with the (public) site key; both are checked first. */
export function turnstilePageUrl(host: string, siteKey: string): string {
  if (!isHostname(host)) throw new Error('bad host name');
  if (!isSiteKey(siteKey)) throw new Error('bad Turnstile site key');
  return `https://${host}${TURNSTILE_PATH}?sitekey=${encodeURIComponent(siteKey)}`;
}

/** The WebView may only go to that page and to Cloudflare's challenge, nowhere else. */
export function allowedInTurnstile(url: string, host: string): boolean {
  return url.startsWith(`https://${host}${TURNSTILE_PATH}`) || url.startsWith('https://challenges.cloudflare.com/')
    || url === 'about:blank' || url === 'about:srcdoc';
}

/** Messages from the page; anything else (or junk) is ignored. */
export function parseMessage(data: unknown): TurnstileMessage | null {
  if (typeof data !== 'string' || data.length > 4096) return null;
  let m: unknown;
  try {
    m = JSON.parse(data);
  } catch {
    return null;
  }
  if (!m || typeof m !== 'object') return null;
  const o = m as Record<string, unknown>;
  if (o.type === 'token' && typeof o.token === 'string' && o.token.length > 0 && o.token.length <= 2048) return { type: 'token', token: o.token };
  if (o.type === 'error') return { type: 'error', code: typeof o.code === 'string' ? o.code.slice(0, 40) : 'error' };
  if (o.type === 'show' || o.type === 'hide') return { type: o.type };
  return null;
}

export class CaptchaError extends Error {
  constructor(public code: string) {
    super(`captcha ${code}`);
  }
}

export type BrokerState = { running: boolean; visible: boolean; run: number };
type Listener = (s: BrokerState) => void;

/**
 * One request at a time: "Send code" asks for a token, the WebView host (TurnstileHost) starts a new challenge
 * for it (run number), and the first token or error that comes back answers it. A newer request replaces an
 * older one. Gives up after `timeoutMs` (the user may also just never click).
 */
export class TokenBroker {
  private pending: { resolve: (t: string) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  private state: BrokerState = { running: false, visible: false, run: 0 };
  private listeners = new Set<Listener>();

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    l(this.state);
    return () => void this.listeners.delete(l);
  }

  private set(s: Partial<BrokerState>) {
    this.state = { ...this.state, ...s };
    for (const l of this.listeners) l(this.state);
  }

  request(timeoutMs = 60_000): Promise<string> {
    this.finish(new CaptchaError('replaced'));
    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => this.finish(new CaptchaError('timeout')), timeoutMs);
      this.pending = { resolve, reject, timer };
      this.set({ running: true, visible: false, run: this.state.run + 1 });
    });
  }

  handle(m: TurnstileMessage | null) {
    if (!m || !this.pending) return;
    if (m.type === 'show') return this.set({ visible: true });
    if (m.type === 'hide') return this.set({ visible: false });
    if (m.type === 'token') return this.finish(null, m.token);
    this.finish(new CaptchaError(m.code));
  }

  /** The WebView itself failed (no connection, blocked page). */
  fail(code: string) {
    this.finish(new CaptchaError(code));
  }

  private finish(err: Error | null, token?: string) {
    const p = this.pending;
    if (!p) return;
    this.pending = null;
    clearTimeout(p.timer);
    this.set({ running: false, visible: false });
    if (err) p.reject(err);
    else p.resolve(token!);
  }
}
