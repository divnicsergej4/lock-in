import { accessText, decideAccess, parseUntil } from '../access';
import { authMessage, canEnterCode, cleanCode, codeSent, isEmail, isWrongCode, MAX_WRONG_CODES, needsNewCode, normalizeEmail, otpStart, resendIn, wrongCode } from '../otp';

const NOW = Date.parse('2026-10-25T12:00:00Z');

describe('email code', () => {
  test('"Send code" is locked for 60 s after sending', () => {
    expect(resendIn(otpStart, NOW)).toBe(0);
    const st = codeSent('ana@example.com', NOW);
    expect(resendIn(st, NOW)).toBe(60);
    expect(resendIn(st, NOW + 59_001)).toBe(1);
    expect(resendIn(st, NOW + 60_000)).toBe(0);
  });

  test('after 5 wrong codes the code is dropped until a new one is sent', () => {
    let st = codeSent('ana@example.com', NOW);
    for (let i = 0; i < MAX_WRONG_CODES - 1; i++) st = wrongCode(st);
    expect(canEnterCode(st)).toBe(true);
    st = wrongCode(st);
    expect(canEnterCode(st)).toBe(false);
    expect(needsNewCode(st)).toBe(true);
    st = codeSent(st.email, NOW + 61_000);
    expect(canEnterCode(st)).toBe(true);
    expect(st.wrong).toBe(0);
  });

  test('no code field before a code was sent', () => {
    expect(canEnterCode(otpStart)).toBe(false);
  });

  test('only a wrong or expired code counts as a wrong try, not a lost connection or a limit', () => {
    expect(isWrongCode({ code: 'otp_expired', status: 403 })).toBe(true);
    expect(isWrongCode({ name: 'AuthRetryableFetchError', status: 0 })).toBe(false);
    expect(isWrongCode({ code: 'over_request_rate_limit', status: 429 })).toBe(false);
  });

  test('messages are short English text, never the raw server error', () => {
    expect(authMessage({ code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' })).toBe('That code is wrong or expired.');
    expect(authMessage({ code: 'over_email_send_rate_limit', status: 429 })).toBe('Too many tries. Wait a few minutes and try again.');
    expect(authMessage({ status: 429 })).toBe('Too many tries. Wait a few minutes and try again.');
    expect(authMessage({ name: 'AuthRetryableFetchError', status: 0 })).toBe('Couldn’t reach the server. Check your connection.');
    expect(authMessage({ code: 'captcha_failed', status: 400 })).toBe('Couldn’t check that you’re human. Try again.');
    expect(authMessage({ code: 'weird', status: 500, message: 'db exploded at line 3' })).toBe('Something went wrong. Try again.');
  });

  test('typing and pasting the code, and the email', () => {
    expect(cleanCode('123 456')).toBe('123456');
    expect(cleanCode('Code: 1234567')).toBe('123456');
    expect(normalizeEmail('  Ana@Example.COM ')).toBe('ana@example.com');
    expect(isEmail('ana@example.com')).toBe(true);
    expect(isEmail('ana@example')).toBe(false);
    expect(isEmail('ana @example.com')).toBe(false);
  });
});

describe('access comes from the server and RevenueCat, never from the phone', () => {
  test('server my_access() in the future: active until then', () => {
    expect(decideAccess('2026-10-30T12:00:00+00:00', null, NOW)).toEqual({ kind: 'active', until: Date.parse('2026-10-30T12:00:00Z') });
    expect(decideAccess('2026-10-30T12:00:00+00:00', false, NOW).kind).toBe('active');
  });

  test('lifetime purchase (infinity): active with no end', () => {
    expect(parseUntil('infinity')).toBe(Infinity);
    expect(decideAccess('infinity', null, NOW)).toEqual({ kind: 'active', until: null });
  });

  test('expired or never had one: no access, unless the store just sold one (webhook not there yet)', () => {
    expect(decideAccess('2026-10-20T00:00:00Z', null, NOW)).toEqual({ kind: 'none' });
    expect(decideAccess(null, false, NOW)).toEqual({ kind: 'none' });
    expect(decideAccess(null, true, NOW)).toEqual({ kind: 'active', until: null, syncing: true });
  });

  test('server unreachable or a strange answer: unknown, not active', () => {
    expect(decideAccess('error', null, NOW)).toEqual({ kind: 'unknown' });
    expect(decideAccess('error', false, NOW)).toEqual({ kind: 'unknown' });
    expect(decideAccess({ active: true }, null, NOW)).toEqual({ kind: 'unknown' });
    expect(decideAccess('yes', null, NOW)).toEqual({ kind: 'unknown' });
  });

  test('the line in Settings', () => {
    expect(accessText({ kind: 'active', until: Date.parse('2026-11-01T12:00:00Z') }, NOW)).toBe('Active until Nov 1');
    expect(accessText({ kind: 'active', until: null }, NOW)).toBe('Plan active, no end date');
    expect(accessText({ kind: 'none' }, NOW)).toBe('No active trial or plan');
  });
});
