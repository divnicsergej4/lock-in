// Glavni meni: naslov, nivo koji sledi, dugme IGRAJ, oružarnica, dnevna nagrada i podešavanja.
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameButton, IconButton, GearIcon, Coin, GiftIcon, GunIcon, usePulse, useAppear, outline, outlineSm, COLORS } from './components.js';
import { getLevel } from '../game/world/levels.js';
import { WEAPONS } from '../game/combat/weapons.js';
import { loadoutFromSave } from '../state/progression.js';

export default function MainMenu({ font, save, dailyAvailable, onPlay, onShop, onDaily, onSettings }) {
  const lvl = getLevel(save.level);
  const pulse = usePulse(700);
  const enter = useAppear(150);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const ty = enter.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  const lo = loadoutFromSave(save);
  const stars = save.stars[save.level - 1];
  return (
    <View style={styles.root} pointerEvents="box-none">
      <LinearGradient pointerEvents="none" colors={['rgba(5,8,14,0.75)', 'rgba(5,8,14,0)']} style={styles.topShade} />
      <LinearGradient pointerEvents="none" colors={['rgba(5,8,14,0)', 'rgba(5,8,14,0.85)']} style={styles.bottomShade} />

      <View style={styles.topBar}>
        <IconButton testID="btn-settings" label="Podešavanja" onPress={onSettings}>
          <GearIcon />
        </IconButton>
        <View style={styles.coinPill}>
          <Coin size={26} />
          <Text style={[styles.coinText, font]}>{save.coins}</Text>
        </View>
      </View>

      <Animated.View style={[styles.logo, { opacity: enter, transform: [{ translateY: ty }] }]} pointerEvents="none">
        <Text style={[styles.titleTop, font]}>ZOMBIE</Text>
        <Text style={[styles.titleMain, font]}>RUSH 3D</Text>
        <View style={styles.levelCard}>
          <Text style={[styles.levelNum, font]}>NIVO {save.level}</Text>
          <Text style={[styles.levelTheme, font]}>{lvl.theme.name}</Text>
          {lvl.boss ? (
            <View style={styles.bossChip}>
              <Text style={[styles.bossChipText, font]}>ŠEF NA KRAJU NIVOA</Text>
            </View>
          ) : null}
          {save.level > 1 && stars ? <Text style={styles.prevStars}>Prethodni nivo: {'★'.repeat(stars)}{'☆'.repeat(3 - stars)}</Text> : null}
        </View>
      </Animated.View>

      <View style={styles.bottom} pointerEvents="box-none">
        <View style={styles.loadout} pointerEvents="none">
          <Text style={[styles.loadoutText, font]}>
            {WEAPONS[save.equipped].name} · ZDRAVLJE {lo.maxHp} · MUNICIJA {lo.ammo}
          </Text>
        </View>
        <Animated.View style={[styles.playWrap, { opacity: enter, transform: [{ scale }] }]}>
          <GameButton testID="btn-play" label="IGRAJ" font={font} big onPress={onPlay} />
        </Animated.View>
        <View style={styles.row}>
          <Pressable testID="btn-shop" accessibilityRole="button" accessibilityLabel="Oružarnica" onPress={onShop} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
            <LinearGradient colors={COLORS.blue} style={styles.tileInner}>
              <GunIcon size={26} />
              <Text style={[styles.tileText, font]}>ORUŽARNICA</Text>
            </LinearGradient>
          </Pressable>
          <Pressable testID="btn-daily" accessibilityRole="button" accessibilityLabel="Dnevna nagrada" onPress={onDaily} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
            <LinearGradient colors={['#ff8a4c', '#e0482a']} style={styles.tileInner}>
              <GiftIcon size={26} />
              <Text style={[styles.tileText, font]}>NAGRADA</Text>
            </LinearGradient>
            {dailyAvailable ? <View style={styles.dot} /> : null}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  topShade: { position: 'absolute', top: 0, left: 0, right: 0, height: 260 },
  bottomShade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 330 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 46 },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(10,16,26,0.75)', paddingLeft: 5, paddingRight: 14, paddingVertical: 5, borderRadius: 20, borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  coinText: { color: '#fff', fontSize: 22, ...outlineSm },
  logo: { alignItems: 'center', marginTop: -40 },
  titleTop: { color: COLORS.toxic, fontSize: 46, letterSpacing: 7, marginBottom: -14, textShadowColor: 'rgba(30,70,10,0.9)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  titleMain: { color: '#fff', fontSize: 66, letterSpacing: 1, ...outline, textShadowOffset: { width: 0, height: 5 } },
  levelCard: { marginTop: 10, alignItems: 'center', backgroundColor: 'rgba(10,16,26,0.72)', paddingHorizontal: 22, paddingVertical: 10, borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  levelNum: { color: '#ffd75a', fontSize: 26, ...outlineSm },
  levelTheme: { color: '#fff', fontSize: 16, letterSpacing: 1, marginTop: 2 },
  bossChip: { marginTop: 6, backgroundColor: '#c8242c', paddingHorizontal: 12, paddingVertical: 3, borderRadius: 10 },
  bossChipText: { color: '#fff', fontSize: 13, letterSpacing: 0.5 },
  prevStars: { color: '#ffd75a', fontSize: 13, marginTop: 4, fontWeight: '700' },
  bottom: { paddingHorizontal: 18, paddingBottom: 34, alignItems: 'center', gap: 14 },
  loadout: { backgroundColor: 'rgba(10,16,26,0.6)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  loadoutText: { color: '#cfd8e6', fontSize: 13, letterSpacing: 0.3 },
  playWrap: { width: 250 },
  row: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  tile: { flex: 1, borderRadius: 18, borderBottomWidth: 5, borderBottomColor: 'rgba(0,0,0,0.45)' },
  tilePressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  tileInner: { borderRadius: 18, paddingVertical: 12, alignItems: 'center', gap: 6 },
  tileText: { color: '#fff', fontSize: 16, ...outlineSm },
  dot: { position: 'absolute', top: -5, right: -5, width: 20, height: 20, borderRadius: 10, backgroundColor: '#ff2a3a', borderWidth: 3, borderColor: '#fff' },
});
