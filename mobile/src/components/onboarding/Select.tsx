// A <select> look-alike: the closed field looks like the prototype's select; tapping it opens a
// list to pick from (the prototype used the phone's own picker).

import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { brico } from '@/theme';

export interface Option {
  value: string;
  label: string;
}

export function Select({ value, options, onChange, style, label }: { value: string; options: Option[]; onChange: (v: string) => void; style?: ViewStyle; label: string }) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const cur = options.find((o) => o.value === value) || options[0];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={() => setOpen(true)} style={[st.field, style]}>
        <Text style={st.text} numberOfLines={1}>
          {cur.label}
        </Text>
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M2.5 4.5 6 8l3.5-3.5" stroke="#0d1f15" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={st.scrim} onPress={() => setOpen(false)} />
        <View style={[st.sheet, { paddingBottom: 12 + insets.bottom }]}>
          <Text style={st.title}>{label}</Text>
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
                style={[st.opt, item.value === value && st.optOn]}
              >
                <Text style={[st.text, item.value === value && { fontFamily: brico[700] }]}>{item.label}</Text>
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
