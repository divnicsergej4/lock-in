// The screens after the button (docs/dizajn/placanje 08–11): "Locking you in…" while the store and the server
// are asked, "You're locked in.", "That didn't go through." with the reason, and "Welcome back." after a restore.

import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { failCard, shortDate, type FailReason, type Store } from '@/logic/paywall';
import { inter } from '@/theme';

import { LockCheck, LockClosed, LockOpen, LockProcessing } from './Padlock';
import { BigButton, CardButton, H1, Links, NoteCard, RowsCard, Sub, TextButton, Toggle } from './parts';
import { PW } from './theme';

/** A screen of 09–11: content at the top, buttons at the bottom; scrolls on small phones. */
function Page({ top, children, bottom }: { top: number; children: React.ReactNode; bottom: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: PW.bg }}
      contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + top, paddingHorizontal: 20, paddingBottom: insets.bottom + 28, gap: 22 }}
      showsVerticalScrollIndicator={false}
    >
      {children}
      <View style={{ marginTop: 'auto', gap: 10 }}>{bottom}</View>
    </ScrollView>
  );
}

const STEPS = ['Payment confirmed', 'Unlocking everything', 'Saving your plan'];

/** 08. `step`: how many of the three steps are done; `shut`: all done, close the padlock. */
export function ProcessingView({ step, shut, onShut, store }: { step: number; shut: boolean; onShut: () => void; store: Store }) {
  return (
    <View style={s.center}>
      <LockProcessing shut={shut} onShut={onShut} />
      <View style={{ gap: 8 }}>
        <H1 size={34} lh={1.05}>
          Locking you in…
        </H1>
        <Sub size={15}>Checking with the {store}. Keep the app open for a few seconds.</Sub>
      </View>
      <View style={s.steps}>
        {STEPS.map((t, i) => {
          const done = i < step;
          const now = i === step;
          return (
            <View key={t} style={s.step} accessibilityLabel={`${t}${done ? ', done' : now ? ', in progress' : ''}`}>
              {done ? (
                <Animated.View entering={FadeIn.duration(180)} style={[s.dot, { backgroundColor: PW.green }]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24">
                    <Path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={PW.onGreen} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </Animated.View>
              ) : now ? (
                <View style={[s.dot, { borderWidth: 2, borderColor: PW.green }]}>
                  <View style={s.inner} />
                </View>
              ) : (
                <View style={[s.dot, { borderWidth: 2, borderColor: PW.stepOff }]} />
              )}
              <Text style={[s.stepT, !done && !now && { color: PW.mute }]}>{t}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** 09. `reminder`: the day of the reminder (trial only), with its switch. */
export function SuccessView({
  sub,
  rows,
  reminder,
  remind,
  onRemind,
  cancelNote,
  onTour,
  onSkip,
}: {
  sub: string;
  rows: { label: string; value: string }[];
  reminder: number | null;
  remind: boolean;
  onRemind: (v: boolean) => void;
  cancelNote: boolean;
  onTour: () => void;
  onSkip: () => void;
}) {
  return (
    <Page
      top={56}
      bottom={
        <>
          <BigButton title="Show me around" onPress={onTour} />
          <TextButton title="Skip the tour" onPress={onSkip} />
          {cancelNote && <Text style={s.small}>Cancel anytime in Settings → Subscription.</Text>}
        </>
      }
    >
      <View style={[s.head, { gap: 18 }]}>
        <LockClosed />
        <View style={{ gap: 8 }}>
          <H1 size={40} lh={1} ls={-0.015}>
            You&apos;re locked in.
          </H1>
          <Sub>{sub}</Sub>
        </View>
      </View>
      <RowsCard rows={rows}>
        {reminder != null && (
          <View style={s.remind}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={s.remB}>Remind me on {shortDate(reminder)}</Text>
              <Text style={s.remS}>So you&apos;re never charged by surprise</Text>
            </View>
            <Toggle on={remind} onChange={onRemind} label={`Remind me on ${shortDate(reminder)}`} />
          </View>
        )}
      </RowsCard>
    </Page>
  );
}

/** 10. */
export function FailedView({
  reason,
  store,
  onRetry,
  onDemo,
  onRestore,
  onSupport,
}: {
  reason: FailReason;
  store: Store;
  onRetry: () => void;
  onDemo: (() => void) | null;
  onRestore: () => void;
  onSupport: () => void;
}) {
  const card = failCard(reason, store);
  return (
    <Page
      top={72}
      bottom={
        <>
          <BigButton title="Try again" onPress={onRetry} />
          {onDemo && <CardButton title="Look around the demo" onPress={onDemo} />}
          <Links
            style={{ marginTop: 4 }}
            items={[
              { title: 'Restore purchase', onPress: onRestore },
              { title: 'Contact support', onPress: onSupport },
            ]}
          />
        </>
      }
    >
      <View style={[s.head, { gap: 18 }]}>
        <LockOpen />
        <View style={{ gap: 8 }}>
          <H1 size={34} lh={1.05}>
            That didn&apos;t go through.
          </H1>
          <Sub>Nothing was charged.</Sub>
        </View>
      </View>
      <NoteCard icon={card.icon} tone="lime" title={card.title} text={card.text} />
    </Page>
  );
}

/** 11. */
export function RestoredView({ rows, onContinue, onImport }: { rows: { label: string; value: string }[]; onContinue: () => void; onImport: () => void }) {
  return (
    <Page
      top={72}
      bottom={
        <>
          <BigButton title="Continue" onPress={onContinue} />
          <TextButton title="Import a backup" onPress={onImport} />
        </>
      }
    >
      <View style={[s.head, { gap: 18 }]}>
        <LockCheck />
        <View style={{ gap: 8 }}>
          <H1 size={38} lh={1}>
            Welcome back.
          </H1>
          <Sub>We found your plan. Everything is unlocked again.</Sub>
        </View>
      </View>
      <RowsCard rows={rows} />
      <NoteCard
        icon="phone"
        tone="green"
        title="New phone?"
        text="Your spending lives on the old phone, not on our servers. Bring it over with More → Backup → Import."
      />
    </Page>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, backgroundColor: PW.bg, paddingHorizontal: 28, alignItems: 'center', justifyContent: 'center', gap: 26 },
  head: { alignItems: 'center' },
  steps: { width: '100%', maxWidth: 280, gap: 12 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  inner: { width: 8, height: 8, borderRadius: 4, backgroundColor: PW.green },
  stepT: { fontFamily: inter[400], fontSize: 15, lineHeight: 20, color: PW.ink },
  small: { fontFamily: inter[400], fontSize: 12, lineHeight: 16, color: PW.mute, textAlign: 'center' },
  remind: { minHeight: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  remB: { fontFamily: inter[600], fontSize: 15, lineHeight: 20, color: PW.ink },
  remS: { fontFamily: inter[400], fontSize: 12, lineHeight: 16, color: PW.mute },
});
