// A tab that is not in front does not re-render: all four tabs stay mounted, and every change of the saved data
// (opening a section, a new entry) used to re-render all of them. Measured with the React Profiler: a tap on
// "Can I afford this?" on Home spent 160 of its 187 ms in the hidden Spending tab (its charts and the whole
// transaction list), which on an Android phone is seconds. A frozen tab catches up when it comes to the front.
// Same as react-native-screens' freezeOnBlur (which does nothing on the web), including one more render after
// the tab is left, so useIsFocused inside it sees the blur.

import { Suspense, useEffect, useRef, useState, type ReactNode } from 'react';

/** Suspends its children while `freeze`: React keeps them as they are and skips them. */
function Suspender({ freeze, children }: { freeze: boolean; children: ReactNode }) {
  const p = useRef<{ promise?: Promise<void>; resolve?: () => void }>({}).current;
  if (freeze) {
    if (!p.promise) p.promise = new Promise<void>((r) => (p.resolve = r));
    throw p.promise;
  }
  if (p.promise) {
    p.resolve?.();
    p.promise = undefined;
  }
  return children;
}

interface Nav {
  isFocused: () => boolean;
  addListener: (type: 'focus' | 'blur', cb: () => void) => () => void;
}

export function TabFreeze({ navigation, children }: { navigation: Nav; children: ReactNode }) {
  const [front, setFront] = useState(() => navigation.isFocused());
  const [frozen, setFrozen] = useState(false);
  useEffect(() => {
    const off1 = navigation.addListener('focus', () => setFront(true));
    const off2 = navigation.addListener('blur', () => setFront(false));
    return () => {
      off1();
      off2();
    };
  }, [navigation]);
  useEffect(() => {
    if (front) return setFrozen(false);
    const id = setTimeout(() => setFrozen(true), 0);
    return () => clearTimeout(id);
  }, [front]);
  return (
    <Suspense fallback={null}>
      <Suspender freeze={!front && frozen}>{children}</Suspender>
    </Suspense>
  );
}
