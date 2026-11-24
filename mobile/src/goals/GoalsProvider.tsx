// Friends and shared goals for the whole app: what the server says (loaded after sign-in, again whenever another
// member changes something, through Realtime, and on every return to the app), the demo's sample goal, and one
// way to run an action: look only in the demo, a clear note when the plan has ended, "What should friends call
// you?" before the first invite or goal, the toast, and a fresh load afterwards.

import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ENDED, LIVE_TABLES, loadSnapshot, type Done } from './api';
import { NamePrompt } from './NamePrompt';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/auth/supabase';
import { useAppToast } from '@/components/AppToast';
import { useDemoGuard } from '@/components/demoGuard';
import type { Snapshot } from '@/logic/goals';
import { demoSnapshot } from '@/logic/goalsDemo';
import { enableGoalAlerts } from '@/notifications/push';
import { useStore } from '@/store/StoreProvider';

type Action<T> = (db: SupabaseClient, me: string) => Promise<Done<T>>;

type Goals = {
  /** Signed in (or the demo): the screens show the real thing, not the sign-in card. */
  on: boolean;
  snap: Snapshot | null;
  status: 'idle' | 'loading' | 'ready' | 'error';
  refresh: () => void;
  /** false when the trial or plan has ended: everything is visible, only leaving works. */
  canAct: boolean;
  /**
   * Runs an action against the server. `always`: also without a plan (leaving a goal). `named`: asks for a
   * display name first. Returns null when it did not run.
   */
  run: <T>(fn: Action<T>, opts?: { always?: boolean; named?: boolean; quiet?: boolean }) => Promise<Done<T> | null>;
  askName: () => void;
  /** Right after the user's own tap that puts them in a goal (making one, paying in): shared goal alerts, once. */
  offerAlerts: () => void;
};

const Ctx = createContext<Goals>({
  on: false,
  snap: null,
  status: 'idle',
  refresh: () => {},
  canAct: false,
  run: async () => null,
  askName: () => {},
  offerAlerts: () => {},
});

// Not "asked" yet when the phone or the build cannot have push at all (Expo Go, the simulator): the real build asks.
const NO_PUSH_HERE = ['Shared goal alerts need a real phone.', 'Shared goal alerts come with the full app build.'];
export const useGoals = () => useContext(Ctx);

export function GoalsProvider({ children }: { children: ReactNode }) {
  const { session, access } = useAuth();
  const { demo, epoch, state, update } = useStore();
  const { no } = useDemoGuard();
  const toast = useAppToast();
  const uid = session?.user.id ?? null;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Goals['status']>('idle');
  const [naming, setNaming] = useState<null | { then?: () => void }>(null);
  const asked = useRef(0);
  const askedName = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    const n = ++asked.current;
    if (!supabase || !uid) {
      setSnap(null);
      setStatus('idle');
      return;
    }
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    const r = await loadSnapshot(supabase, uid);
    if (n !== asked.current) return;
    if (r.ok) {
      setSnap(r.data);
      setStatus('ready');
    } else setStatus((s) => (s === 'ready' ? s : 'error'));
  }, [uid]);

  // first load, and again on every return to the app
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => sub.remove();
  }, [refresh]);

  // live: someone else paid in, joined, left, answered an invite or nudged (many changes at once: one load)
  useEffect(() => {
    if (!supabase || !uid) return;
    const client = supabase;
    let t: ReturnType<typeof setTimeout> | null = null;
    const soon = () => {
      if (t) clearTimeout(t);
      t = setTimeout(refresh, 250);
    };
    const ch = client.channel('goals-' + uid);
    for (const table of LIVE_TABLES) ch.on('postgres_changes', { event: '*', schema: 'public', table }, soon);
    ch.subscribe();
    return () => {
      if (t) clearTimeout(t);
      client.removeChannel(ch);
    };
  }, [uid, refresh]);

  // the first time after signing in: ask for the name if there is none yet
  useEffect(() => {
    if (!uid || !snap || snap.me !== uid || askedName.current === uid) return;
    askedName.current = uid;
    if (!snap.names[uid]) setNaming({});
  }, [uid, snap]);

  const demoSnap = useMemo(() => (demo ? demoSnapshot(Date.now()) : null), [demo, epoch]); // eslint-disable-line react-hooks/exhaustive-deps
  const ended = access.kind === 'none';

  const run = useCallback(
    async <T,>(fn: Action<T>, opts: { always?: boolean; named?: boolean; quiet?: boolean } = {}): Promise<Done<T> | null> => {
      if (demo) {
        no();
        return null;
      }
      if (!supabase || !uid) return null;
      if (ended && !opts.always) {
        toast(ENDED);
        return null;
      }
      if (opts.named && snap && !snap.names[uid]) {
        setNaming({});
        return null;
      }
      const r = await fn(supabase, uid);
      if (!r.ok) toast(r.error);
      else if (r.note && !opts.quiet) toast(r.note);
      refresh();
      return r;
    },
    [demo, no, uid, ended, toast, snap, refresh],
  );

  const pushOn = !!state.goalPush;
  const pushAsked = !!state.goalPushAsked;
  const offerAlerts = useCallback(async () => {
    if (demo || !supabase || !uid || pushOn || pushAsked) return;
    const r = await enableGoalAlerts(supabase);
    if (r.ok) {
      update((s) => ({ ...s, goalPush: true, goalPushAsked: true }));
      toast('Shared goal alerts on');
    } else if (!NO_PUSH_HERE.includes(r.error)) update((s) => ({ ...s, goalPushAsked: true }));
  }, [demo, uid, pushOn, pushAsked, update, toast]);

  const value = useMemo<Goals>(
    () => ({
      on: demo || !!uid,
      snap: demo ? demoSnap : snap,
      status: demo ? 'ready' : status,
      refresh,
      canAct: !demo && !ended,
      run,
      askName: () => (demo ? no() : setNaming({})),
      offerAlerts,
    }),
    [demo, demoSnap, uid, snap, status, refresh, ended, run, no, offerAlerts],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {naming && uid && (
        <NamePrompt
          current={snap?.names[uid] ?? ''}
          onClose={() => setNaming(null)}
          onSaved={() => {
            setNaming(null);
            refresh();
            naming.then?.();
          }}
        />
      )}
    </Ctx.Provider>
  );
}
