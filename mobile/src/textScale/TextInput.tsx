// TextInput as everything gets it from 'react-native' on iOS and Android, with the same limit as Text (see Text.tsx).

import { createElement, type ComponentType } from 'react';

import { MAX_FONT_SCALE } from './Text';

// the real TextInput (this file is not redirected, only react-native's index is)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const RNTextInput: ComponentType<Record<string, unknown>> & Record<string, unknown> = require('react-native/Libraries/Components/TextInput/TextInput').default;

// letterSpacing 0 unless the field sets its own: iOS reuses a field's native view, and the placeholder kept the
// letter spacing of the field that used it before ("D e s c r i p t i o n" on Home in the TestFlight build;
// react-native issue 42589)
const NO_KERN = { letterSpacing: 0 };

function TextInput(props: Record<string, unknown>) {
  return createElement(RNTextInput, { maxFontSizeMultiplier: MAX_FONT_SCALE, ...props, style: [NO_KERN, props.style] });
}
// TextInput.State (which input has the focus) and the rest of its statics
Object.assign(TextInput, RNTextInput);
TextInput.displayName = 'TextInput';

export default TextInput;
