// Ekran igre: 3D prikaz preko celog ekrana, kontrola prstom i sav prikaz preko igre:
// glavni meni, nivo i napredak, novčići, broj vojnika, oružje, šteta, pojačanja,
// traka života šefa, oznaka trake, poruke, pobeda/poraz.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Game, PHASE } from '../game/Game.js';
import { ROAD_HALF } from '../game/config.js';

const FONT = 'LilitaOne_400Regular';
const BLUE = ['#4f9bff', '#2f6ff0'];
const BLUE_SHADE = '#1c4bb5';
const RED = ['#ff6a6a', '#e83a3a'];
const RED_SHADE = '#a8202a';
const GOLD = ['#ffd75a', '#ffb01f'];
const GOLD_SHADE = '#c77a07';
const GREEN = ['#7be04a', '#3fae2a'];

const INITIAL = {
  phase: PHASE.READY, level: 1, theme: '', count: 0, coins: 0, earned: 0, kills: 0, progress: 0, panel: false, toast: null,
  tier: 0, weapon: '', dmg: 0, dps: 0, dmgPct: 0, ratePct: 0, speedPct: 0, doubleT: 0, bossHp: null, bossMax: 1, lane: 1,
};

export default function GameScreen() {
  const gameRef = useRef(null);
  const [fontsLoaded] = useFonts({ [FONT]: LilitaOne_400Regular });
  const [ui, setUi] = useState(INITIAL);
  const { width } = useWindowDimensions();
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => () => gameRef.current && gameRef.current.destroy(), []);

  // Prevlačenje prstom: vojska prati prst preko obe trake (preko zida prelazi u drugu traku).
  // Kratak dodir leve ili desne strane ekrana = prelazak u tu traku.
  const pan = useMemo(() => {
    let startX = 0;
    let startT = 0;
    let moved = false;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const g = gameRef.current;
        if (!g) return;
        startX = g.getTargetX();
        startT = Date.now();
        moved = false;
      },
      onPanResponderMove: (_e, gs) => {
        const g = gameRef.current;
        if (!g) return;
        if (Math.abs(gs.dx) > 8) {
          moved = true;
          g.start();
        }
        const scale = (ROAD_HALF * 2 * 1.15) / Math.max(1, widthRef.current);
        if (moved) g.steerTo(startX + gs.dx * scale);
      },
      onPanResponderRelease: (e, gs) => {
        const g = gameRef.current;
        if (!g || moved || Date.now() - startT > 350) return;
        const x = gs.x0 || (e.nativeEvent && e.nativeEvent.pageX) || 0;
        g.tapSide(x < widthRef.current / 2 ? -1 : 1);
      },
    });
  }, []);

  const onContextCreate = (gl) => {
    gameRef.current = new Game(gl, setUi);
    // Za automatsko testiranje u pregledaču.
    if (typeof window !== 'undefined') window.__game = gameRef.current;
  };

  const font = fontsLoaded ? { fontFamily: FONT } : { fontWeight: '900' };
  const playing = ui.phase === PHASE.RUN || ui.phase === PHASE.BOSS;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>

      <LinearGradient pointerEvents="none" colors={['rgba(8,16,30,0.5)', 'rgba(8,16,30,0)']} style={styles.vignetteTop} />
      <LinearGradient pointerEvents="none" colors={['rgba(8,16,30,0)', 'rgba(8,16,30,0.35)']} style={styles.vignetteBottom} />

      {/* Gornja traka: nivo, napredak, novčići */}
      <View style={styles.topBar} pointerEvents="none">
        <View style={styles.progressRow}>
          <Badge font={font} value={ui.level} colors={BLUE} />
          <View style={styles.progressTrack}>
            <LinearGradient colors={GOLD} style={[styles.progressFill, { width: `${Math.round(ui.progress * 100)}%` }]} />
            <View style={styles.skull}>
              <Text style={[styles.skullText, font]}>ŠEF</Text>
            </View>
          </View>
        </View>
        <View style={styles.coinPill}>
          <Coin />
          <Text style={[styles.coinText, font]}>{ui.coins}</Text>
        </View>
      </View>

      {/* Vojska, oružje, šteta, pojačanja */}
      {playing && !ui.panel && <StatsBar font={font} ui={ui} />}

      {/* Šef */}
      {ui.bossHp != null && !ui.panel && <BossBar font={font} hp={ui.bossHp} max={ui.bossMax} />}

      {ui.toast && playing && !ui.panel && <Toast key={ui.toast.id} font={font} toast={ui.toast} />}
      {ui.toast && ui.phase === PHASE.WON && !ui.panel && <Toast key={ui.toast.id} font={font} toast={ui.toast} />}

      {ui.phase === PHASE.RUN && <LaneBar font={font} lane={ui.lane} />}

      {ui.phase === PHASE.READY && (
        <MainMenu font={font} level={ui.level} theme={ui.theme} onPlay={() => gameRef.current && gameRef.current.start()} />
      )}

      {ui.phase === PHASE.WON && ui.panel && (
        <EndPanel
          font={font}
          title="POBEDA!"
          colors={BLUE}
          shade={BLUE_SHADE}
          stars={ui.count >= 40 ? 3 : ui.count >= 15 ? 2 : 1}
          rows={[
            ['Ubijeno zombija', ui.kills],
            ['Preživelo vojnika', ui.count],
            ['Oružje', ui.weapon],
          ]}
          reward={ui.earned}
          button="SLEDEĆI NIVO"
          onPress={() => gameRef.current && gameRef.current.nextLevel()}
        />
      )}
      {ui.phase === PHASE.LOST && ui.panel && (
        <EndPanel
          font={font}
          title="PORAZ"
          colors={RED}
          shade={RED_SHADE}
          rows={[
            ['Ubijeno zombija', ui.kills],
            ['Savet', 'Gađaj kocke za jače oružje!'],
          ]}
          reward={ui.earned}
          button="POKUŠAJ PONOVO"
          onPress={() => gameRef.current && gameRef.current.retry()}
        />
      )}
    </View>
  );
}

function Badge({ font, value, colors }) {
  return (
    <LinearGradient colors={colors} style={styles.levelBadge}>
      <Text style={[styles.levelText, font]}>{value}</Text>
    </LinearGradient>
  );
}

function Coin({ big = false }) {
  return (
    <LinearGradient colors={['#ffe27a', '#ffb81c']} style={[styles.coin, big && styles.coinBig]}>
      <View style={[styles.coinInner, big && styles.coinInnerBig]} />
    </LinearGradient>
  );
}

// Broj koji kratko "skoči" kad se promeni
function PopNumber({ value, style }) {
  const v = useRef(new Animated.Value(1)).current;
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      v.setValue(1.35);
      Animated.spring(v, { toValue: 1, friction: 4, tension: 160, useNativeDriver: false }).start();
    }
  }, [value, v]);
  return <Animated.Text style={[style, { transform: [{ scale: v }] }]}>{value}</Animated.Text>;
}

function StatsBar({ font, ui }) {
  const stars = '●'.repeat(ui.tier + 1) + '○'.repeat(6 - ui.tier);
  const chips = [];
  if (ui.dmgPct) chips.push({ t: `ŠTETA +${ui.dmgPct}%`, c: ['#ff8a4c', '#e8582a'] });
  if (ui.ratePct) chips.push({ t: `PALJBA +${ui.ratePct}%`, c: ['#ffbf4a', '#e89a12'] });
  if (ui.speedPct) chips.push({ t: `BRZINA +${ui.speedPct}%`, c: ['#4fe08a', '#22b05a'] });
  if (ui.doubleT) chips.push({ t: `×2 ŠTETA ${ui.doubleT}s`, c: ['#c07bff', '#8a3ae8'] });
  return (
    <View style={styles.statsWrap} pointerEvents="none">
      <View style={styles.statsRow}>
        <View style={[styles.statPill, styles.armyPill]}>
          <View style={styles.soldierIcon}>
            <View style={styles.soldierHead} />
            <View style={styles.soldierBody} />
          </View>
          <PopNumber value={ui.count} style={[styles.armyText, font]} />
        </View>
        <View style={[styles.statPill, styles.weaponPill]}>
          <Text style={[styles.weaponName, font]} numberOfLines={1}>
            {ui.weapon}
          </Text>
          <Text style={styles.weaponStars}>{stars}</Text>
        </View>
        <View style={styles.statPill}>
          <Text style={[styles.dmgLabel, font]}>ŠTETA</Text>
          <Text style={[styles.dmgValue, font]}>{ui.dmg}</Text>
        </View>
      </View>
      {chips.length > 0 && (
        <View style={styles.chipsRow}>
          {chips.map((c) => (
            <LinearGradient key={c.t} colors={c.c} style={styles.chip}>
              <Text style={[styles.chipText, font]}>{c.t}</Text>
            </LinearGradient>
          ))}
        </View>
      )}
    </View>
  );
}

function BossBar({ font, hp, max }) {
  const ratio = Math.max(0, Math.min(1, hp / Math.max(1, max)));
  return (
    <View style={styles.bossWrap} pointerEvents="none">
      <Text style={[styles.bossLabel, font]}>ŠEF ZOMBIJA</Text>
      <View style={styles.bossTrack}>
        <LinearGradient colors={['#ff5a5a', '#b81d2a']} style={[styles.bossFill, { width: `${ratio * 100}%` }]} />
        <Text style={[styles.bossHp, font]}>{hp}</Text>
      </View>
    </View>
  );
}

// Oznaka trake na dnu ekrana: leva = zombiji, desna = kocke
function LaneBar({ font, lane }) {
  return (
    <View style={styles.laneWrap} pointerEvents="none">
      <LinearGradient colors={lane < 0 ? GREEN : ['rgba(20,30,50,0.55)', 'rgba(20,30,50,0.55)']} style={styles.laneChip}>
        <Text style={[styles.laneText, font]}>◀ ZOMBIJI</Text>
      </LinearGradient>
      <LinearGradient colors={lane > 0 ? BLUE : ['rgba(20,30,50,0.55)', 'rgba(20,30,50,0.55)']} style={styles.laneChip}>
        <Text style={[styles.laneText, font]}>KOCKE ▶</Text>
      </LinearGradient>
    </View>
  );
}

function GameButton({ font, label, colors, shade, onPress, big = false }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.btnOuter, { backgroundColor: shade, paddingBottom: pressed ? 2 : 6, marginTop: pressed ? 4 : 0 }]}>
      <LinearGradient colors={colors} style={[styles.btnInner, big && styles.btnInnerBig]}>
        <View style={styles.btnShine} />
        <Text style={[styles.buttonText, big && styles.buttonTextBig, font]}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function usePulse(duration = 900) {
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

function MainMenu({ font, level, theme, onPlay }) {
  const pulse = usePulse(700);
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(enter, { toValue: 1, friction: 7, tension: 50, delay: 300, useNativeDriver: false }).start();
  }, [enter]);
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });
  const ty = enter.interpolate({ inputRange: [0, 1], outputRange: [-40, 0] });
  return (
    <View style={styles.menu} pointerEvents="box-none">
      <Animated.View style={[styles.logoWrap, { opacity: enter, transform: [{ translateY: ty }] }]} pointerEvents="none">
        <Text style={[styles.titleTop, font]}>ZOMBIE</Text>
        <Text style={[styles.titleMain, font]}>RUSH 3D</Text>
        <View style={styles.levelChip}>
          <Text style={[styles.levelChipText, font]}>
            NIVO {level} · {theme}
          </Text>
        </View>
      </Animated.View>
      <View style={styles.menuBottom} pointerEvents="box-none">
        <View style={styles.howRow} pointerEvents="none">
          <View style={[styles.howCard, { borderColor: '#7be04a' }]}>
            <Text style={[styles.howTitle, font, { color: '#9dff6a' }]}>◀ LEVO</Text>
            <Text style={styles.howText}>zombiji jurišaju</Text>
          </View>
          <View style={[styles.howCard, { borderColor: '#4f9bff' }]}>
            <Text style={[styles.howTitle, font, { color: '#8cc2ff' }]}>DESNO ▶</Text>
            <Text style={styles.howText}>gađaj kocke za pojačanja</Text>
          </View>
        </View>
        <Animated.View style={[styles.playWrap, { opacity: enter, transform: [{ scale }] }]}>
          <GameButton font={font} label="IGRAJ" colors={GOLD} shade={GOLD_SHADE} onPress={onPlay} big />
        </Animated.View>
        <Text style={[styles.menuHint, font]} pointerEvents="none">
          prevuci ili dodirni levo/desno za promenu trake
        </Text>
      </View>
    </View>
  );
}

function Toast({ font, toast }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: false }),
      Animated.delay(450),
      Animated.timing(v, { toValue: 2, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.12] });
  const opacity = v.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  const ty = v.interpolate({ inputRange: [0, 1, 2], outputRange: [20, 0, -30] });
  const styleByKind = {
    good: { color: '#ffffff', textShadowColor: 'rgba(20,80,200,0.9)' },
    epic: { color: '#ffe066', textShadowColor: 'rgba(140,40,200,0.95)' },
    bad: { color: '#ffd0d6', textShadowColor: 'rgba(170,20,40,0.95)' },
  }[toast.kind || 'good'];
  const size = toast.text.length > 12 ? 34 : toast.text.length > 7 ? 44 : 60;
  return (
    <View style={styles.toastWrap} pointerEvents="none">
      <Animated.Text style={[styles.toastText, font, styleByKind, { fontSize: size, opacity, transform: [{ scale }, { translateY: ty }] }]}>
        {toast.text}
      </Animated.Text>
    </View>
  );
}

function EndPanel({ font, title, colors, shade, stars = 0, rows, reward, button, onPress }) {
  const pop = useRef(new Animated.Value(0)).current;
  const starAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: false }).start();
    Animated.stagger(180, starAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }))).start();
  }, [pop, starAnims]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return (
    <View style={styles.endWrap}>
      <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale }] }]}>
        <View style={[styles.ribbonOuter, { backgroundColor: shade }]}>
          <LinearGradient colors={colors} style={styles.ribbon}>
            <Text style={[styles.endTitle, font]}>{title}</Text>
          </LinearGradient>
        </View>
        {stars > 0 && (
          <View style={styles.starsRow}>
            {[0, 1, 2].map((i) => (
              <Animated.Text
                key={i}
                style={[styles.star, i === 1 && styles.starMid, { color: i < stars ? '#ffc934' : '#d5dce8', transform: [{ scale: starAnims[i] }] }]}
              >
                ★
              </Animated.Text>
            ))}
          </View>
        )}
        <View style={styles.rows}>
          {rows.map(([k, v]) => (
            <View key={k} style={styles.row}>
              <Text style={styles.rowKey}>{k}</Text>
              <Text style={[styles.rowVal, font]}>{v}</Text>
            </View>
          ))}
        </View>
        {reward ? (
          <View style={styles.rewardRow}>
            <Coin big />
            <Text style={[styles.rewardText, font]}>+{reward}</Text>
          </View>
        ) : null}
        <View style={styles.endButton}>
          <GameButton font={font} label={button} colors={colors} shade={shade} onPress={onPress} />
        </View>
      </Animated.View>
    </View>
  );
}

const outline = { textShadowColor: 'rgba(12,30,60,0.65)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 };
const outlineSm = { textShadowColor: 'rgba(12,30,60,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 0 };
const pillBg = 'rgba(12,24,44,0.62)';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a2230' },
  vignetteTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 190 },
  vignetteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  topBar: { position: 'absolute', top: 46, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  levelBadge: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  levelText: { color: '#fff', fontSize: 18, ...outlineSm },
  progressTrack: {
    flex: 1, height: 16, marginLeft: -4, backgroundColor: 'rgba(12,24,44,0.6)', borderRadius: 8, overflow: 'hidden', borderWidth: 2, borderColor: '#fff', justifyContent: 'center',
  },
  progressFill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  skull: { position: 'absolute', right: 3, backgroundColor: '#d8323a', borderRadius: 5, paddingHorizontal: 4 },
  skullText: { color: '#fff', fontSize: 9 },
  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: pillBg, paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)',
  },
  coin: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#d68a0c', alignItems: 'center', justifyContent: 'center' },
  coinInner: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#e8a019' },
  coinBig: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  coinInnerBig: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  coinText: { color: '#fff', fontSize: 20, ...outlineSm },

  statsWrap: { position: 'absolute', top: 94, left: 16, right: 16 },
  statsRow: { flexDirection: 'row', gap: 6 },
  statPill: { backgroundColor: pillBg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.18)' },
  armyPill: { flexDirection: 'row', gap: 6, borderColor: '#4f9bff', minWidth: 74 },
  soldierIcon: { alignItems: 'center' },
  soldierHead: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2c63d6', borderWidth: 1.5, borderColor: '#fff' },
  soldierBody: { width: 14, height: 10, borderTopLeftRadius: 6, borderTopRightRadius: 6, backgroundColor: '#2f7bff', marginTop: 1, borderWidth: 1.5, borderColor: '#fff' },
  armyText: { color: '#fff', fontSize: 22, ...outlineSm },
  weaponPill: { flex: 1, borderColor: '#ffc934' },
  weaponName: { color: '#ffd75a', fontSize: 14, ...outlineSm },
  weaponStars: { color: '#ffc934', fontSize: 8, letterSpacing: 1.5, marginTop: 1 },
  dmgLabel: { color: '#ffb8a0', fontSize: 10 },
  dmgValue: { color: '#fff', fontSize: 17, ...outlineSm },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  chip: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { color: '#fff', fontSize: 12, ...outlineSm, textShadowOffset: { width: 0, height: 1 } },

  bossWrap: { position: 'absolute', top: 178, left: 30, right: 30, alignItems: 'center' },
  bossLabel: { color: '#fff', fontSize: 16, letterSpacing: 1, marginBottom: 3, ...outlineSm },
  bossTrack: { alignSelf: 'stretch', height: 20, borderRadius: 10, backgroundColor: 'rgba(40,6,12,0.7)', borderWidth: 2, borderColor: '#fff', overflow: 'hidden', justifyContent: 'center' },
  bossFill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  bossHp: { color: '#fff', fontSize: 13, textAlign: 'center', ...outlineSm },

  laneWrap: { position: 'absolute', bottom: 34, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between' },
  laneChip: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  laneText: { color: '#fff', fontSize: 15, letterSpacing: 0.5, ...outlineSm },

  menu: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'space-between', paddingTop: 140, paddingBottom: 50 },
  logoWrap: { alignItems: 'center' },
  titleTop: { color: '#9dff4a', fontSize: 42, letterSpacing: 6, marginBottom: -12, textShadowColor: 'rgba(20,60,10,0.8)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  titleMain: { color: '#fff', fontSize: 64, letterSpacing: 1, ...outline, textShadowOffset: { width: 0, height: 5 } },
  levelChip: { marginTop: 8, backgroundColor: pillBg, paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14 },
  levelChipText: { color: '#fff', fontSize: 17, letterSpacing: 1 },
  menuBottom: { alignItems: 'center', alignSelf: 'stretch', paddingHorizontal: 16 },
  howRow: { flexDirection: 'row', gap: 10, marginBottom: 18, alignSelf: 'stretch' },
  howCard: { flex: 1, backgroundColor: pillBg, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 10, borderWidth: 2, alignItems: 'center' },
  howTitle: { fontSize: 18, ...outlineSm },
  howText: { color: '#e6ecf5', fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  playWrap: { width: 230 },
  menuHint: { color: '#fff', fontSize: 14, marginTop: 14, opacity: 0.9, textAlign: 'center', ...outlineSm },

  btnOuter: { borderRadius: 20, alignSelf: 'stretch' },
  btnInner: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', overflow: 'hidden' },
  btnInnerBig: { paddingVertical: 18 },
  btnShine: { position: 'absolute', top: 4, left: 12, right: 12, height: '40%', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)' },
  buttonText: { color: '#fff', fontSize: 22, letterSpacing: 0.5, ...outline },
  buttonTextBig: { fontSize: 32, letterSpacing: 2 },

  toastWrap: { position: 'absolute', top: '30%', left: 10, right: 10, alignItems: 'center' },
  toastText: { textAlign: 'center', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },

  endWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,14,30,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 28, paddingBottom: 24, paddingHorizontal: 22, alignItems: 'center', width: '100%', maxWidth: 340, borderBottomWidth: 6, borderBottomColor: '#cfd8e6' },
  ribbonOuter: { marginTop: -30, borderRadius: 20, paddingBottom: 5, marginBottom: 10 },
  ribbon: { paddingHorizontal: 34, paddingVertical: 10, borderRadius: 20 },
  endTitle: { fontSize: 42, color: '#fff', ...outline },
  starsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 6 },
  star: { fontSize: 46, textShadowColor: 'rgba(160,100,0,0.35)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  starMid: { fontSize: 60, marginBottom: 6 },
  rows: { alignSelf: 'stretch', gap: 6, marginTop: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f4f9', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  rowKey: { color: '#5a6580', fontSize: 14, fontWeight: '700' },
  rowVal: { color: '#26314a', fontSize: 16, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  rewardText: { fontSize: 40, color: '#f0a81a', textShadowColor: 'rgba(150,90,0,0.3)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  endButton: { alignSelf: 'stretch', marginTop: 20 },
});
