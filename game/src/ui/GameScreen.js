// Ekran igre: 3D prikaz preko celog ekrana, kontrola prstom i natpisi (nivo, napredak, novčići, pobeda/poraz).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { useFonts, LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Game, PHASE } from '../game/Game.js';
import { ROAD_HALF } from '../game/config.js';

const FONT = 'LilitaOne_400Regular';

export default function GameScreen() {
  const gameRef = useRef(null);
  const [fontsLoaded] = useFonts({ [FONT]: LilitaOne_400Regular });
  const [ui, setUi] = useState({ phase: PHASE.READY, level: 1, count: 0, coins: 0, earned: 0, progress: 0 });
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

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>

      {/* Gornja traka: nivo i napredak, novčići */}
      <View style={styles.topBar} pointerEvents="none">
        <View style={styles.progressRow}>
          <View style={styles.levelBadge}>
            <Text style={[styles.levelText, font]}>{ui.level}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.round(ui.progress * 100)}%` }]} />
          </View>
          <View style={[styles.levelBadge, styles.levelBadgeNext]}>
            <Text style={[styles.levelText, font]}>{ui.level + 1}</Text>
          </View>
        </View>
        <View style={styles.coinPill}>
          <View style={styles.coin}>
            <View style={styles.coinInner} />
          </View>
          <Text style={[styles.coinText, font]}>{ui.coins}</Text>
        </View>
      </View>

      {ui.phase === PHASE.READY && <StartHint font={font} />}

      {ui.phase === PHASE.WON && (
        <EndPanel
          font={font}
          title="POBEDA!"
          color="#2f7bff"
          shade="#1d4fb8"
          lines={[`Preživelo vojnika: ${ui.count}`]}
          reward={ui.earned}
          button="SLEDEĆI NIVO"
          onPress={() => gameRef.current && gameRef.current.nextLevel()}
        />
      )}
      {ui.phase === PHASE.LOST && (
        <EndPanel
          font={font}
          title="PORAZ"
          color="#ff4646"
          shade="#b82424"
          lines={['Crvena vojska je bila jača.', 'Biraj pametnije kapije!']}
          button="POKUŠAJ PONOVO"
          onPress={() => gameRef.current && gameRef.current.retry()}
        />
      )}
    </View>
  );
}

function StartHint({ font }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(anim, { toValue: 0, duration: 750, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-60, 60] });
  return (
    <View style={styles.hintWrap} pointerEvents="none">
      <Text style={[styles.titleTop, font]}>ARMY</Text>
      <Text style={[styles.titleMain, font]}>RUSH 3D</Text>
      <View style={styles.track}>
        <Text style={[styles.arrow, font]}>‹</Text>
        <Animated.View style={[styles.finger, { transform: [{ translateX: tx }] }]}>
          <View style={styles.fingerDot} />
        </Animated.View>
        <Text style={[styles.arrow, font]}>›</Text>
      </View>
      <Text style={[styles.hint, font]}>PREVUCI PRSTOM LEVO-DESNO</Text>
    </View>
  );
}

function EndPanel({ font, title, color, shade, lines, reward, button, onPress }) {
  const pop = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 90, useNativeDriver: false }).start();
  }, [pop]);
  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  return (
    <View style={styles.endWrap}>
      <Animated.View style={[styles.card, { opacity: pop, transform: [{ scale }] }]}>
        <View style={[styles.ribbon, { backgroundColor: color, borderBottomColor: shade }]}>
          <Text style={[styles.endTitle, font]}>{title}</Text>
        </View>
        {lines.map((l) => (
          <Text key={l} style={styles.endLine}>
            {l}
          </Text>
        ))}
        {reward ? (
          <View style={styles.rewardRow}>
            <View style={[styles.coin, styles.coinBig]}>
              <View style={[styles.coinInner, styles.coinInnerBig]} />
            </View>
            <Text style={[styles.rewardText, font]}>+{reward}</Text>
          </View>
        ) : null}
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: color, borderBottomColor: shade, transform: [{ translateY: pressed ? 3 : 0 }], borderBottomWidth: pressed ? 2 : 5 },
          ]}
        >
          <Text style={[styles.buttonText, font]}>{button}</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const outline = { textShadowColor: 'rgba(12,40,90,0.55)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 0 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8fd6ff' },
  topBar: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressRow: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  levelBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2f7bff',
    borderWidth: 3,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  levelBadgeNext: { backgroundColor: '#9aa8bd' },
  levelText: { color: '#fff', fontSize: 16 },
  progressTrack: {
    flex: 1,
    height: 12,
    marginHorizontal: -4,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  progressFill: { height: '100%', backgroundColor: '#ffc934', borderRadius: 4 },
  coinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,45,95,0.5)',
    paddingLeft: 5,
    paddingRight: 12,
    paddingVertical: 4,
    borderRadius: 18,
  },
  coin: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffc934',
    borderWidth: 2,
    borderColor: '#e39a12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coinInner: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: '#f0b020' },
  coinBig: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  coinInnerBig: { width: 16, height: 16, borderRadius: 8, borderWidth: 3 },
  coinText: { color: '#fff', fontSize: 20 },
  hintWrap: { position: 'absolute', left: 16, right: 16, bottom: 70, alignItems: 'center' },
  titleTop: { color: '#ffc934', fontSize: 34, letterSpacing: 4, marginBottom: -10, ...outline },
  titleMain: { color: '#fff', fontSize: 58, letterSpacing: 1, marginBottom: 22, ...outline },
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
  hint: { color: '#fff', fontSize: 18, marginTop: 16, letterSpacing: 0.5, ...outline },
  endWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,25,55,0.4)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 28,
    paddingTop: 0,
    paddingBottom: 24,
    paddingHorizontal: 22,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderBottomWidth: 6,
    borderBottomColor: '#d6deea',
  },
  ribbon: {
    marginTop: -28,
    paddingHorizontal: 30,
    paddingVertical: 10,
    borderRadius: 18,
    borderBottomWidth: 5,
    marginBottom: 18,
  },
  endTitle: { fontSize: 40, color: '#fff', ...outline },
  endLine: { fontSize: 17, color: '#3a4560', fontWeight: '700', marginBottom: 4, textAlign: 'center' },
  rewardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  rewardText: { fontSize: 36, color: '#f0a81a' },
  button: { marginTop: 22, paddingVertical: 14, borderRadius: 18, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 22, letterSpacing: 0.5, ...outline },
});
