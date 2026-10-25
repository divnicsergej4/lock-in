// Demo: look, don't touch (prototype demoNo). Anything that would change data is stopped with a short
// note (at most every 2.5 s); moving around, opening sections, the holo ring, the calendar and the drawer
// still work.

import { useCallback } from 'react';

import { useAppToast } from '@/components/AppToast';
import { DEMO_NO } from '@/logic/demo';
import { useStore } from '@/store/StoreProvider';

let last = 0;

export function useDemoGuard() {
  const { demo } = useStore();
  const toast = useAppToast();
  const no = useCallback(() => {
    if (Date.now() - last > 2500) {
      last = Date.now();
      toast(DEMO_NO);
    }
  }, [toast]);
  /** Wraps a handler: in the demo it only shows the note. */
  const guard = useCallback(<A extends unknown[]>(fn: (...a: A) => void) => (...a: A) => (demo ? no() : fn(...a)), [demo, no]);
  return { demo, no, guard };
}

/** Inputs are switched off in the demo and look faded (prototype: disabled, opacity .55). */
export const DEMO_FADE = 0.55;
