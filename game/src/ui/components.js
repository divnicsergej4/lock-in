// Zajednički delovi ekrana: dugmad, ikonice, paneli, trake, animirani brojevi.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export const FONT = 'LilitaOne_400Regular';
export const COLORS = {
  gold: ['#ffd75a', '#ffb01f'],
  goldShade: '#b86e05',
  green: ['#8ef05a', '#3fae2a'],
  greenShade: '#2a7a1a',
  red: ['#ff6a6a', '#e03434'],
  redShade: '#9a1c24',
  blue: ['#5aa2ff', '#2f6ff0'],
  blueShade: '#1c46a8',
  gray: ['#8c96a6', '#646e7e'],
  grayShade: '#3e4652',
  panel: 'rgba(12,18,28,0.86)',
  panelBorder: 'rgba(255,255,255,0.14)',
  toxic: '#9dff4a',
};

export const outline = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 };
export const outlineSm = { textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 };

// Debelo "3D" dugme sa prelivom koje se spusti kad ga pritisneš
export function GameButton({ label, onPress, colors = COLORS.gold, shade = COLORS.goldShade, big = false, small = false, disabled = false, font, children, style, testID }) {
  const c = disabled ? COLORS.gray : colors;
  const s = disabled ? COLORS.grayShade : shade;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btnOuter, { backgroundColor: s, paddingBottom: pressed && !disabled ? 2 : 6, marginTop: pressed && !disabled ? 4 : 0 }, style]}
    >
      <LinearGradient colors={c} style={[styles.btnInner, big && styles.btnBig, small && styles.btnSmall]}>
        <View style={styles.btnShine} />
        {children || <Text style={[styles.btnText, big && styles.btnTextBig, small && styles.btnTextSmall, font]}>{label}</Text>}
      </LinearGradient>
    </Pressable>
  );
}

// Okruglo dugme sa ikonicom
export function IconButton({ onPress, children, size = 48, testID, label }) {
  return (
    <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [{ transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <LinearGradient colors={['#3a4556', '#232b37']} style={[styles.iconBtn, { width: size, height: size, borderRadius: size / 2 }]}>{children}</LinearGradient>
    </Pressable>
  );
}

export function PauseIcon() {
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

export function GearIcon({ size = 22 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 45, 90, 135].map((a) => (
        <View key={a} style={{ position: 'absolute', width: size * 0.3, height: size, borderRadius: 2, backgroundColor: '#dfe6f0', transform: [{ rotate: `${a}deg` }] }} />
      ))}
      <View style={{ width: size * 0.72, height: size * 0.72, borderRadius: size, backgroundColor: '#dfe6f0' }} />
      <View style={{ position: 'absolute', width: size * 0.3, height: size * 0.3, borderRadius: size, backgroundColor: '#2a3340' }} />
    </View>
  );
}

export function CloseIcon() {
  return (
    <View style={{ width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[styles.closeBar, { transform: [{ rotate: '45deg' }] }]} />
      <View style={[styles.closeBar, { transform: [{ rotate: '-45deg' }] }]} />
    </View>
  );
}

export function BackIcon() {
  return (
    <View style={{ width: 20, height: 20, justifyContent: 'center' }}>
      <View style={[styles.closeBar, { width: 13, position: 'absolute', left: 2, top: 5, transform: [{ rotate: '-45deg' }] }]} />
      <View style={[styles.closeBar, { width: 13, position: 'absolute', left: 2, top: 13, transform: [{ rotate: '45deg' }] }]} />
    </View>
  );
}

export function Coin({ size = 24 }) {
  return (
    <LinearGradient colors={['#ffe27a', '#ffb81c']} style={{ width: size, height: size, borderRadius: size / 2, borderWidth: Math.max(2, size / 12), borderColor: '#c9800c', alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size * 0.42, height: size * 0.42, borderRadius: size, borderWidth: Math.max(1.5, size / 14), borderColor: '#e8a019' }} />
    </LinearGradient>
  );
}

export function Heart({ size = 22 }) {
  return <Text style={{ fontSize: size, color: '#ff3d5a', lineHeight: size * 1.15, ...outlineSm }}>♥</Text>;
}

export function BulletIcon({ size = 22, color = '#ffc934' }) {
  return (
    <View style={{ width: size * 0.42, height: size, alignItems: 'center' }}>
      <View style={{ width: size * 0.42, height: size * 0.34, borderTopLeftRadius: size, borderTopRightRadius: size, backgroundColor: '#d9dde4' }} />
      <View style={{ width: size * 0.42, height: size * 0.66, backgroundColor: color, borderBottomLeftRadius: 2, borderBottomRightRadius: 2 }} />
    </View>
  );
}

export function GiftIcon({ size = 30 }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'flex-end' }}>
      <View style={{ width: size * 0.9, height: size * 0.62, backgroundColor: '#e8403a', borderRadius: 3 }} />
      <View style={{ position: 'absolute', bottom: size * 0.55, width: size, height: size * 0.22, backgroundColor: '#ff5a50', borderRadius: 3 }} />
      <View style={{ position: 'absolute', bottom: 0, width: size * 0.18, height: size * 0.77, backgroundColor: '#ffd34a' }} />
    </View>
  );
}

export function GunIcon({ size = 30 }) {
  return (
    <View style={{ width: size * 1.3, height: size, justifyContent: 'center' }}>
      <View style={{ width: size * 1.25, height: size * 0.26, backgroundColor: '#dfe6f0', borderRadius: 3 }} />
      <View style={{ position: 'absolute', left: size * 0.75, top: size * 0.56, width: size * 0.22, height: size * 0.38, backgroundColor: '#dfe6f0', borderRadius: 2, transform: [{ rotate: '12deg' }] }} />
      <View style={{ position: 'absolute', left: size * 0.12, top: size * 0.12, width: size * 0.3, height: size * 0.15, backgroundColor: '#dfe6f0', borderRadius: 2 }} />
    </View>
  );
}

// Tamni panel sa ivicom
export function Panel({ children, style }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

// Traka (zdravlje, napredak, šef)
export function Bar({ value, colors = COLORS.green, height = 14, style, children }) {
  const k = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.barTrack, { height, borderRadius: height / 2 }, style]}>
      <LinearGradient colors={colors} style={[styles.barFill, { width: `${k * 100}%`, borderRadius: height / 2 }]} />
      {children}
    </View>
  );
}

export function usePulse(duration = 800) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(v, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, duration]);
  return v;
}

export function useAppear(delay = 0) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, friction: 7, tension: 70, delay, useNativeDriver: false }).start();
  }, [v, delay]);
  return v;
}

// Broj koji kratko "skoči" kad se promeni
export function PopText({ value, style }) {
  const v = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      v.setValue(1.3);
      Animated.spring(v, { toValue: 1, friction: 4, tension: 170, useNativeDriver: false }).start();
    }
  }, [value, v]);
  return <Animated.Text style={[style, { transform: [{ scale: v }] }]}>{value}</Animated.Text>;
}

export function Toggle({ value, onChange, font, label, testID }) {
  return (
    <Pressable testID={testID} accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} onPress={() => onChange(!value)} style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, font]}>{label}</Text>
      <View style={[styles.toggle, { backgroundColor: value ? '#3fae2a' : '#4a5260' }]}>
        <View style={[styles.toggleKnob, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btnOuter: { borderRadius: 20 },
  btnInner: { borderRadius: 20, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexDirection: 'row', gap: 8 },
  btnBig: { paddingVertical: 18 },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 14 },
  btnShine: { position: 'absolute', top: 3, left: 10, right: 10, height: '42%', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)' },
  btnText: { color: '#fff', fontSize: 21, letterSpacing: 0.5, ...outline },
  btnTextBig: { fontSize: 32, letterSpacing: 2 },
  btnTextSmall: { fontSize: 16 },
  iconBtn: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  pauseBar: { width: 6, height: 20, borderRadius: 2, backgroundColor: '#fff' },
  closeBar: { position: 'absolute', width: 20, height: 4, borderRadius: 2, backgroundColor: '#fff' },
  panel: { backgroundColor: COLORS.panel, borderRadius: 22, borderWidth: 2, borderColor: COLORS.panelBorder },
  barTrack: { backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)', overflow: 'hidden', justifyContent: 'center' },
  barFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 },
  toggleLabel: { color: '#fff', fontSize: 19, ...outlineSm },
  toggle: { width: 58, height: 32, borderRadius: 16, padding: 3, justifyContent: 'center' },
  toggleKnob: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff' },
});
