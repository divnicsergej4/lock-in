// The plans screen and what follows the button (docs/dizajn/placanje): plans → the store's own payment window →
// "Locking you in…" while the store and the server are asked → "You're locked in." → the guided tour or not;
// or "That didn't go through." with the reason. Restore purchase → "Welcome back." or "No purchase found".
// Opened after the setup of a new user, from Settings > Subscription, and by itself when the app is locked
// (no trial or plan: then there is no ✕, only the plans, the demo and the restore).

import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '@/auth/AuthProvider';
import { buy, kindOf, loadPlans, paymentsReady, restore, storeName, type BuyResult, type PlansResult } from '@/auth/purchases';
import { testEntitlement } from '@/auth/testStore';
import { useAppToast } from '@/components/AppToast';
import { FailedView, ProcessingView, RestoredView, SuccessView } from '@/components/paywall/AfterViews';
import { PlansView } from '@/components/paywall/PlansView';
import { PW } from '@/components/paywall/theme';
import { webUrl } from '@/config/domain';
import { DEMO_ON, demoData } from '@/logic/demo';
import { defaultPlan, notFoundText, restoredRows, successView, type FailReason, type PlanKind, type PlanOption, type StoreEntitlement } from '@/logic/paywall';
import { askPermission } from '@/notifications/local';
import { syncTrialReminder } from '@/notifications/trial';
import { useStore } from '@/store/StoreProvider';
import { inter } from '@/theme';
import { tour } from '@/tour/TourOverlay';

type Screen =
  | { k: 'plans' }
  | { k: 'processing'; step: number; shut: boolean; ent?: StoreEntitlement }
  | { k: 'success'; ent: StoreEntitlement }
  | { k: 'failed'; reason: FailReason }
  | { k: 'restored'; ent: StoreEntitlement };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SUPPORT = 'support@lockintracker.app';

export default function Paywall() {
  const auth = useAuth();
  const { state, update, demo, startDemo } = useStore();
  const toast = useAppToast();
  const store = storeName();
  const [plans, setPlans] = useState<PlansResult | null>(null);
  const [picked, setPicked] = useState<PlanOption | null>(null);
  const [screen, setScreen] = useState<Screen>({ k: 'plans' });
  const [remind, setRemind] = useState(state.trialRem !== false);
  const [busy, setBusy] = useState(false);
  const [chooser, setChooser] = useState(false); // test store: what the "store" answers
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const load = useCallback(async () => {
    setPlans(null);
    const r = await loadPlans();
    if (!alive.current) return;
    setPlans(r);
    if (r.ok) setPicked((p) => r.plans.find((x) => x.id === p?.id) ?? defaultPlan(r.plans));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // nothing to go back to while the store is being asked
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => screen.k === 'processing');
    return () => sub.remove();
  }, [screen.k]);

  // "Waiting for approval." (Ask to Buy): when it is approved, RevenueCat tells us and it goes on by itself
  useEffect(() => {
    if (screen.k === 'failed' && screen.reason === 'pending' && auth.store?.active) setScreen({ k: 'success', ent: auth.store });
  }, [screen, auth.store]);

  /** Back to the app (Home, or the screen it was opened from); `then` runs once it is there. */
  const leave = (then?: () => void) => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
    if (then) setTimeout(then, 600);
  };

  const testMode = !!(plans?.ok && plans.test);
  const kindOfEnt = (e: StoreEntitlement): PlanKind | null => kindOf(e.product) ?? picked?.kind ?? null;
  const priceOf = (k: PlanKind | null) => (plans?.ok ? plans.plans.find((p) => p.kind === k)?.priceString ?? null : null);

  /** 08: the store's window, then the three steps, then the padlock shuts. */
  const run = async (doBuy: () => Promise<BuyResult>) => {
    setScreen({ k: 'processing', step: 0, shut: false });
    const r = await doBuy();
    if (!alive.current) return;
    if (!r.ok) return setScreen({ k: 'failed', reason: r.reason });
    setScreen({ k: 'processing', step: 1, shut: false });
    // unlocking: ask the store and the server again (the server copies a purchase it has not heard of yet)
    await Promise.all([auth.refreshAccess(), wait(650)]);
    if (!alive.current) return;
    setScreen({ k: 'processing', step: 2, shut: false });
    await wait(550);
    if (!alive.current) return;
    setScreen({ k: 'processing', step: 3, shut: true, ent: r.ent });
  };

  const onBuy = () => {
    if (!picked) return;
    if (testMode) return setChooser(true);
    if (!paymentsReady()) return toast('Payments aren’t connected yet.');
    run(() => buy(picked.id));
  };

  const testAnswer = (a: 'ok' | FailReason) => {
    setChooser(false);
    const kind = picked?.kind ?? 'yearly';
    run(async () => {
      await wait(900); // the store's window
      return a === 'ok' ? { ok: true, ent: testEntitlement(kind, Date.now()) } : { ok: false, reason: a };
    });
  };

  const onRestore = async () => {
    if (busy) return;
    const nf = notFoundText(store);
    if (testMode) {
      Alert.alert('Test store', 'What should the store find?', [
        { text: 'A yearly plan', onPress: () => setScreen({ k: 'restored', ent: { ...testEntitlement('yearly', Date.now()), trial: false, until: Date.now() + 200 * 86400000 } }) },
        { text: 'Nothing', onPress: () => Alert.alert(nf.title, nf.text) },
        { text: 'Cancel', style: 'cancel' },
      ]);
      return;
    }
    if (!paymentsReady()) return toast('Payments aren’t connected yet.');
    setBusy(true);
    const r = await restore();
    if (r.ok) await auth.refreshAccess();
    if (!alive.current) return;
    setBusy(false);
    if (r.ok) setScreen({ k: 'restored', ent: r.ent });
    else if (r.reason === 'not-found') Alert.alert(nf.title, nf.text);
    else toast(`Couldn’t reach the ${store}. Check your connection and try again.`);
  };

  const openWeb = (path: string) => {
    const url = webUrl(path);
    if (url) Linking.openURL(url).catch(() => {});
  };

  const onDemo = demo
    ? null
    : () => {
        // like Settings > Help > Demo: it opens on Home
        const go = () => {
          startDemo(demoData(state, Date.now()));
          toast(DEMO_ON);
        };
        if (router.canGoBack()) {
          router.dismissTo('/');
          setTimeout(go, 300);
        } else {
          go();
          router.replace('/');
        }
      };

  /** "Show me around" / "Skip the tour": the reminder as it was left, then the app. */
  const finish = async (showTour: boolean, ent: StoreEntitlement) => {
    update((s) => ({ ...s, trialRem: remind, ...(showTour ? {} : { tutSeen: 1 }) }));
    if (remind && ent.trial && !testMode) {
      if (await askPermission()) syncTrialReminder(ent, true);
      else toast('Allow notifications for Lock In in your phone’s Settings to get the reminder.');
    }
    // a new user gets the tour by itself on Home; someone who saw it already gets it started
    leave(showTour && state.tutSeen ? () => tour.start() : undefined);
  };

  let body: React.ReactNode;
  if (screen.k === 'plans')
    body = (
      <PlansView
        plans={plans}
        picked={picked}
        onPick={setPicked}
        onBuy={onBuy}
        busy={busy}
        onDemo={onDemo}
        onRestore={onRestore}
        onTerms={() => openWeb('terms/')}
        onPrivacy={() => openWeb('privacy/')}
        onRetry={load}
        onClose={auth.locked ? null : () => leave()}
      />
    );
  else if (screen.k === 'processing') {
    const ent = screen.ent;
    body = (
      <ProcessingView
        step={screen.step}
        shut={screen.shut}
        store={store}
        onShut={() => ent && setScreen({ k: 'success', ent })}
      />
    );
  } else if (screen.k === 'success') {
    const v = successView(screen.ent, kindOfEnt(screen.ent), priceOf(kindOfEnt(screen.ent)));
    const ent = screen.ent;
    body = (
      <SuccessView
        sub={v.sub}
        rows={v.rows}
        reminder={v.reminder}
        remind={remind}
        onRemind={setRemind}
        cancelNote={v.cancelNote}
        onTour={() => finish(true, ent)}
        onSkip={() => finish(false, ent)}
      />
    );
  } else if (screen.k === 'failed')
    body = (
      <FailedView
        reason={screen.reason}
        store={store}
        onRetry={() => setScreen({ k: 'plans' })}
        onDemo={onDemo}
        onRestore={onRestore}
        onSupport={() => Linking.openURL(`mailto:${SUPPORT}`).catch(() => toast(SUPPORT))}
      />
    );
  else
    body = (
      <RestoredView
        rows={restoredRows(screen.ent, kindOfEnt(screen.ent))}
        onContinue={() => leave()}
        onImport={() => {
          // More with Backup open (the paste-and-Import field)
          update((s) => ({ ...s, fold: { ...(s.fold || {}), bk: true } }));
          router.dismissTo('/more');
        }}
      />
    );

  return (
    <View style={{ flex: 1, backgroundColor: PW.bg }}>
      <StatusBar style="light" />
      {body}
      <Modal visible={chooser} transparent animationType="fade" onRequestClose={() => setChooser(false)}>
        <Pressable style={st.dim} onPress={() => setChooser(false)}>
          <View style={st.sheet}>
            <Text style={st.sheetH}>Test store (no RevenueCat keys yet)</Text>
            <Text style={st.sheetP}>What should the {store} answer? Nothing is bought and nothing gets unlocked.</Text>
            {(
              [
                ['ok', 'Purchase goes through'],
                ['cancelled', 'I close the window'],
                ['declined', 'Card declined'],
                ['pending', 'Waiting for approval'],
                ['network', 'No connection'],
              ] as const
            ).map(([k, t]) => (
              <Pressable key={k} accessibilityRole="button" onPress={() => testAnswer(k)} style={({ pressed }) => [st.opt, pressed && { opacity: 0.7 }]}>
                <Text style={st.optT}>{t}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const st = StyleSheet.create({
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: PW.card, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36, gap: 8, borderWidth: 1, borderColor: PW.line },
  sheetH: { fontFamily: inter[700], fontSize: 16, color: PW.ink },
  sheetP: { fontFamily: inter[400], fontSize: 13, lineHeight: 18, color: PW.sub, marginBottom: 6 },
  opt: { height: 48, borderRadius: 14, borderWidth: 1, borderColor: PW.line, justifyContent: 'center', paddingHorizontal: 16 },
  optT: { fontFamily: inter[600], fontSize: 15, color: PW.ink },
});
