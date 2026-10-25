// Who is signed in, and whether they have a trial or subscription (asked from the server and RevenueCat on
// every start and every return to the app, never saved; see access.ts).

import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { decideAccess, type Access } from './access';
import { deleteAccount as deleteOnServer, signOutHere, type Result } from './account';
import { linkPurchases, storeAccess, unlinkPurchases } from './purchases';
import { supabase, wipeLocalSession } from './supabase';
import { disableGoalAlerts } from '@/notifications/push';
import { useStore } from '@/store/StoreProvider';

type Auth = {
  /** false: no Supabase keys in this build (or the web preview), sign-in is not available. */
  available: boolean;
  session: Session | null;
  access: Access;
  refreshAccess: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<Result>;
};

const Ctx = createContext<Auth>({
  available: false,
  session: null,
  access: { kind: 'signed-out' },
  refreshAccess: async () => {},
  signOut: async () => {},
  deleteAccount: async () => ({ ok: false, error: 'Accounts are not available.' }),
});
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>({ kind: 'signed-out' });
  const { update } = useStore();
  const uid = session?.user.id ?? null;
  const asked = useRef(0); // only the latest question may set the answer

  const refreshAccess = useCallback(async () => {
    const n = ++asked.current;
    if (!supabase || !uid) return setAccess({ kind: 'signed-out' });
    setAccess((a) => (a.kind === 'signed-out' ? { kind: 'checking' } : a));
    const [server, store] = await Promise.all([
      supabase.rpc('my_access').then(({ data, error }) => (error ? 'error' : data), () => 'error' as const),
      storeAccess(),
    ]);
    if (n === asked.current) setAccess(decideAccess(server, store, Date.now()));
  }, [uid]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (uid) linkPurchases(uid);
    refreshAccess();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshAccess());
    return () => sub.remove();
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

  const value = useMemo(
    () => ({ available: !!supabase, session, access, refreshAccess, signOut, deleteAccount }),
    [session, access, refreshAccess, signOut, deleteAccount],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
