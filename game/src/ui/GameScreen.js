// Ekran igre: 3D prikaz preko celog ekrana, kontrola prstom i natpisi (nivo, novčići, pobeda/poraz).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { GLView } from 'expo-gl';
import { Game, PHASE } from '../game/Game.js';
import { ROAD_HALF } from '../game/config.js';

export default function GameScreen() {
  const gameRef = useRef(null);
  const [ui, setUi] = useState({ phase: PHASE.READY, level: 1, count: 0, coins: 0, earned: 0 });
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

  return (
    <View style={styles.root}>
      <View style={StyleSheet.absoluteFill} {...pan.panHandlers}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>

      {/* Gornja traka */}
      <View style={styles.topBar} pointerEvents="none">
        <View style={styles.pill}>
          <Text style={styles.pillText}>NIVO {ui.level}</Text>
        </View>
        <View style={[styles.pill, styles.coinPill]}>
          <View style={styles.coin} />
          <Text style={styles.pillText}>{ui.coins}</Text>
        </View>
      </View>

      {ui.phase === PHASE.READY && <StartHint />}

      {ui.phase === PHASE.WON && (
        <EndPanel
          title="POBEDA!"
          color="#2f7bff"
          lines={[`Preživelo vojnika: ${ui.count}`, `+${ui.earned} novčića`]}
          button="SLEDEĆI NIVO"
          onPress={() => gameRef.current && gameRef.current.nextLevel()}
        />
      )}
      {ui.phase === PHASE.LOST && (
        <EndPanel
          title="PORAZ"
          color="#ff4646"
          lines={['Crvena vojska je bila jača.', 'Biraj pametnije kapije!']}
          button="POKUŠAJ PONOVO"
          onPress={() => gameRef.current && gameRef.current.retry()}
        />
      )}
    </View>
  );
}

function StartHint() {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  const tx = anim.interpolate({ inputRange: [0, 1], outputRange: [-50, 50] });
  return (
    <View style={styles.hintWrap} pointerEvents="none">
      <Text style={styles.title}>ARMY RUSH 3D</Text>
      <View style={styles.track}>
        <Animated.View style={[styles.finger, { transform: [{ translateX: tx }] }]} />
      </View>
      <Text style={styles.hint}>Prevuci prstom levo-desno</Text>
    </View>
  );
}

function EndPanel({ title, color, lines, button, onPress }) {
  return (
    <View style={styles.endWrap}>
      <View style={styles.card}>
        <Text style={[styles.endTitle, { color }]}>{title}</Text>
        {lines.map((l) => (
          <Text key={l} style={styles.endLine}>
            {l}
          </Text>
        ))}
        <Pressable onPress={onPress} style={({ pressed }) => [styles.button, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}>
          <Text style={styles.buttonText}>{button}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const shadow = { textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 4 };

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#8fd6ff' },
  topBar: {
    position: 'absolute',
    top: 52,
    left: 16,
    right: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pill: {
    backgroundColor: 'rgba(20,40,80,0.55)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  coinPill: { gap: 8 },
  coin: { width: 16, height: 16, borderRadius: 8, backgroundColor: '#ffc934', borderWidth: 2, borderColor: '#e09a12' },
  pillText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  hintWrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 90,
    alignItems: 'center',
    backgroundColor: 'rgba(20,40,80,0.45)',
    borderRadius: 24,
    paddingVertical: 22,
  },
  title: { color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: 1, marginBottom: 22, ...shadow },
  track: { width: 160, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.7)', alignItems: 'center', justifyContent: 'center' },
  finger: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', borderWidth: 3, borderColor: '#2f7bff' },
  hint: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 22, ...shadow },
  endWrap: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,20,40,0.35)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { backgroundColor: '#fff', borderRadius: 24, paddingVertical: 28, paddingHorizontal: 26, alignItems: 'center', width: '100%', maxWidth: 340 },
  endTitle: { fontSize: 42, fontWeight: '900', marginBottom: 12 },
  endLine: { fontSize: 17, color: '#334', fontWeight: '600', marginBottom: 4 },
  button: { marginTop: 20, paddingVertical: 15, borderRadius: 16, alignSelf: 'stretch', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
});
