// "Backup" (prototype section[data-fold=bk]): "Make backup" puts all the data in the box as text, selected
// for copying; "Import" reads such a text back (e.g. on another phone).

import { useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { useAppToast } from '@/components/AppToast';
import { DEMO_FADE, useDemoGuard } from '@/components/demoGuard';
import { Fold, Ghost, Small } from '@/components/home/Section';
import { BACKUP_READY, backupText, importBackup } from '@/logic/settings';
import { useStore } from '@/store/StoreProvider';
import { inter, useTheme } from '@/theme';

export function BackupFold() {
  const { state, update } = useStore();
  const { c } = useTheme();
  const toast = useAppToast();
  const [text, setText] = useState('');
  const [sel, setSel] = useState<{ start: number; end: number } | undefined>(undefined);
  const box = useRef<ComponentRef<typeof TextInput>>(null);
  const { demo, no } = useDemoGuard();

  const make = () => {
    const t = backupText(state);
    setText(t);
    setSel({ start: 0, end: t.length });
    box.current?.focus();
    toast(BACKUP_READY);
  };
  const load = () => {
    const r = importBackup(text);
    if (!r.ok) return toast(r.error);
    update(() => r.state);
    toast(r.toast);
  };

  return (
    <Fold id="bk" title="Backup" tourId="bk">
      <Small style={{ marginTop: 0.8, marginBottom: 12.8 }}>
        Make a backup, copy the text and save it (e.g. in notes). On another phone paste it and tap Import.
      </Small>
      <TextInput
        ref={box}
        multiline
        value={text}
        onChangeText={(v) => {
          setText(v);
          setSel(undefined);
        }}
        selection={sel}
        onSelectionChange={() => setSel(undefined)}
        accessibilityLabel="Backup"
        autoCorrect={false}
        autoCapitalize="none"
        spellCheck={false}
        textAlignVertical="top"
        editable={!demo}
        onPressIn={demo ? no : undefined}
        style={[st.box, { color: c.ink, backgroundColor: c.inputBg, borderColor: c.line }, demo && { opacity: DEMO_FADE }]}
      />
      <View style={st.row}>
        <Ghost title="Make backup" onPress={make} style={st.half} />
        <Ghost title="Import" onPress={load} style={st.half} />
      </View>
      <Small style={{ marginTop: 8 }}>This backup has all your spending in it. Don’t send it to anyone.</Small>
    </Fold>
  );
}

const st = StyleSheet.create({
  box: { minHeight: 90, maxHeight: 180, padding: 10, borderWidth: 1, borderRadius: 12, fontFamily: inter[400], fontSize: 12, lineHeight: 17.4 },
  row: { flexDirection: 'row', gap: 8 },
  // ghost buttons have margin-top 8, plus the gap an inline textarea leaves under itself (6.18)
  half: { flex: 1, flexBasis: 0, minWidth: 0, marginTop: 14.18 },
});
