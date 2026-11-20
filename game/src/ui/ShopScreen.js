// Oružarnica: trajne nadogradnje (šteta, brzina paljbe, municija, zdravlje) i kupovina/izbor oružja.
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameButton, IconButton, BackIcon, Coin, Bar, outlineSm, COLORS } from './components.js';
import { UPGRADES, upgradeCost, SHOP_WEAPONS, weaponBars } from '../state/progression.js';

export default function ShopScreen({ font, save, onBack, onBuyUpgrade, onBuyWeapon, onEquip }) {
  const [tab, setTab] = useState('upgrades');
  return (
    <View style={styles.root}>
      <LinearGradient colors={['rgba(8,12,20,0.94)', 'rgba(8,12,20,0.98)']} style={StyleSheet.absoluteFill} />
      <View style={styles.header}>
        <IconButton testID="btn-back" label="Nazad" onPress={onBack}>
          <BackIcon />
        </IconButton>
        <Text style={[styles.title, font]}>ORUŽARNICA</Text>
        <View style={styles.coinPill}>
          <Coin size={24} />
          <Text style={[styles.coinText, font]}>{save.coins}</Text>
        </View>
      </View>
      <View style={styles.tabs}>
        {[
          ['upgrades', 'NADOGRADNJE'],
          ['weapons', 'ORUŽJA'],
        ].map(([id, label]) => (
          <Pressable key={id} testID={'tab-' + id} accessibilityRole="tab" accessibilityState={{ selected: tab === id }} onPress={() => setTab(id)} style={[styles.tab, tab === id && styles.tabOn]}>
            <Text style={[styles.tabText, font, tab === id && styles.tabTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.list}>
        {tab === 'upgrades'
          ? UPGRADES.map((u) => {
              const lvl = save.upgrades[u.id];
              const maxed = lvl >= u.max;
              const cost = upgradeCost(u.id, lvl);
              const value = { damage: `+${lvl * 10}%`, rate: `+${lvl * 7}%`, ammo: `${80 + lvl * 20}`, health: `${100 + lvl * 20}` }[u.id];
              return (
                <View key={u.id} style={styles.card}>
                  <LinearGradient colors={u.color} style={styles.cardStripe} />
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, font]}>{u.name}</Text>
                      <Text style={[styles.cardValue, font]}>{value}</Text>
                    </View>
                    <Text style={styles.cardDesc}>{u.desc}</Text>
                    <View style={styles.pips}>
                      {Array.from({ length: u.max }, (_, i) => (
                        <View key={i} style={[styles.pip, i < lvl && { backgroundColor: u.color[0] }]} />
                      ))}
                    </View>
                  </View>
                  <View style={styles.cardBtn}>
                    <GameButton testID={'buy-' + u.id} small font={font} disabled={maxed || save.coins < cost} colors={COLORS.green} shade={COLORS.greenShade} onPress={() => onBuyUpgrade(u.id, cost)}>
                      {maxed ? (
                        <Text style={[styles.btnLabel, font]}>MAKS</Text>
                      ) : (
                        <>
                          <Coin size={18} />
                          <Text style={[styles.btnLabel, font]}>{cost}</Text>
                        </>
                      )}
                    </GameButton>
                  </View>
                </View>
              );
            })
          : SHOP_WEAPONS.map((w) => {
              const owned = !!save.weapons[w.id];
              const equipped = save.equipped === w.id;
              const bars = weaponBars(w);
              return (
                <View key={w.id} style={[styles.card, equipped && styles.cardEquipped]}>
                  <View style={styles.cardBody}>
                    <View style={styles.cardTop}>
                      <Text style={[styles.cardTitle, font]}>{w.name}</Text>
                      {equipped ? <Text style={[styles.equippedTag, font]}>OPREMLJENO</Text> : null}
                    </View>
                    <Text style={styles.cardDesc}>{w.desc}</Text>
                    {[
                      ['ŠTETA', bars.damage, ['#ff8a4c', '#e8582a']],
                      ['BRZINA', bars.rate, ['#c07bff', '#8a3ae8']],
                      ['MOĆ', bars.power, ['#ffd75a', '#ffb01f']],
                    ].map(([label, v, col]) => (
                      <View key={label} style={styles.statRow}>
                        <Text style={styles.statLabel}>{label}</Text>
                        <Bar value={v} colors={col} height={10} style={styles.statBar} />
                      </View>
                    ))}
                  </View>
                  <View style={styles.cardBtn}>
                    {owned ? (
                      <GameButton testID={'equip-' + w.id} small font={font} disabled={equipped} colors={COLORS.blue} shade={COLORS.blueShade} label={equipped ? 'U RUCI' : 'UZMI'} onPress={() => onEquip(w.id)} />
                    ) : (
                      <GameButton testID={'buyw-' + w.id} small font={font} disabled={save.coins < w.price} colors={COLORS.gold} shade={COLORS.goldShade} onPress={() => onBuyWeapon(w.id, w.price)}>
                        <Coin size={18} />
                        <Text style={[styles.btnLabel, font]}>{w.price}</Text>
                      </GameButton>
                    )}
                  </View>
                </View>
              );
            })}
        <Text style={styles.footer}>Zlatnike dobijaš za ubijene zombije, pređene nivoe, polja sa zlatnicima i dnevnu nagradu.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 46, paddingBottom: 8 },
  title: { color: '#fff', fontSize: 26, letterSpacing: 1, ...outlineSm },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.08)', paddingLeft: 4, paddingRight: 12, paddingVertical: 4, borderRadius: 18 },
  coinText: { color: '#fff', fontSize: 20, ...outlineSm },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginTop: 6, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14, padding: 4, gap: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 11, alignItems: 'center' },
  tabOn: { backgroundColor: '#2f6ff0' },
  tabText: { color: '#9aa6b8', fontSize: 16 },
  tabTextOn: { color: '#fff' },
  list: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  cardEquipped: { borderColor: '#5aa2ff' },
  cardStripe: { width: 8, alignSelf: 'stretch' },
  cardBody: { flex: 1, padding: 12, gap: 4, minWidth: 0 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  cardTitle: { color: '#fff', fontSize: 18, flexShrink: 1 },
  cardValue: { color: '#ffd75a', fontSize: 17 },
  cardDesc: { color: '#aab4c4', fontSize: 13, fontWeight: '600' },
  pips: { flexDirection: 'row', gap: 3, marginTop: 4, flexWrap: 'wrap' },
  pip: { width: 12, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  cardBtn: { paddingRight: 12, minWidth: 96 },
  btnLabel: { color: '#fff', fontSize: 17, ...outlineSm },
  equippedTag: { color: '#7fb6ff', fontSize: 12 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statLabel: { color: '#cfd8e6', fontSize: 11, width: 50, fontWeight: '800' },
  statBar: { flex: 1, borderWidth: 1 },
  footer: { color: '#7d8899', fontSize: 13, textAlign: 'center', marginTop: 6, fontWeight: '600' },
});
