import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

import { initialState, type AppState } from '@/logic/types';

import { loadState, saveState } from './storage';

interface Store {
  state: AppState;
  ready: boolean;
  /** Pass a function that returns the next state; it is saved to the phone right after. */
  update: (fn: (s: AppState) => AppState) => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    loadState().then((s) => {
      loaded.current = true;
      setState(s);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    // Never overwrite the saved data with the empty initial state before it has loaded.
    if (loaded.current) saveState(state);
  }, [state]);

  const update = useCallback((fn: (s: AppState) => AppState) => setState(fn), []);

  return <StoreContext.Provider value={{ state, ready, update }}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const s = useContext(StoreContext);
  if (!s) throw new Error('useStore must be used inside <StoreProvider>');
  return s;
}
