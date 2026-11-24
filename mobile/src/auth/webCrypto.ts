// Web Crypto for supabase-js on the phone. The Google sign-in uses PKCE: supabase-js makes a random verifier
// (crypto.getRandomValues) and sends only its SHA-256 (crypto.subtle.digest). React Native has no crypto.subtle,
// so supabase-js fell back to sending the verifier itself ("plain", warning "WebCrypto API is not supported"):
// whoever caught the sign-in link could then use the code. This fills in both from expo-crypto (the system's
// random generator and SHA-256), so the challenge is S256. Imported by supabase.ts before the client is made.

import { CryptoDigestAlgorithm, digest, getRandomValues } from 'expo-crypto';

type Target = { crypto?: { getRandomValues?: unknown; subtle?: { digest?: unknown } } };

export async function sha256Digest(algorithm: string | { name: string }, data: BufferSource): Promise<ArrayBuffer> {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  if (name.toUpperCase() !== 'SHA-256') throw new Error(`Unsupported digest: ${name}`);
  return digest(CryptoDigestAlgorithm.SHA256, data);
}

/** Adds what is missing; a real Web Crypto (web, tests on Node) is left alone. */
export function installWebCrypto(target: Target = globalThis as unknown as Target) {
  try {
    const c = target.crypto ?? (target.crypto = {});
    if (typeof c.getRandomValues !== 'function') c.getRandomValues = getRandomValues;
    if (typeof c.subtle?.digest !== 'function') c.subtle = { ...(c.subtle ?? {}), digest: sha256Digest };
  } catch {
    // a read-only crypto object already has what supabase-js needs
  }
}

installWebCrypto();
