// Android: the keyboard covered fields and buttons and the page did not move. Since SDK 53 Android apps are edge
// to edge, so the window no longer gets shorter when the keyboard comes up, and the scroll views'
// automaticallyAdjustKeyboardInsets works on iOS only. Here, on Android only, a page with fields gets room for the
// keyboard at its end (KeyboardSpace) and, when the keyboard comes up, is scrolled so the field being typed in and
// what is right under it (its button) sit above the keyboard. iOS stays as it was: its scroll views do this
// themselves.

import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, ScrollView, TextInput, View, type KeyboardEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

const ANDROID = Platform.OS === 'android';
/** Kept visible under the field: a row of fields and the button (8 + 47 + 12 + 47 px and a little more). */
const ROOM = 124;

/** The keyboard's height on Android (0 while it is down, and always 0 elsewhere). */
export function useAndroidKeyboardHeight() {
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!ANDROID) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => setH(e.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setH(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return h;
}

/** Room for the keyboard at the end of a page (Android), so the last fields can be scrolled above it. */
export function KeyboardSpace() {
  const h = useAndroidKeyboardHeight();
  return h ? <View style={{ height: h }} /> : null;
}

/** How far the focused field (and ROOM under it) reaches under the keyboard, at most so far that its top stays
 *  below `top`; 0 when it is clear. */
function overlap(e: KeyboardEvent, top: number, done: (dy: number) => void) {
  const input = TextInput.State.currentlyFocusedInput();
  if (!input) return;
  input.measureInWindow((_x, y, _w, h) => {
    const need = y + h + ROOM - (e.endCoordinates.screenY - 8);
    if (need > 0) done(Math.min(need, Math.max(0, y - top - 12)));
  });
}

/**
 * Android: when the keyboard comes up (or changes, e.g. letters → numbers), `scrollBy(dy)` is called so the
 * focused field and its button are above the keyboard. `top`: where the page's visible part starts.
 */
export function useKeepFieldInView(scrollBy: (dy: number) => void, top: number) {
  const latest = useRef(scrollBy);
  latest.current = scrollBy;
  useEffect(() => {
    if (!ANDROID) return;
    const sub = Keyboard.addListener('keyboardDidShow', (e) => {
      // a moment later, once the room at the page's end (KeyboardSpace) is there
      setTimeout(() => overlap(e, top, (dy) => latest.current(dy)), 60);
    });
    return () => sub.remove();
  }, [top]);
}

/** useKeepFieldInView for a plain ScrollView (the start screen, sign-in): its ref and, on Android, the onScroll
 *  that keeps its offset. */
export function useScrollFieldInView(top: number) {
  const ref = useRef<ComponentRef<typeof ScrollView>>(null);
  const y = useRef(0);
  useKeepFieldInView((dy) => ref.current?.scrollTo({ y: y.current + dy, animated: true }), top);
  const onScroll = ANDROID ? (e: NativeSyntheticEvent<NativeScrollEvent>) => void (y.current = e.nativeEvent.contentOffset.y) : undefined;
  return { ref, onScroll };
}

/** Android: how far a window that sits at the bottom of the screen (an edit sheet) has to move up so the
 *  keyboard does not cover it; 0 while the keyboard is down. Measured, so it is 0 where the window already
 *  gets shorter for the keyboard. Use it as the window's `bottom`. */
export function useLiftAboveKeyboard(box: RefObject<ComponentRef<typeof View> | null>) {
  const [lift, setLift] = useState(0);
  useEffect(() => {
    if (!ANDROID) return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      box.current?.measureInWindow((_x, y, _w, h) => {
        setLift((was) => Math.max(0, y + was + h - e.endCoordinates.screenY));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setLift(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, [box]);
  return lift;
}
