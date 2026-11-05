jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
// Keychain / Keystore stand-in that remembers the options each key was saved with.
jest.mock('expo-secure-store', () => {
  const items = new Map<string, { value: string; options: unknown }>();
  return {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
    __items: items,
    getItemAsync: jest.fn(async (k: string) => items.get(k)?.value ?? null),
    setItemAsync: jest.fn(async (k: string, value: string, options: unknown) => {
      if (!/^[A-Za-z0-9._-]+$/.test(k)) throw new Error('invalid key');
      if (value.length > 2048) throw new Error('value too big for SecureStore');
      items.set(k, { value, options });
    }),
    deleteItemAsync: jest.fn(async (k: string) => void items.delete(k)),
  };
});
jest.mock('expo-crypto', () => ({ getRandomBytes: (n: number) => new Uint8Array(require('crypto').randomBytes(n)) }));

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { deleteAccount, signOutHere } from '../account';
import { encryptedSessionStorage as store, wipeSession } from '../sessionStorage';
import { isPublicKey, makeClient, STORAGE_ITEMS, STORAGE_KEY } from '../supabase';

const secure = (SecureStore as unknown as { __items: Map<string, { value: string; options: { keychainAccessible?: string } }> }).__items;

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload: object) => `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url(payload)}.c2ln`;
const ANON = jwt({ role: 'anon', iss: 'supabase' });
const UID = '6f1c2a3b-1234-4abc-8def-0123456789ab';
// A real session is ~1.5–4 KB (two tokens and the user with its identities): over SecureStore's 2 KB.
const ACCESS = jwt({ sub: UID, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, email: 'ana@example.com', pad: 'x'.repeat(1500) });
const REFRESH = 'refresh-token-abc123';

async function everything() {
  const keys = await AsyncStorage.getAllKeys();
  const values = await AsyncStorage.multiGet(keys);
  return { async: Object.fromEntries(values), secure: [...secure.keys()] };
}

beforeEach(async () => {
  await AsyncStorage.clear();
  secure.clear();
});

describe('encrypted session storage', () => {
  const session = JSON.stringify({ access_token: ACCESS, refresh_token: REFRESH, user: { id: UID, email: 'ana@example.com' } });

  test('what is saved comes back the same, also when it is bigger than SecureStore allows', async () => {
    expect(session.length).toBeGreaterThan(2048);
    await store.setItem(STORAGE_KEY, session);
    expect(await store.getItem(STORAGE_KEY)).toBe(session);
    expect(await store.getItem('something-else')).toBeNull();
  });

  test('AsyncStorage holds only ciphertext; SecureStore holds only the 32-byte key', async () => {
    await store.setItem(STORAGE_KEY, session);
    const all = await everything();
    const blob = Object.values(all.async).join('');
    expect(blob).not.toContain(REFRESH);
    expect(blob).not.toContain(ACCESS.split('.')[1]);
    expect(blob).not.toContain('ana@example.com');
    expect(blob).not.toContain('refresh_token');
    expect(all.secure).toHaveLength(1);
    const k = secure.get(all.secure[0])!;
    expect(k.value).toMatch(/^[0-9a-f]{64}$/);
    expect(k.options.keychainAccessible).toBe('WHEN_UNLOCKED_THIS_DEVICE_ONLY'); // unlocked phone only, never in a backup
  });

  test('every save uses a new key and gives a different ciphertext', async () => {
    await store.setItem(STORAGE_KEY, session);
    const first = await everything();
    const key1 = secure.get(first.secure[0])!.value;
    await store.setItem(STORAGE_KEY, session);
    const second = await everything();
    expect(secure.get(second.secure[0])!.value).not.toBe(key1);
    expect(Object.values(second.async)).not.toEqual(Object.values(first.async));
    expect(await store.getItem(STORAGE_KEY)).toBe(session);
  });

  test('without its key, with a wrong key or with damaged data nothing is returned (no junk, no crash)', async () => {
    await store.setItem(STORAGE_KEY, session);
    const [keyName] = [...secure.keys()];
    const good = secure.get(keyName)!;
    secure.set(keyName, { ...good, value: 'ab'.repeat(32) });
    expect(await store.getItem(STORAGE_KEY)).toBeNull();
    secure.set(keyName, { ...good, value: 'not hex' });
    expect(await store.getItem(STORAGE_KEY)).toBeNull();
    secure.set(keyName, good);
    const [dataKey] = await AsyncStorage.getAllKeys();
    await AsyncStorage.setItem(dataKey, 'zz' + (await AsyncStorage.getItem(dataKey))!.slice(2));
    expect(await store.getItem(STORAGE_KEY)).toBeNull();
    secure.delete(keyName);
    expect(await store.getItem(STORAGE_KEY)).toBeNull();
  });

  test('a locked Keychain reads as signed out and deletes nothing', async () => {
    await store.setItem(STORAGE_KEY, session);
    (SecureStore.getItemAsync as jest.Mock).mockRejectedValueOnce(new Error('locked'));
    expect(await store.getItem(STORAGE_KEY)).toBeNull();
    expect(await store.getItem(STORAGE_KEY)).toBe(session);
  });

  test('removeItem deletes both the data and the key', async () => {
    await store.setItem(STORAGE_KEY, session);
    await store.removeItem(STORAGE_KEY);
    expect(await everything()).toEqual({ async: {}, secure: [] });
  });

  test('wipeSession removes every login item and stray keys, and leaves personal data alone', async () => {
    await AsyncStorage.setItem('lockin', '{"start":750}');
    await store.setItem(STORAGE_KEY, session);
    await store.setItem(`${STORAGE_KEY}-code-verifier`, 'verifier');
    await store.setItem('old-item', 'x');
    await AsyncStorage.removeItem('lockin-auth:' + `${STORAGE_KEY}-code-verifier`); // a key left without data
    await wipeSession(STORAGE_ITEMS);
    expect(await everything()).toEqual({ async: { lockin: '{"start":750}' }, secure: [] });
  });
});

describe('only a public key in the app', () => {
  test('anon JWT and publishable keys are accepted, secret and service_role keys refused', () => {
    expect(isPublicKey(ANON)).toBe(true);
    expect(isPublicKey('sb_publishable_abc')).toBe(true);
    expect(isPublicKey('sb_secret_abc')).toBe(false);
    expect(isPublicKey(jwt({ role: 'service_role' }))).toBe(false);
    expect(isPublicKey('garbage')).toBe(false);
    expect(() => makeClient('https://x.supabase.co', jwt({ role: 'service_role' }))).toThrow(/public/);
  });
});

// The real supabase-js client with this storage, against a fake auth server.
describe('with supabase-js', () => {
  type Call = { url: string; method: string; auth: string | null };
  function server(opts: { deleteStatus?: number; offline?: boolean } = {}) {
    const calls: Call[] = [];
    const fake = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const headers = new Headers(init?.headers);
      calls.push({ url, method: init?.method ?? 'GET', auth: headers.get('authorization') });
      if (opts.offline) throw new TypeError('Network request failed');
      const json = (status: number, body: unknown) => new Response(body == null ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
      if (url.includes('/auth/v1/user')) return json(200, { id: UID, email: 'ana@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' });
      if (url.includes('/auth/v1/logout')) return new Response(null, { status: 204 });
      if (url.includes('/functions/v1/delete-account')) return json(opts.deleteStatus ?? 200, opts.deleteStatus && opts.deleteStatus >= 400 ? { error: 'x' } : { deleted: true });
      return json(404, { msg: 'unexpected ' + url });
    }) as typeof fetch;
    return { calls, fetch: fake };
  }

  async function signedIn(s: ReturnType<typeof server>) {
    const client = makeClient('https://proj.supabase.co', ANON, s.fetch);
    const { error } = await client.auth.setSession({ access_token: ACCESS, refresh_token: REFRESH });
    expect(error).toBeNull();
    return client;
  }
  const wipe = () => wipeSession(STORAGE_ITEMS);

  test('the session supabase-js saves is encrypted, and it comes back after a restart', async () => {
    const s = server();
    await signedIn(s);
    const all = await everything();
    expect(Object.keys(all.async)).toEqual([`lockin-auth:${STORAGE_KEY}`]);
    expect(JSON.stringify(all.async)).not.toContain(REFRESH);
    expect(all.secure).toEqual([`lockin-auth.${STORAGE_KEY}`]);
    const again = makeClient('https://proj.supabase.co', ANON, s.fetch); // the app opened again
    const { data } = await again.auth.getSession();
    expect(data.session?.refresh_token).toBe(REFRESH);
    expect(data.session?.user.id).toBe(UID);
  });

  test('signing out removes the session and its key', async () => {
    const s = server();
    const client = await signedIn(s);
    await signOutHere(client, wipe);
    expect(await everything()).toEqual({ async: {}, secure: [] });
    expect(s.calls.some((c) => c.url.includes('/logout') && c.url.includes('scope=local'))).toBe(true);
    expect((await client.auth.getSession()).data.session).toBeNull();
  });

  test('signing out with no connection still removes everything from the phone', async () => {
    await signedIn(server());
    const off = server({ offline: true });
    const offline = makeClient('https://proj.supabase.co', ANON, off.fetch); // the app opened again, no signal
    expect((await offline.auth.getSession()).data.session?.user.id).toBe(UID);
    await signOutHere(offline, wipe);
    expect(off.calls.some((c) => c.url.includes('/logout'))).toBe(true);
    expect(await everything()).toEqual({ async: {}, secure: [] });
    expect((await offline.auth.getSession()).data.session).toBeNull();
  });

  test('deleting the account calls delete-account with the login, then removes session and key', async () => {
    const s = server();
    const client = await signedIn(s);
    expect(await deleteAccount(client, wipe)).toEqual({ ok: true });
    const call = s.calls.find((c) => c.url.endsWith('/functions/v1/delete-account'))!;
    expect(call.method).toBe('POST');
    expect(call.auth).toBe(`Bearer ${ACCESS}`);
    expect(await everything()).toEqual({ async: {}, secure: [] });
  });

  test('if the server does not confirm the deletion, the user stays signed in and is told', async () => {
    const s = server({ deleteStatus: 502 });
    const client = await signedIn(s);
    const r = await deleteAccount(client, wipe);
    expect(r).toEqual({ ok: false, error: 'Couldn’t delete your account. Try again.' });
    expect((await client.auth.getSession()).data.session?.user.id).toBe(UID);
    expect((await everything()).secure).toHaveLength(1);
  });
});
