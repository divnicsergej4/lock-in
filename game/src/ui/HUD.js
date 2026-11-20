// Prikaz tokom igre: pauza, nivo/talas i napredak, zlatnici, pojačanja, šef, zdravlje, municija,
// poruke, crveni rub ekrana kad junak primi udarac i uputstvo za prvi put.
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { IconButton, PauseIcon, Coin, Heart, BulletIcon, Bar, PopText, GameButton, usePulse, outline, outlineSm, COLORS } from './components.js';

export default function HUD({ font, ui, onPause, tutorial, onTutorialDone }) {
  const hpK = ui.hp / Math.max(1, ui.maxHp);
  const lowAmmo = !ui.empty && ui.ammo < 12 * ui.ammoPerShot;
  const buffs = [];
  if (ui.multishot > 1) buffs.push({ t: `×${ui.multishot} METAKA`, c: COLORS.blue });
  if (ui.dmgMult > 1) buffs.push({ t: `×${ui.dmgMult} ŠTETA`, c: ['#ff8a4c', '#e8582a'] });
  if (ui.fire) buffs.push({ t: 'VATRENI METCI', c: ['#ff6a3a', '#d8321a'] });
  if (ui.rateBonus > 0) buffs.push({ t: `+${ui.rateBonus}% PALJBA`, c: ['#c07bff', '#8a3ae8'] });
  const playing = ui.phase === 'fight' || ui.phase === 'boss' || ui.phase === 'intro';
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <HurtFlash id={ui.hurtId} />
      {hpK < 0.3 && playing ? <LowHealth /> : null}

      <View style={styles.top} pointerEvents="box-none">
        <IconButton testID="btn-pause" label="Pauza" onPress={onPause} size={46}>
          <PauseIcon />
        </IconButton>
        <View style={styles.progressBox} pointerEvents="none">
          <Text style={[styles.levelText, font]}>
            NIVO {ui.level} · {ui.phase === 'boss' ? 'ŠEF!' : `TALAS ${Math.max(1, ui.wave)}/${ui.waves}`}
          </Text>
          <Bar value={ui.progress} colors={COLORS.gold} height={12} style={styles.progress}>
            {ui.bossLevel ? <View style={styles.skull} /> : null}
          </Bar>
        </View>
        <View style={styles.coins} pointerEvents="none">
          <Coin size={22} />
          <PopText value={ui.coins} style={[styles.coinText, font]} />
        </View>
      </View>

      {buffs.length ? (
        <View style={styles.buffs} pointerEvents="none">
          {buffs.map((b) => (
            <LinearGradient key={b.t} colors={b.c} style={styles.buff}>
              <Text style={[styles.buffText, font]}>{b.t}</Text>
            </LinearGradient>
          ))}
        </View>
      ) : null}

      {ui.bossHp != null ? (
        <View style={styles.bossBox} pointerEvents="none">
          <Text style={[styles.bossName, font]}>{ui.bossName}</Text>
          <Bar value={ui.bossHp / Math.max(1, ui.bossMax)} colors={['#ff5a5a', '#a81a26']} height={20} style={styles.bossBar}>
            <Text style={[styles.bossHp, font]}>{ui.bossHp}</Text>
          </Bar>
        </View>
      ) : null}

      {ui.toast && playing ? <Toast key={ui.toast.id} font={font} toast={ui.toast} /> : null}
      {ui.empty && playing ? <EmptyAmmo font={font} /> : null}

      <View style={styles.bottom} pointerEvents="none">
        <View style={styles.hpBox}>
          <Heart size={24} />
          <View style={styles.hpCol}>
            <Bar value={hpK} colors={hpK > 0.5 ? COLORS.green : hpK > 0.25 ? COLORS.gold : COLORS.red} height={16} style={styles.hpBar} />
            <Text style={[styles.hpText, font]}>
              {ui.hp}/{ui.maxHp}
            </Text>
          </View>
        </View>
        <View style={[styles.ammoBox, (ui.empty || lowAmmo) && styles.ammoLow]}>
          <BulletIcon size={26} color={ui.empty ? '#ff4a4a' : '#ffc934'} />
          <View>
            <PopText value={ui.ammo} style={[styles.ammoText, font, ui.empty && { color: '#ff6a6a' }]} />
            <Text style={[styles.weaponText, font]}>{ui.weaponName}</Text>
          </View>
        </View>
      </View>

      {tutorial && ui.phase !== 'intro' && playing ? <Tutorial font={font} onDone={onTutorialDone} /> : null}
    </View>
  );
}

function HurtFlash({ id }) {
  const v = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    v.setValue(1);
    Animated.timing(v, { toValue: 0, duration: 450, useNativeDriver: false }).start();
  }, [id, v]);
  return <Vignette opacity={v} />;
}

function LowHealth() {
  const p = usePulse(600);
  const o = p.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.55] });
  return <Vignette opacity={o} />;
}

function Vignette({ opacity }) {
  const red = 'rgba(220,20,30,0.75)';
  const none = 'rgba(220,20,30,0)';
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]}>
      <LinearGradient colors={[red, none]} style={[styles.vig, { top: 0, height: 140 }]} />
      <LinearGradient colors={[none, red]} style={[styles.vig, { bottom: 0, height: 160 }]} />
      <LinearGradient colors={[red, none]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.vigSide, { left: 0 }]} />
      <LinearGradient colors={[none, red]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.vigSide, { right: 0 }]} />
    </Animated.View>
  );
}

function Toast({ font, toast }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: false }),
      Animated.delay(500),
      Animated.timing(v, { toValue: 2, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.1] });
  const opacity = v.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  const ty = v.interpolate({ inputRange: [0, 1, 2], outputRange: [20, 0, -26] });
  const look = {
    good: { color: '#ffffff', textShadowColor: 'rgba(20,90,30,0.95)' },
    epic: { color: '#ffe066', textShadowColor: 'rgba(150,50,10,0.95)' },
    bad: { color: '#ffd0d6', textShadowColor: 'rgba(170,20,40,0.95)' },
    wave: { color: '#ffffff', textShadowColor: 'rgba(30,40,60,0.95)' },
    danger: { color: '#ff5a5a', textShadowColor: 'rgba(40,0,0,0.95)' },
  }[toast.kind || 'good'];
  const size = toast.text.length > 14 ? 34 : toast.text.length > 8 ? 44 : 56;
  return (
    <View style={styles.toastWrap} pointerEvents="none">
      <Animated.Text style={[styles.toast, font, look, { fontSize: size, opacity, transform: [{ scale }, { translateY: ty }] }]}>{toast.text}</Animated.Text>
    </View>
  );
}

function EmptyAmmo({ font }) {
  const p = usePulse(350);
  const o = p.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });
  return (
    <Animated.View style={[styles.empty, { opacity: o }]} pointerEvents="none">
      <Text style={[styles.emptyTitle, font]}>NEMA MUNICIJE!</Text>
      <Text style={[styles.emptySub, font]}>IDI DESNO NA POLJE SA MUNICIJOM ▶</Text>
    </Animated.View>
  );
}

function Tutorial({ font, onDone }) {
  const p = usePulse(650);
  const tx = p.interpolate({ inputRange: [0, 1], outputRange: [-70, 70] });
  return (
    <View style={styles.tutWrap} pointerEvents="box-none">
      <View style={styles.tutCard}>
        <Text style={[styles.tutTitle, font]}>KAKO SE IGRA</Text>
        <View style={styles.tutTrack}>
          <Animated.View style={[styles.finger, { transform: [{ translateX: tx }] }]} />
        </View>
        <Text style={styles.tutText}>Drži prst na ekranu i pomeraj ga levo-desno. Dok držiš, junak puca.</Text>
        <View style={styles.tutRow}>
          <Text style={[styles.tutSide, font, { color: '#9dff4a' }]}>◀ ZOMBIJI</Text>
          <Text style={[styles.tutSide, font, { color: '#8cc2ff' }]}>POLJA ▶</Text>
        </View>
        <Text style={styles.tutText}>Pucaj u polja da ih ojačaš ili otključaš, pa stani ispod polja da ga pokupiš.</Text>
        <GameButton testID="btn-tut-ok" small font={font} label="RAZUMEM" colors={COLORS.green} shade={COLORS.greenShade} onPress={onDone} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', top: 44, left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressBox: { flex: 1, gap: 3 },
  levelText: { color: '#fff', fontSize: 15, textAlign: 'center', ...outlineSm },
  progress: {},
  skull: { position: 'absolute', right: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#e0242c', borderWidth: 1.5, borderColor: '#fff' },
  coins: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(10,16,26,0.72)', paddingLeft: 4, paddingRight: 10, paddingVertical: 4, borderRadius: 16 },
  coinText: { color: '#fff', fontSize: 19, ...outlineSm },
  buffs: { position: 'absolute', top: 98, left: 14, right: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  buff: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
  buffText: { color: '#fff', fontSize: 13, ...outlineSm },
  bossBox: { position: 'absolute', top: 132, left: 26, right: 26, alignItems: 'center', gap: 4 },
  bossName: { color: '#ff7a7a', fontSize: 18, letterSpacing: 1, ...outlineSm },
  bossBar: { alignSelf: 'stretch' },
  bossHp: { color: '#fff', fontSize: 13, textAlign: 'center', ...outlineSm },
  toastWrap: { position: 'absolute', top: '30%', left: 10, right: 10, alignItems: 'center' },
  toast: { textAlign: 'center', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  empty: { position: 'absolute', bottom: 140, left: 16, right: 16, alignItems: 'center', backgroundColor: 'rgba(120,10,20,0.75)', borderRadius: 16, paddingVertical: 8 },
  emptyTitle: { color: '#fff', fontSize: 24, ...outlineSm },
  emptySub: { color: '#ffd0d6', fontSize: 14 },
  bottom: { position: 'absolute', bottom: 26, left: 14, right: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  hpBox: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(10,16,26,0.72)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, width: 170 },
  hpCol: { flex: 1, gap: 2 },
  hpBar: {},
  hpText: { color: '#fff', fontSize: 13, ...outlineSm },
  ammoBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,16,26,0.72)', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, minWidth: 118, borderWidth: 2, borderColor: 'transparent' },
  ammoLow: { borderColor: '#ff4a4a' },
  ammoText: { color: '#fff', fontSize: 26, ...outlineSm },
  weaponText: { color: '#ffd75a', fontSize: 11, marginTop: -2 },
  vig: { position: 'absolute', left: 0, right: 0 },
  vigSide: { position: 'absolute', top: 0, bottom: 0, width: 70 },
  tutWrap: { position: 'absolute', left: 16, right: 16, top: '34%', alignItems: 'center' },
  tutCard: { backgroundColor: 'rgba(10,16,26,0.9)', borderRadius: 20, padding: 16, gap: 10, alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)', maxWidth: 360 },
  tutTitle: { color: '#ffd75a', fontSize: 22, ...outlineSm },
  tutTrack: { width: 200, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  finger: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 4, borderColor: '#5aa2ff' },
  tutText: { color: '#e6ecf5', fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 20 },
  tutRow: { flexDirection: 'row', gap: 30 },
  tutSide: { fontSize: 20, ...outlineSm },
});
