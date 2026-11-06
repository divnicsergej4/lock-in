// Ekran igre: 3D prikaz preko celog ekrana, kontrola prstom i sav prikaz preko igre
// (glavni meni, nivo i napredak, novčići, poruke, snaga neprijatelja, pobeda/poraz).
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

export default function GameScreen() {
  const gameRef = useRef(null);
  const [fontsLoaded] = useFonts({ [FONT]: LilitaOne_400Regular });
  const [ui, setUi] = useState({ phase: PHASE.READY, level: 1, count: 0, coins: 0, earned: 0, progress: 0, panel: false, toast: null, enemy: null, enemyMax: 1 });
  const { width } = useWindowDimensions();
  const widthRef = useRef(width);
  widthRef.current = width;

  useEffect(() => () => gameRef.current && gameRef.current.destroy(), []);

  // Prevlačenje prstom: koliko pomeriš prst preko ekrana, toliko se vojska pomeri preko puta.
  const pan = useMemo(() => {
    let startX = 0;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        const g = gameRef.current;
        if (!g) return;
        g.start();
        startX = g.getTargetX();
      },
      onPanResponderMove: (_e, gs) => {
        const g = gameRef.current;
        if (!g) return;
        const scale = (ROAD_HALF * 2 * 1.25) / Math.max(1, widthRef.current);
        g.steerTo(startX + gs.dx * scale);
      },
    });
  }, []);

  const onContextCreate = (gl) => {
    gameRef.current = new Game(gl, setUi);
    // Za automatsko testiranje u pregledaču.
    if (typeof window !== 'undefined') window.__armyRush = gameRef.current;
  };

  const font = fontsLoaded ? { fontFamily: FONT } : { fontWeight: '900' };
  const playing = ui.phase !== PHASE.READY;

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>

      {/* Blago zatamnjenje ivica ekrana (vinjeta) */}
      <LinearGradient pointerEvents="none" colors={['rgba(10,30,60,0.35)', 'rgba(10,30,60,0)']} style={styles.vignetteTop} />
      <LinearGradient pointerEvents="none" colors={['rgba(10,30,60,0)', 'rgba(10,30,60,0.3)']} style={styles.vignetteBottom} />

      {/* Gornja traka */}
      <View style={styles.topBar} pointerEvents="none">
        <View style={styles.progressRow}>
          <Badge font={font} value={ui.level} colors={BLUE} />
          <View style={styles.progressTrack}>
            <LinearGradient colors={GOLD} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[styles.progressFill, { width: `${Math.round(ui.progress * 100)}%` }]} />
          </View>
          <Badge font={font} value={ui.level + 1} colors={['#b6c2d4', '#8d9ab0']} />
        </View>
        <View style={styles.coinPill}>
          <Coin />
          <Text style={[styles.coinText, font]}>{ui.coins}</Text>
        </View>
      </View>

      {/* Snaga neprijatelja pred veliku bitku */}
      {ui.enemy != null && playing && !ui.panel && <EnemyBar font={font} enemy={ui.enemy} max={ui.enemyMax} army={ui.count} />}

      {/* Poruke (kapije, bitka) */}
      {ui.toast && playing && !ui.panel && <Toast key={ui.toast.id} font={font} toast={ui.toast} />}

      {ui.phase === PHASE.READY && <MainMenu font={font} level={ui.level} onPlay={() => gameRef.current && gameRef.current.start()} />}
      {ui.phase === PHASE.RUN && ui.level === 1 && ui.progress < 0.08 && <DragHint font={font} />}

      {ui.phase === PHASE.WON && ui.panel && (
        <EndPanel
          font={font}
          title="POBEDA!"
          colors={BLUE}
          shade={BLUE_SHADE}
          stars={ui.count >= ui.enemyMax ? 3 : ui.count >= ui.enemyMax * 0.4 ? 2 : 1}
          lines={[`Preživelo vojnika: ${ui.count}`]}
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
          lines={['Crvena vojska je bila jača.', 'Biraj pametnije kapije!']}
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

// Dugme sa prelivom i "debljinom" (pomera se nadole kad se pritisne)
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

function MainMenu({ font, level, onPlay }) {
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
        <Text style={[styles.titleTop, font]}>ARMY</Text>
        <Text style={[styles.titleMain, font]}>RUSH 3D</Text>
        <View style={styles.levelChip}>
          <Text style={[styles.levelChipText, font]}>NIVO {level}</Text>
        </View>
      </Animated.View>
      <Animated.View style={[styles.playWrap, { opacity: enter, transform: [{ scale }] }]}>
        <GameButton font={font} label="IGRAJ" colors={GOLD} shade={GOLD_SHADE} onPress={onPlay} big />
      </Animated.View>
      <Text style={[styles.menuHint, font]} pointerEvents="none">
        ili prevuci prstom po ekranu
      </Text>
    </View>
  );
}

function DragHint({ font }) {
  const v = usePulse(650);
  const tx = v.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });
  return (
    <View style={styles.dragWrap} pointerEvents="none">
      <View style={styles.track}>
        <Text style={[styles.arrow, font]}>‹</Text>
        <Animated.View style={[styles.finger, { transform: [{ translateX: tx }] }]}>
          <View style={styles.fingerDot} />
        </Animated.View>
        <Text style={[styles.arrow, font]}>›</Text>
      </View>
      <Text style={[styles.hint, font]}>VODI VOJSKU LEVO-DESNO</Text>
    </View>
  );
}

// Kratka poruka na sredini ekrana (npr. "+20", "×2", "BITKA!")
function Toast({ font, toast }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.sequence([
      Animated.spring(v, { toValue: 1, friction: 5, tension: 140, useNativeDriver: false }),
      Animated.delay(350),
      Animated.timing(v, { toValue: 2, duration: 300, useNativeDriver: false }),
    ]).start();
  }, [v]);
  const scale = v.interpolate({ inputRange: [0, 1, 2], outputRange: [0.3, 1, 1.15] });
  const opacity = v.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] });
  const ty = v.interpolate({ inputRange: [0, 1, 2], outputRange: [20, 0, -30] });
  const color = toast.good ? '#ffffff' : '#ffd0d6';
  const stroke = toast.good ? 'rgba(20,80,200,0.85)' : 'rgba(170,20,40,0.9)';
  return (
    <View style={styles.toastWrap} pointerEvents="none">
      <Animated.Text
        style={[styles.toastText, font, { color, textShadowColor: stroke, opacity, transform: [{ scale }, { translateY: ty }] }]}
      >
        {toast.text}
      </Animated.Text>
    </View>
  );
}

function EnemyBar({ font, enemy, max, army }) {
  const ratio = Math.max(0, Math.min(1, enemy / Math.max(1, max)));
  const winning = army > enemy;
  return (
    <View style={styles.enemyWrap} pointerEvents="none">
      <View style={styles.enemyRow}>
        <Text style={[styles.enemyLabel, font]}>NEPRIJATELJ</Text>
        <Text style={[styles.enemyCount, font]}>{enemy}</Text>
      </View>
      <View style={styles.enemyTrack}>
        <LinearGradient colors={RED} style={[styles.enemyFill, { width: `${ratio * 100}%` }]} />
      </View>
      <Text style={[styles.enemyVs, font, { color: winning ? '#bff5c9' : '#ffd0d6' }]}>
        TVOJA VOJSKA: {army} {winning ? '▲' : '▼'}
      </Text>
    </View>
  );
}

function EndPanel({ font, title, colors, shade, stars = 0, lines, reward, button, onPress }) {
  const pop = useRef(new Animated.Value(0)).current;
  const starAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: false }).start();
    Animated.stagger(
      180,
      starAnims.map((a) => Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false })),
    ).start();
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
                style={[
                  styles.star,
                  i === 1 && styles.starMid,
                  { color: i < stars ? '#ffc934' : '#d5dce8', transform: [{ scale: starAnims[i] }] },
                ]}
              >
                ★
              </Animated.Text>
            ))}
          </View>
        )}
        {lines.map((l) => (
          <Text key={l} style={styles.endLine}>
            {l}
          </Text>
        ))}
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

const outline = { textShadowColor: 'rgba(12,40,90,0.6)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8fd6ff' },
  vignetteTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 140 },
  vignetteBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 160 },
  topBar: { position: 'absolute', top: 48, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  levelText: { color: '#fff', fontSize: 17, ...outline, textShadowOffset: { width: 0, height: 2 } },
  progressTrack: {
    flex: 1,
    height: 14,
    marginHorizontal: -4,
    backgroundColor: 'rgba(15,45,95,0.45)',
    borderRadius: 7,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressFill: { height: '100%', borderRadius: 5 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,45,95,0.55)',
    paddingLeft: 4,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#d68a0c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#e8a019' },
  coinBig: { width: 40, height: 40, borderRadius: 20, borderWidth: 3 },
  coinInnerBig: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  coinText: { color: '#fff', fontSize: 20, ...outline, textShadowOffset: { width: 0, height: 2 } },

  menu: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'space-between', paddingTop: 140, paddingBottom: 70 },
  logoWrap: { alignItems: 'center' },
  titleTop: { color: '#ffc934', fontSize: 38, letterSpacing: 6, marginBottom: -12, ...outline },
  titleMain: { color: '#fff', fontSize: 64, letterSpacing: 1, ...outline, textShadowOffset: { width: 0, height: 5 } },
  levelChip: { marginTop: 8, backgroundColor: 'rgba(15,45,95,0.55)', paddingHorizontal: 16, paddingVertical: 5, borderRadius: 14 },
  levelChipText: { color: '#fff', fontSize: 18, letterSpacing: 1 },
  playWrap: { width: 230 },
  menuHint: { color: '#fff', fontSize: 16, marginTop: 14, opacity: 0.9, ...outline, textShadowOffset: { width: 0, height: 2 } },

  btnOuter: { borderRadius: 20, alignSelf: 'stretch' },
  btnInner: { borderRadius: 20, paddingVertical: 14, alignItems: 'center', overflow: 'hidden' },
  btnInnerBig: { paddingVertical: 18 },
  btnShine: { position: 'absolute', top: 4, left: 12, right: 12, height: '40%', borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.22)' },
  buttonText: { color: '#fff', fontSize: 22, letterSpacing: 0.5, ...outline },
  buttonTextBig: { fontSize: 32, letterSpacing: 2 },

  dragWrap: { position: 'absolute', left: 16, right: 16, bottom: 90, alignItems: 'center' },
  track: {
    width: 220,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(15,45,95,0.45)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  arrow: { color: '#fff', fontSize: 34, marginTop: -4 },
  finger: {
    position: 'absolute',
    left: 110 - 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderBottomColor: '#c9d6e8',
  },
  fingerDot: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#2f7bff' },
  hint: { color: '#fff', fontSize: 18, marginTop: 14, letterSpacing: 0.5, ...outline },

  toastWrap: { position: 'absolute', top: '24%', left: 0, right: 0, alignItems: 'center' },
  toastText: { fontSize: 64, textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },

  enemyWrap: { position: 'absolute', top: 100, left: 40, right: 40, alignItems: 'center' },
  enemyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  enemyLabel: { color: '#fff', fontSize: 15, letterSpacing: 1, ...outline, textShadowOffset: { width: 0, height: 2 } },
  enemyCount: { color: '#ffd0d6', fontSize: 18, ...outline, textShadowOffset: { width: 0, height: 2 } },
  enemyTrack: {
    alignSelf: 'stretch',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(60,10,20,0.55)',
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  enemyFill: { height: '100%' },
  enemyVs: { fontSize: 14, marginTop: 5, letterSpacing: 0.5, ...outline, textShadowOffset: { width: 0, height: 2 } },

  endWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(8,22,50,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingBottom: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderBottomWidth: 6,
    borderBottomColor: '#cfd8e6',
  },
  ribbonOuter: { marginTop: -30, borderRadius: 20, paddingBottom: 5, marginBottom: 10 },
  ribbon: { paddingHorizontal: 34, paddingVertical: 10, borderRadius: 20 },
  endTitle: { fontSize: 42, color: '#fff', ...outline },
  starsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginBottom: 6 },
  star: { fontSize: 46, textShadowColor: 'rgba(160,100,0,0.35)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  starMid: { fontSize: 60, marginBottom: 6 },
  endLine: { fontSize: 17, color: '#3a4560', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  rewardText: { fontSize: 40, color: '#f0a81a', textShadowColor: 'rgba(150,90,0,0.3)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 },
  endButton: { alignSelf: 'stretch', marginTop: 22 },
});
