// The reminder time (prototype <input type=time>): shows "8:00 PM"; tapping it opens the phone's own
// time picker (a wheel at the bottom on iOS, the clock dialog on Android). The web preview, which has
// no native picker, gets a list of times instead.

import DateTimePicker, { DateTimePickerAndroid, type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DEMO_FADE, useDemoGuard } from '@/components/demoGuard';
import { Select, type SelectLook } from '@/components/onboarding/Select';
import { inter } from '@/theme';

const pad = (n: number) => (n < 10 ? '0' : '') + n;
/** "20:00" → "8:00 PM" */
export function timeLabel(hm: string): string {
  const [h, m] = hm.split(':').map(Number);
  return ((h + 11) % 12) + 1 + ':' + pad(m) + ' ' + (h < 12 ? 'AM' : 'PM');
}
const toDate = (hm: string) => {
  const [h, m] = hm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
};
const fromDate = (d: Date) => pad(d.getHours()) + ':' + pad(d.getMinutes());

export function TimeField({ value, onChange, look, style }: { value: string; onChange: (hm: string) => void; look: SelectLook; style?: ViewStyle }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const insets = useSafeAreaInsets();
  const { demo, no } = useDemoGuard();

  if (Platform.OS === 'web') {
    const times: { value: string; label: string }[] = [];
    for (let k = 0; k < 24 * 4; k++) {
      const hm = pad(Math.floor(k / 4)) + ':' + pad((k % 4) * 15);
      times.push({ value: hm, label: timeLabel(hm) });
    }
    if (!times.some((t) => t.value === value)) times.unshift({ value, label: timeLabel(value) });
    return <Select label="Reminder time" value={value} options={times} onChange={onChange} look={look} style={style} textStyle={{ flex: 0 }} />;
  }

  const show = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: toDate(value),
        mode: 'time',
        onChange: (e: DateTimePickerEvent, d?: Date) => {
          if (e.type === 'set' && d) onChange(fromDate(d));
        },
      });
      return;
    }
    setDraft(value);
    setOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reminder time"
        onPress={demo ? no : show}
        style={[st.field, { backgroundColor: look.bg, borderColor: look.border }, style, demo && { opacity: DEMO_FADE }]}
      >
        <Text style={[st.text, { color: look.ink }]}>{timeLabel(value)}</Text>
      </Pressable>
      {open && (
        <Modal transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <Pressable style={st.scrim} onPress={() => setOpen(false)} />
          <View style={[st.sheet, { backgroundColor: look.sheet, paddingBottom: 12 + insets.bottom }]}>
            <View style={st.bar}>
              <Text style={[st.title, { color: look.mute }]}>Reminder time</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(draft);
                  setOpen(false);
                }}
                hitSlop={10}
              >
                <Text style={[st.done, { color: look.ink }]}>Done</Text>
              </Pressable>
            </View>
            <DateTimePicker value={toDate(draft)} mode="time" display="spinner" textColor={look.ink} onChange={(_e, d) => d && setDraft(fromDate(d))} />
          </View>
        </Modal>
      )}
    </>
  );
}

const st = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 10, borderWidth: 1, borderRadius: 12 },
  text: { fontFamily: inter[400], fontSize: 16, lineHeight: 23.2 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 12, paddingHorizontal: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, marginBottom: 4 },
  title: { fontFamily: inter[700], fontSize: 16 },
  done: { fontFamily: inter[700], fontSize: 16 },
});
