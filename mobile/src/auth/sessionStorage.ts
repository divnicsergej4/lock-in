// Where supabase-js keeps the login (access + refresh token). Never plain AsyncStorage: the scheme Supabase
// recommends for Expo ("LargeSecureStore"). The session is too big for SecureStore on some phones, so it is
// encrypted (AES-256-CTR, aes-js) into AsyncStorage, and only the 32-byte key goes into SecureStore
// (Keychain on iOS, Keystore on Android). Every write makes a new key, so a key never encrypts twice.
// Without the key the AsyncStorage copy is useless; signing out or deleting the account removes both.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import { getRandomBytes } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const DATA = 'lockin-auth:'; // AsyncStorage: encrypted session, per supabase-js item
const KEY = 'lockin-auth.'; // SecureStore: its key (SecureStore keys allow only letters, digits, . - _)
const MAGIC = 'lockin1:'; // starts every plaintext: a wrong or mismatched key is noticed, not returned as junk

// Only readable while the phone is unlocked, and never copied to another phone through a backup.
const SECURE: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

const keyName = (item: string) => KEY + item.replace(/[^A-Za-z0-9._-]/g, '_');

function encrypt(value: string) {
  const key = getRandomBytes(32);
  const ctr = new aesjs.ModeOfOperation.ctr(key, new aesjs.Counter(1));
  const data = aesjs.utils.hex.fromBytes(ctr.encrypt(aesjs.utils.utf8.toBytes(MAGIC + value)));
  return { key: aesjs.utils.hex.fromBytes(key), data };
}

function decrypt(keyHex: string, data: string): string | null {
  if (!/^[0-9a-f]{64}$/.test(keyHex) || !/^(?:[0-9a-f]{2})+$/.test(data)) return null;
  const ctr = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(keyHex), new aesjs.Counter(1));
  const text = aesjs.utils.utf8.fromBytes(ctr.decrypt(aesjs.utils.hex.toBytes(data)));
  return text.startsWith(MAGIC) ? text.slice(MAGIC.length) : null;
}

/** The storage given to supabase-js (`auth.storage`). */
export const encryptedSessionStorage = {
  async getItem(item: string): Promise<string | null> {
    try {
      const data = await AsyncStorage.getItem(DATA + item);
      if (data == null) return null;
      const key = await SecureStore.getItemAsync(keyName(item), SECURE);
      return key == null ? null : decrypt(key, data);
    } catch {
      // Keychain locked or unavailable: as if signed out for now; nothing is deleted.
      return null;
    }
  },
  async setItem(item: string, value: string): Promise<void> {
    const { key, data } = encrypt(value);
    await SecureStore.setItemAsync(keyName(item), key, SECURE);
    await AsyncStorage.setItem(DATA + item, data);
  },
  async removeItem(item: string): Promise<void> {
    await Promise.allSettled([AsyncStorage.removeItem(DATA + item), SecureStore.deleteItemAsync(keyName(item), SECURE)]);
  },
};

/**
 * Removes every saved login item and its key, also leftovers (a key whose data is gone, or the other way
 * round). `items` are the supabase-js names that may have a key without data. Personal data is not touched.
 */
export async function wipeSession(items: string[]): Promise<void> {
  let stored: string[] = [];
  try {
    stored = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(DATA)).map((k) => k.slice(DATA.length));
  } catch {
    // still delete the keys we know
  }
  await Promise.allSettled([...new Set([...stored, ...items])].map((i) => encryptedSessionStorage.removeItem(i)));
}
