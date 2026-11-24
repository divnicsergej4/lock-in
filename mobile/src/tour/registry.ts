// What the guided tour needs from the screens. In the prototype it read all of this straight from the
// page (document.querySelector, input values, open <details>); here the screens hand it over:
//  - targets: the views a step lights up, by the prototype's names ('bal-card', 'e-amt', 'vzc', ...);
//  - bus: what the user has done that a step waits for (typed an amount, opened More options, ...);
//  - running: whether the tour is on (the toast moves up, the edit sheet shows the pause note).

import { useEffect, useRef, useSyncExternalStore, type ComponentRef, type RefObject } from 'react';
import type { TextInput, View } from 'react-native';
import { makeMutable, useAnimatedRef, type AnimatedRef } from 'react-native-reanimated';

// ---- targets ----

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRef = AnimatedRef<any>;
const targets = new Map<string, AnyRef>();

/** Registers an existing animated ref as the tour target `id` (nothing when `id` is empty). */
export function useTourRef(id: string | undefined, ref: AnyRef) {
  useEffect(() => {
    if (!id) return;
    targets.set(id, ref);
    return () => {
      if (targets.get(id) === ref) targets.delete(id);
    };
  }, [id, ref]);
}

/** A new ref for a view the tour can light up as `id`. */
export function useTourTarget(id?: string) {
  const ref = useAnimatedRef<View>();
  useTourRef(id, ref);
  return ref;
}

export const tourRefs = (ids: string[]) => ids.map((id) => targets.get(id)).filter((r): r is AnyRef => !!r);

// ---- the fields a step types into ----
// The tour moves the keyboard on to the next field (text or number) and puts it away once the user has
// stopped typing; for that it knows the fields by name, their text and whether one has the keyboard.

type InputRef = RefObject<ComponentRef<typeof TextInput> | null>;
export const tourInputs = new Map<string, { ref: InputRef; value: string }>();
/** When the user last changed any of these fields (a key press, a paste, a delete). */
export const tourTyping = { at: 0 };

/** Registers a text field as `id` for the tour; pass its ref, or use the one returned. */
export function useTourInput(id: string, value: string, own?: InputRef) {
  const made = useRef<ComponentRef<typeof TextInput>>(null);
  const ref = own || made;
  const first = useRef(true);
  useEffect(() => {
    const e = tourInputs.get(id);
    if (e && e.ref === ref) e.value = value;
    if (first.current) first.current = false;
    else tourTyping.at = Date.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    tourInputs.set(id, { ref, value });
    return () => {
      if (tourInputs.get(id)?.ref === ref) tourInputs.delete(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ref]);
  return ref;
}

// ---- what the screens report ----

export const tourBus = {
  amt: '', // New entry: amount typed
  note: '', // New entry: description typed
  chip: 0, // a category chip was tapped
  more: false, // New entry: More options open
  wout: '', // Can I afford this?: the answer shown
  holoAct: 0, // the ring's panel in front (0 ring, 1 line, 2 calendar)
  lnDay: -1, // the line chart's selected day
  calDay: '', // the calendar's day summary
  fopen: false, // an envelope is out of the drawer
  sheet: false, // the edit sheet is open (the tour waits)
  // things the tour asks the screens to do
  expenseMode: null as null | (() => void), // New entry: switch to Expense
  clearCalDay: null as null | (() => void), // calendar: forget the selected day
};

// ---- is it running ----

let running = false;
const listeners = new Set<() => void>();
export function setTourRunning(on: boolean) {
  running = on;
  tourOnSV.value = on;
  listeners.forEach((f) => f());
}
export const isTourRunning = () => running;
export function useTourRunning() {
  return useSyncExternalStore(
    (f) => {
      listeners.add(f);
      return () => listeners.delete(f);
    },
    () => running,
  );
}

// ---- shared with the UI thread ----

/** The current tab's scroll offset (kept by each tab page while it is in front). */
export const pageY = makeMutable(0);
export const activeTab = makeMutable(0);
export const tourOnSV = makeMutable(false);
/** Where the light and the bubble are, so the toast can keep clear of them. */
export const tourHole = makeMutable({ l: 0, t: 0, r: 0, b: 0, on: false });
export const tourBubble = makeMutable({ y: 0, h: 0, on: false });
