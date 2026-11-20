// Prozori preko ekrana: dnevna nagrada, podešavanja (sa uputstvom) i pauza.
import { Animated, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GameButton, IconButton, CloseIcon, Coin, Toggle, useAppear, outline, outlineSm, COLORS } from './components.js';
import { DAILY_REWARDS } from '../state/progression.js';

function Sheet({ children, font, title, colors = COLORS.blue, onClose }) {
  const a = useAppear(0);
  const scale = a.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.card, { opacity: a, transform: [{ scale }] }]}>
        <LinearGradient colors={colors} style={styles.ribbon}>
          <Text style={[styles.ribbonText, font]}>{title}</Text>
        </LinearGradient>
        {onClose ? (
          <View style={styles.close}>
            <IconButton testID="btn-close" label="Zatvori" size={40} onPress={onClose}>
              <CloseIcon />
            </IconButton>
          </View>
        ) : null}
        {children}
      </Animated.View>
    </View>
  );
}

export function DailyModal({ font, status, claimedToday, onClaim, onClose }) {
  return (
    <Sheet font={font} title="DNEVNA NAGRADA" colors={['#ff8a4c', '#e0482a']} onClose={onClose}>
      <Text style={styles.sub}>Vrati se svaki dan zaredom za sve veću nagradu!</Text>
      <View style={styles.grid}>
        {DAILY_REWARDS.map((amount, i) => {
          const done = i < status.day || (claimedToday && i === status.day);
          const today = i === status.day && status.available;
          return (
            <View key={i} style={[styles.day, i === 6 && styles.dayBig, today && styles.dayToday, done && styles.dayDone]}>
              <Text style={[styles.dayLabel, font]}>DAN {i + 1}</Text>
              <Coin size={i === 6 ? 34 : 24} />
              <Text style={[styles.dayAmount, font]}>{amount}</Text>
              {done ? <Text style={styles.check}>✓</Text> : null}
            </View>
          );
        })}
      </View>
      {status.available ? (
        <GameButton testID="btn-claim" font={font} colors={COLORS.green} shade={COLORS.greenShade} onPress={onClaim}>
          <Text style={[styles.btnLabel, font]}>PREUZMI</Text>
          <Coin size={22} />
          <Text style={[styles.btnLabel, font]}>{DAILY_REWARDS[status.day]}</Text>
        </GameButton>
      ) : (
        <Text style={[styles.comeBack, font]}>{claimedToday ? `+${DAILY_REWARDS[(status.day + 6) % 7]} ZLATNIKA! ` : ''}Sledeća nagrada sutra.</Text>
      )}
    </Sheet>
  );
}

export function SettingsModal({ font, settings, onChange, onClose }) {
  return (
    <Sheet font={font} title="PODEŠAVANJA" onClose={onClose}>
      <View style={styles.block}>
        <Toggle testID="toggle-sound" font={font} label="ZVUČNI EFEKTI" value={settings.sound} onChange={(v) => onChange({ ...settings, sound: v })} />
        <Toggle testID="toggle-music" font={font} label="MUZIKA" value={settings.music} onChange={(v) => onChange({ ...settings, music: v })} />
      </View>
      <View style={styles.help}>
        <Text style={[styles.helpTitle, font]}>KAKO SE IGRA</Text>
        <Text style={styles.helpText}>• Prevlači prst levo-desno da pomeraš junaka. Dok držiš prst, junak puca.</Text>
        <Text style={styles.helpText}>• Na računaru: A / D ili strelice ← → za levo-desno (dok držiš taster, junak puca), razmak = pucanje u mestu.</Text>
        <Text style={styles.helpText}>• Levo dolaze zombiji. Ubij ih pre nego što stignu do tebe.</Text>
        <Text style={styles.helpText}>• Desno dolaze polja napredovanja. Pucaj u njih: brojevi rastu, a zaključana se otključavaju. Stani ispod polja da ga pokupiš.</Text>
        <Text style={styles.helpText}>• Pazi na municiju i crvena polja sa minusom.</Text>
      </View>
      <GameButton testID="btn-ok" font={font} label="U REDU" colors={COLORS.blue} shade={COLORS.blueShade} onPress={onClose} />
    </Sheet>
  );
}

export function PauseMenu({ font, settings, onSettings, onResume, onRestart, onMenu }) {
  return (
    <Sheet font={font} title="PAUZA" colors={['#5a6a82', '#3a475c']}>
      <View style={styles.stack}>
        <GameButton testID="btn-resume" font={font} label="NASTAVI" colors={COLORS.green} shade={COLORS.greenShade} onPress={onResume} />
        <GameButton testID="btn-restart" font={font} label="PONOVO" colors={COLORS.blue} shade={COLORS.blueShade} onPress={onRestart} />
        <View style={styles.block}>
          <Toggle testID="pause-sound" font={font} label="ZVUČNI EFEKTI" value={settings.sound} onChange={(v) => onSettings({ ...settings, sound: v })} />
          <Toggle testID="pause-music" font={font} label="MUZIKA" value={settings.music} onChange={(v) => onSettings({ ...settings, music: v })} />
        </View>
        <GameButton testID="btn-menu" font={font} label="GLAVNI MENI" colors={COLORS.red} shade={COLORS.redShade} onPress={onMenu} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(4,8,16,0.72)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 380, backgroundColor: '#18212e', borderRadius: 26, borderWidth: 2, borderColor: 'rgba(255,255,255,0.15)', padding: 18, paddingTop: 34, gap: 12 },
  ribbon: { position: 'absolute', top: -24, alignSelf: 'center', paddingHorizontal: 26, paddingVertical: 9, borderRadius: 16, borderBottomWidth: 4, borderBottomColor: 'rgba(0,0,0,0.35)' },
  ribbonText: { color: '#fff', fontSize: 26, ...outline },
  close: { position: 'absolute', top: -14, right: -10 },
  sub: { color: '#c9d2e0', fontSize: 14, textAlign: 'center', fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  day: { width: 76, alignItems: 'center', gap: 3, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)' },
  dayBig: { width: 160 },
  dayToday: { borderColor: '#ffd75a', backgroundColor: 'rgba(255,215,90,0.16)' },
  dayDone: { opacity: 0.55 },
  dayLabel: { color: '#cfd8e6', fontSize: 12 },
  dayAmount: { color: '#fff', fontSize: 16, ...outlineSm },
  check: { position: 'absolute', top: 2, right: 6, color: '#8ef05a', fontSize: 18, fontWeight: '900' },
  btnLabel: { color: '#fff', fontSize: 21, ...outline },
  comeBack: { color: '#ffd75a', fontSize: 17, textAlign: 'center' },
  block: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 4 },
  help: { gap: 6 },
  helpTitle: { color: '#ffd75a', fontSize: 17 },
  helpText: { color: '#d5dce8', fontSize: 14, fontWeight: '600', lineHeight: 19 },
  stack: { gap: 12 },
});
