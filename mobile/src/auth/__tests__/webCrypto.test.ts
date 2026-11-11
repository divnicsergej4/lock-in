// The Google sign-in's PKCE challenge must be SHA-256 (S256), not the verifier itself ("plain"), also where the
// phone has no Web Crypto of its own. expo-crypto is replaced by Node's crypto (the real one needs a phone).
import { createHash } from 'node:crypto';

jest.mock('expo-crypto', () => {
  const node = require('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: jest.fn(async (_alg: string, data: Uint8Array) => {
      const out = node.createHash('sha256').update(Buffer.from(data.buffer, data.byteOffset, data.byteLength)).digest();
      return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
    }),
    getRandomValues: jest.fn(<T extends ArrayBufferView>(a: T) => node.randomFillSync(a)),
  };
});

import { generatePKCEChallenge, getCodeChallengeAndMethod } from '@supabase/auth-js/dist/main/lib/helpers';

import { installWebCrypto } from '../webCrypto';

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('without a Web Crypto of its own (React Native)', () => {
  const real = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  beforeEach(() => {
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    installWebCrypto();
  });
  afterEach(() => {
    if (real) Object.defineProperty(globalThis, 'crypto', real);
  });

  test('the challenge is the SHA-256 of the verifier, base64url', async () => {
    const verifier = 'a'.repeat(56);
    const challenge = await generatePKCEChallenge(verifier);
    expect(challenge).not.toBe(verifier);
    expect(challenge).toBe(b64url(createHash('sha256').update(verifier).digest()));
  });

  test('supabase-js asks for s256, with a random verifier', async () => {
    const store = new Map<string, string>();
    const storage = { getItem: async (k: string) => store.get(k) ?? null, setItem: async (k: string, v: string) => void store.set(k, v), removeItem: async (k: string) => void store.delete(k) };
    const { getRandomValues } = jest.requireMock('expo-crypto');
    getRandomValues.mockClear();
    const [challenge, method] = await getCodeChallengeAndMethod(storage as never, 'sb');
    expect(method).toBe('s256');
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/); // a SHA-256, base64url
    expect(getRandomValues).toHaveBeenCalled(); // the verifier comes from the system's random generator
    expect(store.size).toBeGreaterThan(0); // and stays on the phone
  });

  test('only SHA-256 is offered', async () => {
    await expect((globalThis as any).crypto.subtle.digest('SHA-1', new Uint8Array(1))).rejects.toThrow('Unsupported digest');
  });
});

test('a real Web Crypto is left alone', () => {
  const subtle = { digest: () => 'real' };
  const target = { crypto: { getRandomValues: () => 'real', subtle } };
  installWebCrypto(target);
  expect(target.crypto.subtle).toBe(subtle);
});
