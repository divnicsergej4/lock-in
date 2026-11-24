// Android keeps the panel's inside as a bitmap and its outer shadows on their own view: the shadow list is split
// without breaking the commas inside rgba().
jest.mock('react-native-reanimated', () => ({}));
jest.mock('react-native-svg', () => ({}));
jest.mock('@/theme', () => ({ holo: {}, useTheme: () => ({ name: 'dark' }) }));
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));

import { splitShadows } from '../HoloPanel';

const realHolo = (jest.requireActual('@/theme') as typeof import('@/theme')).holo;

test('inset and outer shadows of both themes', () => {
  for (const name of ['dark', 'light'] as const) {
    const css = realHolo[name].panelShadow;
    const { inset, outer } = splitShadows(css);
    expect(inset.startsWith('inset ')).toBe(true);
    expect(outer.split(', 0 ').length).toBe(2);
    expect([inset, outer].join(', ')).toBe(css);
  }
});
