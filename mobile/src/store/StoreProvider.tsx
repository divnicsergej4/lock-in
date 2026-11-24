import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { initialState, type AppState } from '@/logic/types';

import { clearTourSnapshot, loadState, saveState, saveTourSnapshot } from './storage';

interface Store {
  state: AppState;
  ready: boolean;
  /** Pass a function that returns the next state; it is saved to the phone right after (not in the demo). */
  update: (fn: (s: AppState) => AppState) => void;
  /** Demo: `data` is shown instead of the user's own; nothing is saved until the demo ends. */
  demo: boolean;
  startDemo: (data: AppState) => void;
  endDemo: () => void;
  /** Guided tour: the real data is put aside before it (entries made during the tour are practice). */
  tourStart: () => void;
  /** Ends the tour: the real data comes back, marked as toured. */
  tourEnd: () => void;
  /** Changes when the screens should start fresh (demo on / off, tour over): fields cleared, Home, top. */
  epoch: number;
}

const StoreContext = createContext<Store | null>(null);
// The theme and the demo flag on their own: most parts only need these (colours, "look only" in the demo), and
// reading them through useStore re-rendered every button and list row at every change of the data.
const ThemeContext = createContext<'light' | 'dark'>('dark');
const DemoContext = createContext(false);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const [demo, setDemo] = useState(false);
  const [epoch, setEpoch] = useState(0);
  const loaded = useRef(false);
  const real = useRef<AppState | null>(null); // the user's data while the demo is on
  const snap = useRef<AppState | null>(null); // the user's data before the tour

  useEffect(() => {
    loadState().then((s) => {
      loaded.current = true;
      setState(s);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    // Never overwrite the saved data with the empty initial state before it has loaded, nor with the demo.
    if (loaded.current && !demo) saveState(state);
  }, [state, demo]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  const startDemo = useCallback((data: AppState) => {
    setState((s) => {
      real.current = s;
      return data;
    });
    setDemo(true);
    setEpoch((e) => e + 1);
  }, []);
  const endDemo = useCallback(() => {
    if (real.current) setState(real.current);
    real.current = null;
    setDemo(false);
    setEpoch((e) => e + 1);
  }, []);

  const tourStart = useCallback(() => {
    setState((s) => {
      snap.current = s;
      saveTourSnapshot(s);
      return s;
    });
  }, []);
  const tourEnd = useCallback(() => {
    setState((s) => ({ ...(snap.current || s), tutSeen: 1 }));
    snap.current = null;
    clearTourSnapshot();
    setEpoch((e) => e + 1);
  }, []);

  return (
    <StoreContext.Provider value={{ state, ready, update, demo, startDemo, endDemo, tourStart, tourEnd, epoch }}>
      <ThemeContext.Provider value={state.theme === 'light' ? 'light' : 'dark'}>
        <DemoContext.Provider value={demo}>{children}</DemoContext.Provider>
      </ThemeContext.Provider>
    </StoreContext.Provider>
  );
}

/** The theme in use; re-renders only when it changes. */
export function useThemeName(): 'light' | 'dark' {
  return useContext(ThemeContext);
}

/** Whether the demo is on; re-renders only when it changes. */
export function useDemo(): boolean {
  return useContext(DemoContext);
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
