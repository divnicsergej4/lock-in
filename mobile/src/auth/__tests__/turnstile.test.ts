import { captchaOn } from '../captcha';
import { CaptchaError, isHostname, isSiteKey, parseMessage, TokenBroker, turnstileHtml } from '../turnstile';

const KEY = '0x4AAAAAAAabcdefGHIJKL';

describe('Turnstile page', () => {
  test('loads the explicit script, interaction-only, and posts the token back', () => {
    const html = turnstileHtml(KEY);
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(html).toContain(`sitekey: "${KEY}"`);
    expect(html).toContain("appearance: 'interaction-only'");
    expect(html).toContain('ReactNativeWebView.postMessage');
  });

  test('a site key that could break out of the script is refused', () => {
    for (const bad of ['', 'short', '"};alert(1);//', '</script><script>alert(1)</script>', 'x'.repeat(65)]) {
      expect(() => turnstileHtml(bad)).toThrow();
    }
    expect(isSiteKey(KEY)).toBe(true);
    expect(isSiteKey('1x00000000000000000000AA')).toBe(true); // Cloudflare's test key
  });

  test('host names', () => {
    expect(isHostname('lockintracker.com')).toBe(true);
    expect(isHostname('auth.lockintracker.com')).toBe(true);
    for (const bad of ['', 'localhost', 'https://lockintracker.com', 'lockintracker.com/x', 'evil.com@x.com', 'LOCKIN.com']) expect(isHostname(bad)).toBe(false);
  });

  test('only well-formed messages count', () => {
    expect(parseMessage('{"type":"token","token":"abc"}')).toEqual({ type: 'token', token: 'abc' });
    expect(parseMessage('{"type":"error","code":"110200"}')).toEqual({ type: 'error', code: '110200' });
    expect(parseMessage('{"type":"show"}')).toEqual({ type: 'show' });
    for (const junk of ['nope', '{}', '{"type":"token"}', '{"type":"token","token":""}', '{"type":"other"}', 42, null, 'x'.repeat(5000)]) {
      expect(parseMessage(junk)).toBeNull();
    }
  });
});

describe('token broker', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('a request starts a new challenge and gets the token', async () => {
    const b = new TokenBroker();
    const runs: number[] = [];
    b.subscribe((s) => s.running && runs.push(s.run));
    const p = b.request();
    b.handle({ type: 'token', token: 't1' });
    await expect(p).resolves.toBe('t1');
    const p2 = b.request();
    b.handle({ type: 'token', token: 't2' });
    await expect(p2).resolves.toBe('t2');
    expect(runs).toEqual([1, 2]); // each send gets its own challenge (a token works once)
  });

  test('the widget shows only when Cloudflare asks for a click', () => {
    const b = new TokenBroker();
    const seen: boolean[] = [];
    b.subscribe((s) => seen.push(s.visible));
    b.request().catch(() => {});
    b.handle({ type: 'show' });
    b.handle({ type: 'hide' });
    expect(seen).toEqual([false, false, true, false]);
  });

  test('an error, a failed page or no answer within 60 s fails the request', async () => {
    const b = new TokenBroker();
    const p1 = b.request();
    b.handle({ type: 'error', code: '600010' });
    await expect(p1).rejects.toEqual(new CaptchaError('600010'));
    const p2 = b.request();
    b.fail('load');
    await expect(p2).rejects.toEqual(new CaptchaError('load'));
    const p3 = b.request();
    jest.advanceTimersByTime(60_000);
    await expect(p3).rejects.toEqual(new CaptchaError('timeout'));
  });

  test('a new request replaces the old one; messages with nothing waiting are ignored', async () => {
    const b = new TokenBroker();
    b.handle({ type: 'token', token: 'stray' });
    const old = b.request();
    const next = b.request();
    await expect(old).rejects.toEqual(new CaptchaError('replaced'));
    b.handle({ type: 'token', token: 'fresh' });
    await expect(next).resolves.toBe('fresh');
  });
});

describe('switched on only with both public values', () => {
  test('site key and host name', () => {
    expect(captchaOn(undefined, undefined)).toBe(false);
    expect(captchaOn(KEY, undefined)).toBe(false);
    expect(captchaOn(undefined, 'lockintracker.com')).toBe(false);
    expect(captchaOn(KEY, 'lockintracker.com')).toBe(true);
  });
});
