// RevenueCat: links store purchases to the Supabase user (so the webhook knows whose subscription it is)
// and tells whether the "access" entitlement is active. Only the public SDK keys (appl_… / goog_…) are used.
// Without keys in .env (or on the web preview) everything here does nothing and access comes from the server alone.

import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';

/** The entitlement to create in RevenueCat (Product catalog > Entitlements) and attach every product to. */
export const ENTITLEMENT = 'access';

const apiKey = Platform.select({ ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY, android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY });
let configured = false;

function ready(): boolean {
  if (!apiKey || Platform.OS === 'web') return false;
  if (!configured) {
    Purchases.configure({ apiKey });
    configured = true;
  }
  return true;
}

/** After sign-in: purchases on this phone now belong to this Supabase user. */
export async function linkPurchases(userId: string): Promise<void> {
  if (!ready()) return;
  try {
    await Purchases.logIn(userId);
  } catch {
    // tried again on the next start
  }
}

/** On sign-out and account deletion: this phone is anonymous again for RevenueCat. */
export async function unlinkPurchases(): Promise<void> {
  if (!ready()) return;
  try {
    if (!(await Purchases.isAnonymous())) await Purchases.logOut();
  } catch {
    // nothing to undo
  }
}

/** true / false from RevenueCat, null if it is not set up or could not be asked. */
export async function storeAccess(): Promise<boolean | null> {
  if (!ready()) return null;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT] !== undefined;
  } catch {
    return null;
  }
}
