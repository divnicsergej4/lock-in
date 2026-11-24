// The daily reminder on Home (prototype #remb, amber): once the reminder time has passed and nothing was
// logged today. "Log now" puts the cursor in New entry; after 20:00 "I didn't spend today" also counts
// the day for the streak.

import { useEffect, useState } from 'react';
import { AppState as RNAppState, StyleSheet, Text, View } from 'react-native';

import { NO_SPEND_FROM_HOUR, checkIn } from '@/logic/streak';
import { dayKey } from '@/logic/dates';
import { REMINDER_TEXT, REMINDER_TITLE, reminderDue } from '@/logic/settings';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

import { entryFocus } from './entryFocus';
import { Button, Ghost, Section, Small } from './Section';

export function ReminderCard() {
  const { state, update } = useStore();
  const { c } = useTheme();
  // the time passes while the app is open: look again every half minute and when it comes back
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    const sub = RNAppState.addEventListener('change', (st) => st === 'active' && setNow(Date.now()));
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, []);
  if (!reminderDue(state, now)) return null;
  const late = new Date(now).getHours() >= NO_SPEND_FROM_HOUR;
  return (
    <Section kind="amber">
      <Text style={[st.b, { color: c.ink }]}>⏰ {REMINDER_TITLE}</Text>
      <Small style={{ marginTop: 4, marginBottom: 10 }}>{REMINDER_TEXT}</Small>
      <View style={st.row}>
        <Button title="Log now" onPress={() => entryFocus.current?.()} style={st.half} />
        {late && (
          <Ghost
            title="I didn't spend today"
            onPress={() => {
              const t = Date.now();
              update((s) => ({ ...s, remDis: dayKey(t), chk: checkIn(s, t) }));
            }}
            style={[st.half, { marginTop: 8 }]}
          />
        )}
      </View>
    </Section>
  );
}

const st = StyleSheet.create({
  b: { fontFamily: inter[700], fontSize: 16, lineHeight: 23.2 },
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1, flexBasis: 0, minWidth: 0 },
});
