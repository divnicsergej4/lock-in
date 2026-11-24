import fs from 'fs';
import path from 'path';

import { DOMAIN } from '@/config/domain';

import { captchaOn } from '../captcha';
import { allowedInTurnstile, CaptchaError, isHostname, isSiteKey, parseMessage, TokenBroker, turnstilePageUrl } from '../turnstile';

const KEY = '0x4AAAAAAAabcdefGHIJKL';
const WEB = path.resolve(__dirname, '../../../../web/turnstile');

describe('Turnstile page on the domain', () => {
  test('the app opens https://<domain>/turnstile/?sitekey=…', () => {
    expect(turnstilePageUrl('lockintracker.com', KEY)).toBe(`https://lockintracker.com/turnstile/?sitekey=${KEY}`);
  });

  test('only that page and Cloudflare’s challenge may load in the WebView', () => {
    expect(allowedInTurnstile(`https://lockintracker.com/turnstile/?sitekey=${KEY}`, 'lockintracker.com')).toBe(true);
    expect(allowedInTurnstile('https://challenges.cloudflare.com/cdn-cgi/challenge-platform/x', 'lockintracker.com')).toBe(true);
    for (const bad of ['https://evil.com/turnstile/', 'https://lockintracker.com/privacy/', 'https://lockintracker.com.evil.com/turnstile/', 'http://lockintracker.com/turnstile/']) {
      expect(allowedInTurnstile(bad, 'lockintracker.com')).toBe(false);
    }
  });

  test('web/turnstile speaks the same messages the app reads, and checks the site key the same way', () => {
    const js = fs.readFileSync(path.join(WEB, 'turnstile.js'), 'utf8');
    const html = fs.readFileSync(path.join(WEB, 'index.html'), 'utf8');
    expect(html).toContain('src="/turnstile/turnstile.js"');
    expect(js).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit');
    expect(js).toContain("appearance: 'interaction-only'");
    expect(js).toContain('/^[0-9A-Za-z_-]{10,64}$/');
    for (const t of ["type: 'token', token: t", "type: 'error'", "type: 'show'", "type: 'hide'"]) expect(js).toContain(t);
    expect(js).toContain('ReactNativeWebView.postMessage(JSON.stringify(m))');
  });

  test('until the domain is set, no CAPTCHA token is sent', () => {
    if (DOMAIN === null) expect(captchaOn(KEY)).toBe(false);
    else expect(isHostname(DOMAIN)).toBe(true);
  });

  test('a bad site key or host name is refused', () => {
    for (const bad of ['', 'short', '"};alert(1);//', '</script><script>alert(1)</script>', 'x'.repeat(65), 'a&b=cccccccc']) {
      expect(() => turnstilePageUrl('lockintracker.com', bad)).toThrow();
    }
    expect(() => turnstilePageUrl('evil.com/x?', KEY)).toThrow();
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
    expect(captchaOn('', '')).toBe(false);
    expect(captchaOn(KEY, '')).toBe(false);
    expect(captchaOn('', 'lockintracker.app')).toBe(false);
    expect(captchaOn(KEY, 'lockintracker.app')).toBe(true);
    expect(captchaOn(KEY)).toBe(true); // the domain from src/config/domain.ts
  });
});
