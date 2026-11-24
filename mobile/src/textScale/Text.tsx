// Text as everything gets it from 'react-native' on iOS and Android (metro.config.js hands this file to react-native's
// own index): the phone's text size setting enlarges the app's text by at most MAX_FONT_SCALE. The screens are drawn
// to exact sizes, and a phone with its text set about 30% larger pushed the intro off the screen (Andrija's test on a
// third Android phone, 4 Nov 2026).

import { createElement, type ComponentType } from 'react';

// the real Text (this file is not redirected, only react-native's index is)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNText: ComponentType<Record<string, unknown>> = require('react-native/Libraries/Text/Text').default;

/** How much larger than designed the phone's text size setting may make the app's text. */
export const MAX_FONT_SCALE = 1.15;

function Text(props: Record<string, unknown>) {
  return createElement(RNText, { maxFontSizeMultiplier: MAX_FONT_SCALE, ...props });
}
Text.displayName = 'Text';

export default Text;
