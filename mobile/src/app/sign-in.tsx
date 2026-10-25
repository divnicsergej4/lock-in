// Sign in (opened from Shared goal and Settings > Account). No passwords anywhere: Apple (iPhone), Google,
// or a 6-digit code by email. "Send code" waits 60 s between sends; 5 wrong codes and a new one is needed.

import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/auth/AuthProvider';
import { canEnterCode, cleanCode, CODE_LENGTH, codeSent, isEmail, needsNewCode, normalizeEmail, otpStart, resendIn, wrongCode, type OtpState } from '@/auth/otp';
import { sendCode, signInWithApple, signInWithGoogle, verifyCode, type SignInResult } from '@/auth/signIn';
import { supabase } from '@/auth/supabase';
import { useAppToast } from '@/components/AppToast';
import { Button, Field, Ghost, Small } from '@/components/home/Section';
import { TurnstileHost } from '@/components/TurnstileHost';
import { inter, useTheme } from '@/theme';

// Kept while the app runs, so closing and reopening this screen does not unlock "Send code" early.
let kept: OtpState = otpStart;

export default function SignIn() {
  const { c, name } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useAppToast();
  const { session } = useAuth();
  const [otp, setOtpState] = useState<OtpState>(kept);
  const setOtp = (s: OtpState) => setOtpState((kept = s));
  const [email, setEmail] = useState(kept.email);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'' | 'send' | 'verify' | 'google' | 'apple'>('');
  const [now, setNow] = useState(Date.now());
  const [apple, setApple] = useState(false);
  const codeRef = useRef<ComponentRef<typeof TextInput>>(null);

  const wait = resendIn(otp, now);
  useEffect(() => {
    if (!wait) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [wait]);

  useEffect(() => {
    if (Platform.OS === 'ios') AppleAuthentication.isAvailableAsync().then(setApple, () => setApple(false));
  }, []);

  // Signed in (any way): back to where the user came from.
  useEffect(() => {
    if (!session) return;
    kept = otpStart;
    toast('Signed in');
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [session, toast]);

  if (!supabase) {
    return (
      <View style={[st.page, { backgroundColor: c.bg, paddingTop: insets.top + 24 }]}>
        <Text style={[st.h1, { color: c.ink }]}>Sign in</Text>
        <Small>Accounts aren’t switched on in this version of the app yet.</Small>
        <Ghost title="Close" onPress={() => router.back()} style={{ marginTop: 20, alignSelf: 'flex-start' }} demoOk />
      </View>
    );
  }
  const client = supabase;

  const done = (r: SignInResult) => {
    if (!r.ok && !('cancelled' in r)) setError(r.error);
  };

  const send = async () => {
    const e = normalizeEmail(email);
    if (!isEmail(e)) return setError('Check the email address.');
    if (wait || busy) return;
    setError('');
    setBusy('send');
    const r = await sendCode(client, e);
    setBusy('');
    if (!r.ok) return done(r); // nothing was sent: no lock (the server has its own 60 s per email anyway)
    setOtp(codeSent(e, Date.now()));
    setNow(Date.now());
    setCode('');
    setTimeout(() => codeRef.current?.focus(), 50);
  };

  const verify = async (value = code) => {
    if (!canEnterCode(otp) || value.length !== CODE_LENGTH || busy) return;
    setError('');
    setBusy('verify');
    const r = await verifyCode(client, otp.email, value);
    setBusy('');
    if (r.ok) return;
    if ('wrongCode' in r && r.wrongCode) {
      const next = wrongCode(otp);
      setOtp(next);
      setCode('');
      return setError(needsNewCode(next) ? 'Too many wrong codes. Send a new code.' : r.error);
    }
    done(r);
  };

  const social = async (which: 'google' | 'apple') => {
    if (busy) return;
    setError('');
    setBusy(which);
    try {
      done(await (which === 'google' ? signInWithGoogle(client) : signInWithApple(client)));
    } finally {
      setBusy('');
    }
  };

  const codeOpen = canEnterCode(otp) && otp.email === normalizeEmail(email);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={[st.page, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
    >
      <View style={st.head}>
        <Text style={[st.h1, { color: c.ink }]}>Sign in</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={12}>
          <Text style={[st.close, { color: c.mute }]}>Not now</Text>
        </Pressable>
      </View>
      <Small>For shared goals with friends and your plan. No passwords: use Apple, Google or a code we email you.</Small>

      <View style={{ marginTop: 22, gap: 10 }}>
        {apple && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={name === 'dark' ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={st.social}
            onPress={() => social('apple')}
          />
        )}
        <Pressable
          accessibilityRole="button"
          onPress={() => social('google')}
          style={({ pressed }) => [st.social, st.google, { borderColor: c.line, backgroundColor: c.card }, pressed && { opacity: 0.8 }]}
        >
          {busy === 'google' ? <ActivityIndicator color={c.ink} /> : <Text style={[st.socialT, { color: c.ink }]}>Continue with Google</Text>}
        </Pressable>
      </View>

      <View style={st.or}>
        <View style={[st.line, { backgroundColor: c.line }]} />
        <Text style={[st.orT, { color: c.mute }]}>or with email</Text>
        <View style={[st.line, { backgroundColor: c.line }]} />
      </View>

      <Field
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError('');
        }}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        accessibilityLabel="Email"
        returnKeyType="send"
        onSubmitEditing={send}
      />
      <Button title={busy === 'send' ? 'Sending…' : wait ? `Send again in ${wait}s` : otp.sentAt ? 'Send a new code' : 'Send code'} onPress={send} demoOk style={wait ? { opacity: 0.5 } : undefined} />
      <TurnstileHost />

      {codeOpen && (
        <View style={{ marginTop: 18 }}>
          <Small>We sent a 6-digit code to {otp.email}. Check spam if it isn’t there in a minute.</Small>
          <Field
            ref={codeRef}
            value={code}
            onChangeText={(t) => {
              const v = cleanCode(t);
              setCode(v);
              setError('');
              if (v.length === CODE_LENGTH) verify(v);
            }}
            placeholder="123456"
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH + 1}
            accessibilityLabel="6-digit code"
            style={st.code}
          />
          <Button title={busy === 'verify' ? 'Checking…' : 'Sign in'} onPress={() => verify()} demoOk />
        </View>
      )}

      {!!error && <Text style={[st.err, { color: c.err }]}>{error}</Text>}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  page: { paddingHorizontal: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  h1: { fontFamily: inter[800], fontSize: 28, lineHeight: 34 },
  close: { fontFamily: inter[600], fontSize: 15, lineHeight: 22 },
  social: { width: '100%', height: 48 },
  google: { borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  socialT: { fontFamily: inter[600], fontSize: 16, lineHeight: 23.2 },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 20 },
  line: { flex: 1, height: 1 },
  orT: { fontFamily: inter[500], fontSize: 13, lineHeight: 18 },
  code: { marginTop: 10, fontSize: 22, letterSpacing: 6, textAlign: 'center' },
  err: { marginTop: 14, fontFamily: inter[600], fontSize: 14, lineHeight: 20 },
});
