// A <select> look-alike: the closed field looks like the prototype's select; tapping it opens a
// list to pick from (the prototype used the phone's own picker).

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, type TextStyle, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { DEMO_FADE, useDemoGuard } from '@/components/demoGuard';
import { brico } from '@/theme';

export interface Option {
  value: string;
  label: string;
}

/** Colours of the field and the list (default: the light intro). */
export interface SelectLook {
  bg: string;
  border: string;
  ink: string;
  mute: string;
  sheet: string;
  font: string;
}
const LIGHT: SelectLook = { bg: '#f3f7f4', border: '#dbe7df', ink: '#0d1f15', mute: '#5d7466', sheet: '#fff', font: brico[400] };

export function Select({
  value,
  options,
  onChange,
  style,
  textStyle,
  label,
  look = LIGHT,
}: {
  value: string;
  options: Option[];
  onChange: (v: string) => void;
  style?: ViewStyle;
  textStyle?: TextStyle; // e.g. { flex: 0 } for a field only as wide as its text
  label: string;
  look?: SelectLook;
}) {
  const [open, setOpen] = useState(false);
  const { demo, no } = useDemoGuard(); // off in the demo, like the other inputs
  const insets = useSafeAreaInsets();
  const cur = options.find((o) => o.value === value) || options[0];
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={demo ? no : () => setOpen(true)}
        style={[st.field, { backgroundColor: look.bg, borderColor: look.border }, style, demo && { opacity: DEMO_FADE }]}
      >
        <Text style={[st.text, { color: look.ink, fontFamily: look.font }, textStyle]} numberOfLines={1}>
          {cur.label}
        </Text>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M2.5 4.5 6 8l3.5-3.5" stroke={look.ink} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.scrim} onPress={() => setOpen(false)} />
        <View style={[st.sheet, { backgroundColor: look.sheet, paddingBottom: 12 + insets.bottom }]}>
          <Text style={[st.title, { color: look.mute }]}>{label}</Text>
          <FlatList
            data={options}
            keyExtractor={(o) => o.value || '-'}
            initialScrollIndex={Math.max(0, options.indexOf(cur))}
            getItemLayout={(_, i) => ({ length: 48, offset: 48 * i, index: i })}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
                style={[st.opt, item.value === value && { backgroundColor: look.bg }]}
              >
                <Text style={[st.text, { color: look.ink, fontFamily: look.font }, item.value === value && { fontWeight: '700' }]}>{item.label}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

const st = StyleSheet.create({
  field: {
    height: 45,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f3f7f4',
    borderWidth: 1,
    borderColor: '#dbe7df',
    borderRadius: 12,
  },
  text: { flex: 1, fontFamily: brico[400], fontSize: 16, color: '#0d1f15' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { maxHeight: '60%', backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingTop: 14, paddingHorizontal: 12 },
  title: { fontFamily: brico[700], fontSize: 16, color: '#5d7466', textAlign: 'center', marginBottom: 8 },
  opt: { height: 48, justifyContent: 'center', paddingHorizontal: 12, borderRadius: 12 },
  optOn: { backgroundColor: '#f3f7f4' },
});
