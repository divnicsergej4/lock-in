// "What should friends call you?" (agreed 28 October 2026): after the first sign-in and before the first invite
// or goal, if there is no name yet. Saved in profiles.display_name; the email is never used as a name.

import { useState } from 'react';
import { Text } from 'react-native';

import { BAD_NAME, nameOk, setName } from './api';
import { useAppToast } from '@/components/AppToast';
import { GoldButton, SheetField } from '@/components/goals/bits';
import { F, useLook } from '@/components/goals/look';
import { Sheet } from '@/components/goals/Sheet';
import { useAuth } from '@/auth/AuthProvider';
import { supabase } from '@/auth/supabase';

export function NamePrompt({ current, onClose, onSaved }: { current: string; onClose: () => void; onSaved: () => void }) {
  const g = useLook();
  const toast = useAppToast();
  const { session } = useAuth();
  const [name, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (busy || !supabase || !session) return;
    const n = name.trim();
    if (!nameOk(n)) return toast(BAD_NAME);
    setBusy(true);
    const r = await setName(supabase, session.user.id, n);
    setBusy(false);
    if (!r.ok) return toast(r.error);
    onSaved();
  };
  return (
    <Sheet title="What should friends call you?" onClose={onClose}>
      <SheetField label="Your name" value={name} onChangeText={setValue} autoFocus />
      <Text style={{ fontFamily: F.text, fontSize: 13.5, color: g.mute, marginTop: -4 }}>Friends see this name, never your email.</Text>
      <GoldButton title="Save" onPress={save} dim={busy} style={{ marginTop: 18 }} />
    </Sheet>
  );
}
