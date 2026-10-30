// RevenueCat: links store purchases to the Supabase user (so the webhook knows whose subscription it is),
// tells whether the "access" entitlement is active, and sells the plans on the plans screen.
// Only the public SDK keys (appl_… / goog_…) are used.
// Without keys in .env (or on the web preview) nothing here talks to a store: access comes from the server alone,
// and the plans screen shows the test plans of testStore.ts in development (or "not connected yet" in a build).

import { Platform } from 'react-native';
import Purchases, { type CustomerInfo, type PurchasesPackage } from 'react-native-purchases';

import { failReason, trialDaysOf, type FailReason, type PlanKind, type PlanOption, type Store, type StoreEntitlement } from '@/logic/paywall';

import { TEST_PLANS } from './testStore';

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

/** true: this build can sell (RevenueCat keys are in it). false: nothing can be bought yet, so nobody is locked out by the store. */
export const paymentsReady = (): boolean => ready();

export const storeName = (): Store => (Platform.OS === 'android' ? 'Google Play' : 'App Store');

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

function entitlementOf(info: CustomerInfo): StoreEntitlement {
  const e = info.entitlements.all[ENTITLEMENT];
  if (!e) return { active: false, trial: false, until: null, product: '', willRenew: false };
  return {
    active: e.isActive,
    trial: e.periodType === 'TRIAL',
    until: e.expirationDateMillis ?? null,
    product: e.productIdentifier,
    willRenew: e.willRenew,
  };
}

/** What the store says now (RevenueCat keeps the last answer for offline use); null if it is not set up or could not be asked. */
export async function storeEntitlement(): Promise<StoreEntitlement | null> {
  if (!ready()) return null;
  try {
    return entitlementOf(await Purchases.getCustomerInfo());
  } catch {
    return null;
  }
}

/** Calls `cb` whenever RevenueCat learns something new (a purchase approved later, a renewal, a refund). */
export function onStoreChange(cb: () => void): () => void {
  if (!ready()) return () => {};
  const l = () => cb();
  Purchases.addCustomerInfoUpdateListener(l);
  return () => void Purchases.removeCustomerInfoUpdateListener(l);
}

// The packages of the current offering, by product id, for buying (filled by loadPlans).
const packages = new Map<string, { pkg: PurchasesPackage; kind: PlanKind }>();
const KINDS: Record<string, PlanKind> = { ANNUAL: 'yearly', MONTHLY: 'monthly', LIFETIME: 'lifetime' };

export type PlansResult = { ok: true; plans: PlanOption[]; test: boolean } | { ok: false; error: string };

/**
 * The plans from RevenueCat's current offering (its Annual, Monthly and Lifetime packages): prices in the
 * user's currency and whether this user can still get the free trial.
 */
export async function loadPlans(): Promise<PlansResult> {
  if (!ready()) return __DEV__ ? { ok: true, plans: TEST_PLANS, test: true } : { ok: false, error: 'Payments aren’t connected yet.' };
  try {
    const cur = (await Purchases.getOfferings()).current;
    const found = (cur?.availablePackages ?? []).filter((p) => KINDS[p.packageType]);
    if (!found.length) return { ok: false, error: 'Couldn’t load the plans. Try again in a moment.' };
    // iOS: the store says if this Apple ID already used the trial (Google Play only offers it to those who can get it)
    let eligible: Record<string, { status: number }> = {};
    if (Platform.OS === 'ios') eligible = await Purchases.checkTrialOrIntroductoryPriceEligibility(found.map((p) => p.product.identifier)).catch(() => ({}));
    packages.clear();
    const plans = found.map((p): PlanOption => {
      const kind = KINDS[p.packageType];
      packages.set(p.product.identifier, { pkg: p, kind });
      const used = eligible[p.product.identifier]?.status === 1; // INTRO_ELIGIBILITY_STATUS_INELIGIBLE
      return {
        kind,
        id: p.product.identifier,
        price: p.product.price,
        priceString: p.product.priceString,
        perMonthString: p.product.pricePerMonthString ?? null,
        trialDays: kind === 'lifetime' || used ? null : trialDaysOf(p.product.introPrice),
      };
    });
    const order: PlanKind[] = ['yearly', 'monthly', 'lifetime'];
    return { ok: true, plans: plans.sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind)), test: false };
  } catch {
    return { ok: false, error: 'Couldn’t load the plans. Check your connection and try again.' };
  }
}

/** Which plan a product id is (from the loaded offering; else guessed from the id). */
export function kindOf(productId: string): PlanKind | null {
  const k = packages.get(productId)?.kind;
  if (k) return k;
  if (/life/i.test(productId)) return 'lifetime';
  if (/year|annual/i.test(productId)) return 'yearly';
  if (/month/i.test(productId)) return 'monthly';
  return null;
}

export type BuyResult = { ok: true; ent: StoreEntitlement } | { ok: false; reason: FailReason };

/** Opens the store's own payment window for this plan and waits for its answer. */
export async function buy(productId: string): Promise<BuyResult> {
  const p = packages.get(productId);
  if (!ready() || !p) return { ok: false, reason: 'network' };
  try {
    const r = await Purchases.purchasePackage(p.pkg);
    return { ok: true, ent: entitlementOf(r.customerInfo) };
  } catch (e) {
    const err = e as { code?: string; userCancelled?: boolean | null };
    if (err.code === '6') {
      // PRODUCT_ALREADY_PURCHASED: it is theirs already, bring it back
      const r = await restore();
      if (r.ok) return r;
    }
    return { ok: false, reason: failReason(err.code, err.userCancelled) };
  }
}

export type RestoreResult = { ok: true; ent: StoreEntitlement } | { ok: false; reason: 'not-found' | 'network' };

/** "Restore purchase": asks the store for this Apple ID's / Google account's purchases. */
export async function restore(): Promise<RestoreResult> {
  if (!ready()) return { ok: false, reason: 'network' };
  try {
    const ent = entitlementOf(await Purchases.restorePurchases());
    return ent.active ? { ok: true, ent } : { ok: false, reason: 'not-found' };
  } catch {
    return { ok: false, reason: 'network' };
  }
}

/** Where the user cancels or changes the plan: the store's own subscriptions page. */
export async function managementUrl(): Promise<string> {
  const fallback = Platform.OS === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
  if (!ready()) return fallback;
  try {
    return (await Purchases.getCustomerInfo()).managementURL || fallback;
  } catch {
    return fallback;
  }
}
