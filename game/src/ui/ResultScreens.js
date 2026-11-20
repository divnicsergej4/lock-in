// Ekrani posle nivoa: pobeda (zvezdice, nagrada) i poraz (oživljavanje, ponovo, meni).
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameButton, Coin, useAppear, outline, outlineSm, COLORS } from './components.js';

function Card({ children, title, colors, font }) {
  const a = useAppear(0);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] });
  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, { opacity: a, transform: [{ scale }] }]}>
        <LinearGradient colors={colors} style={styles.ribbon}>
          <Text style={[styles.ribbonText, font]}>{title}</Text>
        </LinearGradient>
        {children}
      </Animated.View>
    </View>
  );
}

function Stars({ count, font }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(220, anims.map((a) => Animated.spring(a, { toValue: 1, friction: 4, tension: 120, useNativeDriver: false }))).start();
  }, [anims]);
  return (
    <View style={styles.stars}>
      {[0, 1, 2].map((i) => (
        <Animated.Text key={i} style={[styles.star, i === 1 && styles.starMid, font, { color: i < count ? '#ffc934' : '#3a4454', transform: [{ scale: anims[i] }] }]}>
          ★
        </Animated.Text>
      ))}
    </View>
  );
}

function Row({ k, v, font, highlight }) {
  return (
    <View style={[styles.row, highlight && styles.rowHi]}>
      <Text style={styles.rowKey}>{k}</Text>
      <Text style={[styles.rowVal, font]}>{v}</Text>
    </View>
  );
}

export function VictoryScreen({ font, result, onNext, onShop, onMenu }) {
  return (
    <Card title="NIVO PREĐEN!" colors={COLORS.green} font={font}>
      <Stars count={result.stars} font={font} />
      <View style={styles.rows}>
        <Row k="Ubijeno zombija" v={result.kills} font={font} />
        <Row k="Preciznost" v={`${Math.round(result.accuracy * 100)}%`} font={font} />
        <Row k="Nagrada za nivo" v={`+${result.bonus}`} font={font} />
        {result.boss ? <Row k="Šef" v="POBEĐEN" font={font} /> : null}
      </View>
      <View style={styles.reward}>
        <Coin size={40} />
        <Text style={[styles.rewardText, font]}>+{result.coins}</Text>
      </View>
      <GameButton testID="btn-next" font={font} label="SLEDEĆI NIVO" big onPress={onNext} />
      <View style={styles.two}>
        <GameButton testID="btn-res-shop" style={styles.half} font={font} small label="ORUŽARNICA" colors={COLORS.blue} shade={COLORS.blueShade} onPress={onShop} />
        <GameButton testID="btn-res-menu" style={styles.half} font={font} small label="MENI" colors={COLORS.gray} shade={COLORS.grayShade} onPress={onMenu} />
      </View>
    </Card>
  );
}

export function GameOverScreen({ font, result, reviveCost, canAfford, onRevive, onRetry, onMenu }) {
  return (
    <Card title="POJELI SU TE!" colors={COLORS.red} font={font}>
      <View style={styles.rows}>
        <Row k="Ubijeno zombija" v={result.kills} font={font} />
        <Row k="Pređeno" v={`${Math.round(result.progress * 100)}%`} font={font} />
        <Row k="Zarađeno zlatnika" v={`+${result.coins}`} font={font} highlight />
      </View>
      {result.canRevive ? (
        <GameButton testID="btn-revive" font={font} disabled={!canAfford} colors={COLORS.green} shade={COLORS.greenShade} onPress={onRevive}>
          <Text style={[styles.btnLabel, font]}>OŽIVI</Text>
          <Coin size={22} />
          <Text style={[styles.btnLabel, font]}>{reviveCost}</Text>
        </GameButton>
      ) : null}
      {result.canRevive && !canAfford ? <Text style={styles.hint}>Nemaš dovoljno zlatnika za oživljavanje.</Text> : null}
      <GameButton testID="btn-retry" font={font} label="POKUŠAJ PONOVO" colors={COLORS.gold} shade={COLORS.goldShade} onPress={onRetry} />
      <GameButton testID="btn-lost-menu" font={font} small label="GLAVNI MENI" colors={COLORS.gray} shade={COLORS.grayShade} onPress={onMenu} />
      <Text style={styles.hint}>Savet: u oružarnici pojačaj štetu, municiju i zdravlje.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,16,0.66)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 360, backgroundColor: '#18212e', borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', padding: 18, paddingTop: 36, gap: 12 },
  ribbon: { position: 'absolute', top: -26, alignSelf: 'center', paddingHorizontal: 26, paddingVertical: 10, borderRadius: 16, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.35)' },
  ribbonText: { color: '#fff', fontSize: 30, ...outline },
  stars: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 6 },
  star: { fontSize: 50, ...outlineSm },
  starMid: { fontSize: 66, marginBottom: 6 },
  rows: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  rowHi: { backgroundColor: 'rgba(255,201,52,0.15)' },
  rowKey: { color: '#aab4c4', fontSize: 14, fontWeight: '700' },
  rowVal: { color: '#fff', fontSize: 18 },
  reward: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  rewardText: { color: '#ffd75a', fontSize: 42, ...outline },
  two: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  btnLabel: { color: '#fff', fontSize: 21, ...outline },
  hint: { color: '#8f9bb0', fontSize: 13, textAlign: 'center', fontWeight: '600' },
});
