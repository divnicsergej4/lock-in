// TextInput as everything gets it from 'react-native' on iOS and Android, with the same limit as Text (see Text.tsx).

import { createElement, type ComponentType } from 'react';

import { MAX_FONT_SCALE } from './Text';

// the real TextInput (this file is not redirected, only react-native's index is)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNTextInput: ComponentType<Record<string, unknown>> & Record<string, unknown> = require('react-native/Libraries/Components/TextInput/TextInput').default;

function TextInput(props: Record<string, unknown>) {
  return createElement(RNTextInput, { maxFontSizeMultiplier: MAX_FONT_SCALE, ...props });
}
// TextInput.State (which input has the focus) and the rest of its statics
Object.assign(TextInput, RNTextInput);
TextInput.displayName = 'TextInput';

export default TextInput;
