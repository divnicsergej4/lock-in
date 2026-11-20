// Glavni ekran aplikacije: 3D igra preko celog ekrana + svi meniji preko nje.
// Tok: učitavanje → "dodirni za početak" → glavni meni ⇄ oružarnica → igra (pauza) → pobeda/poraz.
// Ovde se čuva napredak (zlatnici, nivo, nadogradnje, oružja, dnevne nagrade, podešavanja).
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View, Pressable, Animated } from 'react-native';
import { GLView } from 'expo-gl';
import { LinearGradient } from 'expo-linear-gradient';
import { useFonts, LilitaOne_400Regular } from '@expo-google-fonts/lilita-one';
import { Game } from '../game/Game.js';
import Sound from '../audio/Sound';
import { loadSave, writeSave, DEFAULT_SAVE } from '../state/save.js';
import { loadoutFromSave, dailyStatus, claimDaily } from '../state/progression.js';
import { FONT, usePulse, outline, COLORS } from './components.js';
import MainMenu from './MainMenu.js';
import ShopScreen from './ShopScreen.js';
import HUD from './HUD.js';
import { DailyModal, SettingsModal, PauseMenu } from './Modals.js';
import { VictoryScreen, GameOverScreen } from './ResultScreens.js';

const reviveCost = (level) => 100 + level * 25;

export default function GameScreen() {
  const gameRef = useRef(null);
  const [fontsLoaded] = useFonts({ [FONT]: LilitaOne_400Regular });
  const [save, setSave] = useState(null);
  const [screen, setScreen] = useState('loading'); // loading | tap | menu | shop | game | result
  const [modal, setModal] = useState(null); // daily | settings
  const [ui, setUi] = useState({});
  const [paused, setPaused] = useState(false);
  const [result, setResult] = useState(null);
  const [glReady, setGlReady] = useState(false);
  const [claimedToday, setClaimedToday] = useState(false);
  const [tutorial, setTutorial] = useState(false);
  const saveRef = useRef(null);
  saveRef.current = save;
  const screenRef = useRef(screen);
  screenRef.current = screen;

  const font = fontsLoaded ? { fontFamily: FONT } : { fontWeight: '900' };

  const updateSave = useCallback((fn) => {
    setSave((prev) => {
      const next = fn(prev || DEFAULT_SAVE);
      writeSave(next);
      return next;
    });
  }, []);

  useEffect(() => {
    loadSave().then(setSave);
  }, []);

  useEffect(() => {
    if (save && glReady && screen === 'loading') {
      gameRef.current.showMenu(save.level);
      setScreen('tap');
    }
  }, [save, glReady, screen]);

  useEffect(() => {
    if (save) Sound.setEnabled({ sfx: save.settings.sound, music: save.settings.music });
  }, [save && save.settings.sound, save && save.settings.music]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => gameRef.current && gameRef.current.destroy(), []);

  // Kad aplikacija ode u pozadinu, igra se pauzira
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active' && screenRef.current === 'game' && gameRef.current && !gameRef.current.paused) {
        gameRef.current.setPaused(true);
        setPaused(true);
        Sound.music('none');
      }
    });
    return () => sub.remove();
  }, []);

  // Zlatnici iz partije se upisuju čim se partija završi (i posle oživljavanja samo razlika)
  const creditRun = useCallback(
    (extra = {}) => {
      const g = gameRef.current;
      const run = g && g.run;
      if (!run) return;
      const delta = run.coins - (run.credited || 0);
      run.credited = run.coins;
      const kills = run.kills - (run.killsCredited || 0);
      run.killsCredited = run.kills;
      updateSave((s) => {
        let next = { ...s, coins: s.coins + Math.max(0, delta), stats: { ...s.stats, kills: s.stats.kills + kills } };
        if (extra.patch) next = { ...next, ...extra.patch(next) };
        return next;
      });
    },
    [updateSave],
  );

  const onEvent = useCallback(
    (type, res) => {
      if (type === 'won') {
        const n = res.level;
        creditRun({
          patch: (s) => ({
            level: Math.max(s.level, n + 1),
            maxLevel: Math.max(s.maxLevel, n + 1),
            stars: { ...s.stars, [n]: Math.max(s.stars[n] || 0, res.stars) },
            stats: { ...s.stats, wins: s.stats.wins + 1 },
          }),
        });
      } else {
        creditRun();
      }
      setResult({ type, ...res });
      setScreen('result');
    },
    [creditRun],
  );
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const onContextCreate = (gl) => {
    const g = new Game(gl, { onUi: setUi, onEvent: (t, r) => onEventRef.current(t, r), sound: Sound });
    gameRef.current = g;
    if (typeof window !== 'undefined') {
      window.__game = g;
      window.__sound = Sound;
    }
    setGlReady(true);
  };

  // ---------- Radnje ----------
  const startApp = () => {
    Sound.init();
    Sound.music('menu');
    Sound.play('ui');
    setScreen('menu');
    if (dailyStatus(save).available) setModal('daily');
  };

  const goMenu = () => {
    gameRef.current.showMenu(saveRef.current.level);
    setScreen('menu');
    setPaused(false);
    setResult(null);
    Sound.music('menu');
  };

  const play = () => {
    const s = saveRef.current;
    Sound.init();
    Sound.play('ui');
    gameRef.current.startLevel(s.level, loadoutFromSave(s));
    setScreen('game');
    setPaused(false);
    setResult(null);
    setTutorial(s.level === 1 && !s.tutorialDone);
    updateSave((x) => ({ ...x, stats: { ...x.stats, games: x.stats.games + 1 } }));
  };

  const retry = () => {
    Sound.play('ui');
    const s = saveRef.current;
    gameRef.current.startLevel(result ? result.level : s.level, loadoutFromSave(s));
    setScreen('game');
    setPaused(false);
    setResult(null);
  };

  const revive = () => {
    const cost = reviveCost(result.level);
    if (saveRef.current.coins < cost) return;
    updateSave((s) => ({ ...s, coins: s.coins - cost }));
    gameRef.current.revive();
    Sound.music(gameRef.current.boss ? 'boss' : 'game');
    setScreen('game');
    setResult(null);
  };

  const pause = () => {
    Sound.play('ui');
    gameRef.current.setPaused(true);
    setPaused(true);
    Sound.music('none');
  };

  const resume = () => {
    Sound.play('ui');
    gameRef.current.setPaused(false);
    setPaused(false);
    Sound.music(gameRef.current.phase === 'boss' ? 'boss' : 'game');
  };

  const restartFromPause = () => {
    creditRun();
    retry();
  };

  const quitFromPause = () => {
    creditRun();
    Sound.play('ui');
    goMenu();
  };

  const changeSettings = (settings) => {
    Sound.play('ui');
    updateSave((s) => ({ ...s, settings }));
    Sound.setEnabled({ sfx: settings.sound, music: settings.music });
  };

  const claim = () => {
    const r = claimDaily(saveRef.current);
    if (!r.amount) return;
    setSave(r.save);
    writeSave(r.save);
    setClaimedToday(true);
    Sound.play('daily');
  };

  const buyUpgrade = (id, cost) => {
    if (saveRef.current.coins < cost) return;
    Sound.play('buy');
    updateSave((s) => (s.coins >= cost ? { ...s, coins: s.coins - cost, upgrades: { ...s.upgrades, [id]: s.upgrades[id] + 1 } } : s));
  };

  const buyWeapon = (id, price) => {
    if (saveRef.current.coins < price) return;
    Sound.play('buy');
    updateSave((s) => (s.coins >= price ? { ...s, coins: s.coins - price, weapons: { ...s.weapons, [id]: true }, equipped: id } : s));
  };

  const equip = (id) => {
    Sound.play('ui');
    updateSave((s) => ({ ...s, equipped: id }));
  };

  const finishTutorial = () => {
    Sound.play('ui');
    setTutorial(false);
    updateSave((s) => ({ ...s, tutorialDone: true }));
    gameRef.current.setPaused(false);
  };

  // Uputstvo zaustavlja igru dok ga igrač ne pročita
  const tutorialVisible = tutorial && screen === 'game' && ui.phase && ui.phase !== 'intro';
  useEffect(() => {
    if (tutorialVisible && gameRef.current && !gameRef.current.paused) gameRef.current.setPaused(true);
  }, [tutorialVisible]);

  // ---------- Dodir za igru (prevlačenje levo-desno) ----------
  const canAim = screen === 'game' && !paused && !tutorialVisible;
  const responder = {
    onStartShouldSetResponder: () => canAim,
    onMoveShouldSetResponder: () => canAim,
    onResponderGrant: (e) => gameRef.current && gameRef.current.pointerDown(e.nativeEvent.locationX ?? e.nativeEvent.pageX),
    onResponderMove: (e) => gameRef.current && gameRef.current.pointerMove(e.nativeEvent.locationX ?? e.nativeEvent.pageX),
    onResponderRelease: () => gameRef.current && gameRef.current.pointerUp(),
    onResponderTerminate: () => gameRef.current && gameRef.current.pointerUp(),
  };

  const dStatus = save ? dailyStatus(save) : { available: false, day: 0 };

  return (
    <View
      style={styles.root}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        if (gameRef.current) gameRef.current.setViewSize(width, height);
        else setTimeout(() => gameRef.current && gameRef.current.setViewSize(width, height), 300);
      }}
    >
      <View style={StyleSheet.absoluteFill} {...responder}>
        <GLView style={StyleSheet.absoluteFill} onContextCreate={onContextCreate} msaaSamples={4} />
      </View>

      {screen === 'menu' && save ? (
        <MainMenu font={font} save={save} dailyAvailable={dStatus.available} onPlay={play} onShop={() => { Sound.play('ui'); setScreen('shop'); }} onDaily={() => { Sound.play('ui'); setClaimedToday(false); setModal('daily'); }} onSettings={() => { Sound.play('ui'); setModal('settings'); }} />
      ) : null}
      {screen === 'shop' && save ? (
        <ShopScreen font={font} save={save} onBack={() => { Sound.play('ui'); setScreen('menu'); }} onBuyUpgrade={buyUpgrade} onBuyWeapon={buyWeapon} onEquip={equip} />
      ) : null}
      {(screen === 'game' || screen === 'result') && ui.mode === 'play' ? (
        <HUD font={font} ui={ui} onPause={pause} tutorial={tutorialVisible} onTutorialDone={finishTutorial} />
      ) : null}
      {screen === 'game' && paused && save ? (
        <PauseMenu font={font} settings={save.settings} onSettings={changeSettings} onResume={resume} onRestart={restartFromPause} onMenu={quitFromPause} />
      ) : null}
      {screen === 'result' && result && result.type === 'won' ? (
        <VictoryScreen font={font} result={result} onNext={play} onShop={() => { Sound.play('ui'); gameRef.current.showMenu(saveRef.current.level); setResult(null); setScreen('shop'); Sound.music('menu'); }} onMenu={goMenu} />
      ) : null}
      {screen === 'result' && result && result.type === 'lost' && save ? (
        <GameOverScreen font={font} result={result} reviveCost={reviveCost(result.level)} canAfford={save.coins >= reviveCost(result.level)} onRevive={revive} onRetry={retry} onMenu={goMenu} />
      ) : null}

      {modal === 'daily' && save ? <DailyModal font={font} status={dStatus} claimedToday={claimedToday} onClaim={claim} onClose={() => { Sound.play('ui'); setModal(null); }} /> : null}
      {modal === 'settings' && save ? <SettingsModal font={font} settings={save.settings} onChange={changeSettings} onClose={() => { Sound.play('ui'); setModal(null); }} /> : null}

      {screen === 'loading' || screen === 'tap' ? <Splash font={font} ready={screen === 'tap'} onTap={startApp} /> : null}
    </View>
  );
}

// Početni ekran: naslov i "dodirni za početak" (prvi dodir uključuje zvuk u pregledaču)
function Splash({ font, ready, onTap }) {
  const p = usePulse(650);
  const o = p.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] });
  return (
    <Pressable testID="splash" accessibilityRole="button" accessibilityLabel="Dodirni za početak" style={StyleSheet.absoluteFill} onPress={ready ? onTap : undefined}>
      <LinearGradient colors={['rgba(5,8,14,0.92)', 'rgba(5,8,14,0.55)', 'rgba(5,8,14,0.92)']} style={styles.splash}>
        <Text style={[styles.sTitleTop, font]}>ZOMBIE</Text>
        <Text style={[styles.sTitle, font]}>RUSH 3D</Text>
        <Animated.Text style={[styles.sTap, font, { opacity: o }]}>{ready ? 'DODIRNI ZA POČETAK' : 'UČITAVANJE...'}</Animated.Text>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f16' },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sTitleTop: { color: COLORS.toxic, fontSize: 50, letterSpacing: 8, marginBottom: -14, textShadowColor: 'rgba(30,70,10,0.9)', textShadowOffset: { width: 0, height: 4 }, textShadowRadius: 0 },
  sTitle: { color: '#fff', fontSize: 70, ...outline, textShadowOffset: { width: 0, height: 5 } },
  sTap: { color: '#fff', fontSize: 20, marginTop: 40, letterSpacing: 1 },
});
