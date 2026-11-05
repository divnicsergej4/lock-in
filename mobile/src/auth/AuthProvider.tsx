// Who is signed in, and whether they have a trial or subscription (asked from the server and RevenueCat on
// every start and every return to the app, never saved; see access.ts).

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import type { StoreEntitlement } from '@/logic/paywall';

import { decideAccess, isLocked, type Access } from './access';
import { deleteAccount as deleteOnServer, signOutHere, type Result } from './account';
import { linkPurchases, onStoreChange, paymentsReady, storeEntitlement, unlinkPurchases } from './purchases';
import { supabase, wipeLocalSession } from './supabase';
import { disableGoalAlerts } from '@/notifications/push';
import { useStore } from '@/store/StoreProvider';

type Auth = {
  /** false: no Supabase keys in this build (or the web preview), sign-in is not available. */
  available: boolean;
  session: Session | null;
  access: Access;
  /** RevenueCat's answer for this phone (also without an account); null if there is no store yet or it could not be asked. */
  store: StoreEntitlement | null;
  /** No trial or plan: only the plans screen and the demo (isLocked in access.ts). */
  locked: boolean;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<Result>;
};

const Ctx = createContext<Auth>({
  available: false,
  session: null,
  access: { kind: 'signed-out' },
  store: null,
  locked: false,
  refreshAccess: async () => {},
  signOut: async () => {},
  deleteAccount: async () => ({ ok: false, error: 'Accounts are not available.' }),
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>({ kind: 'signed-out' });
  const [store, setStore] = useState<StoreEntitlement | null>(null);
  const { update } = useStore();
  const uid = session?.user.id ?? null;
  const asked = useRef(0); // only the latest question may set the answer
  const synced = useRef<string | null>(null); // the user whose store purchase was copied to the server this session

  const refreshAccess = useCallback(async () => {
    const n = ++asked.current;
    if (!supabase || !uid) {
      const s = await storeEntitlement();
      if (n !== asked.current) return;
      setStore(s);
      return setAccess({ kind: 'signed-out' });
    }
    setAccess((a) => (a.kind === 'signed-out' ? { kind: 'checking' } : a));
    const db = supabase;
    const ask = () => db.rpc('my_access').then(({ data, error }) => (error ? 'error' : data), () => 'error' as const);
    const [server, s] = await Promise.all([ask(), storeEntitlement()]);
    if (n !== asked.current) return;
    setStore(s);
    let a = decideAccess(server, s ? s.active : null, Date.now());
    setAccess(a);
    // Bought before signing in (or the webhook missed it): the store knows, the server not yet. Ask the server to
    // read it from RevenueCat itself (sync-store-access), once per session, then ask again.
    if (a.kind === 'active' && a.syncing && synced.current !== uid) {
      synced.current = uid;
      await db.functions.invoke('sync-store-access', { method: 'POST', body: {} }).catch(() => null);
      const again = await ask();
      if (n !== asked.current) return;
      a = decideAccess(again, s ? s.active : null, Date.now());
      setAccess(a);
    }
  }, [uid]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      if (uid) await linkPurchases(uid); // first, so RevenueCat answers for this account
      refreshAccess();
    })();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshAccess());
    const off = onStoreChange(() => refreshAccess()); // e.g. a purchase that waited for approval went through
    return () => {
      sub.remove();
      off();
    };
  }, [uid, refreshAccess]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await disableGoalAlerts(supabase); // while still signed in: this phone stops getting that account's alerts
    update((s) => ({ ...s, goalPush: false }));
    await unlinkPurchases();
    await signOutHere(supabase, wipeLocalSession);
    setSession(null);
  }, [update]);

  const deleteAccount = useCallback(async (): Promise<Result> => {
    if (!supabase) return { ok: false, error: 'Accounts are not available.' };
    const r = await deleteOnServer(supabase, wipeLocalSession);
    if (r.ok) {
      await disableGoalAlerts(null); // the server already removed the tokens with the account
      update((s) => ({ ...s, goalPush: false }));
      await unlinkPurchases();
      setSession(null);
    }
    return r;
  }, [update]);

  const locked = isLocked(!!session, access, store, paymentsReady());
  const value = useMemo(
    () => ({ available: !!supabase, session, access, store, locked, refreshAccess, signOut, deleteAccount }),
    [session, access, store, locked, refreshAccess, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
