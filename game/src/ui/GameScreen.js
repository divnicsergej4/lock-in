// Privremeni ekran za proveru igranja (biće zamenjen pravim menijima).
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GLView } from 'expo-gl';
import { Game } from '../game/Game.js';

export default function GameScreen() {
  const gameRef = useRef(null);
  const [ui, setUi] = useState({});
  useEffect(() => () => gameRef.current && gameRef.current.destroy(), []);
  const onContextCreate = (gl) => {
    const g = new Game(gl, { onUi: setUi, onEvent: (type, res) => setUi((u) => ({ ...u, result: { type, ...res } })) });
    gameRef.current = g;
    g.showMenu(1);
    if (typeof window !== 'undefined') window.__game = g;
  };
  const responder = {
    onStartShouldSetResponder: () => true,
    onResponderGrant: (e) => {
      const g = gameRef.current;
      if (!g) return;
      if (g.mode === 'menu') g.startLevel(1, { weapon: 'pistol', dmgMul: 1, rateMul: 1, ammo: 60, maxHp: 100 });
      g.pointerDown(e.nativeEvent.locationX);
    },
    onResponderMove: (e) => gameRef.current && gameRef.current.pointerMove(e.nativeEvent.locationX),
    onResponderRelease: () => gameRef.current && gameRef.current.pointerUp(),
  };
  return (
    <View style={styles.root} onLayout={(e) => gameRef.current && gameRef.current.setViewSize(e.nativeEvent.layout.width, e.nativeEvent.layout.height)}>
      <View style={StyleSheet.absoluteFill} {...responder}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>
      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.t}>
          {ui.phase} | HP {ui.hp}/{ui.maxHp} | AMMO {ui.ammo} | {ui.weaponName} x{ui.multishot} dmg x{ui.dmgMult} | ubijeno {ui.kills} | talas {ui.wave}/{ui.waves}
        </Text>
        {ui.toast ? <Text style={styles.t}>{ui.toast.text}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111' },
  hud: { position: 'absolute', top: 40, left: 10, right: 10 },
  t: { color: '#fff', fontWeight: '800', textShadowColor: '#000', textShadowRadius: 3 },
});
