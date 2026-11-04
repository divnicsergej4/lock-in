// Expo's Metro setup, plus one change: on iOS and Android, react-native's own index hands out src/textScale/Text.tsx
// and TextInput.tsx instead of its Text and TextInput, so every text in the app (and in the libraries) grows with
// the phone's text size setting only up to a limit. The web uses react-native-web and is not affected.

const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const RN_INDEX = path.join(path.dirname(require.resolve('react-native/package.json')), 'index.js');
const CAPPED = {
  './Libraries/Text/Text': path.join(__dirname, 'src/textScale/Text.tsx'),
  './Libraries/Components/TextInput/TextInput': path.join(__dirname, 'src/textScale/TextInput.tsx'),
};

const next = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (CAPPED[moduleName] && path.normalize(context.originModulePath) === RN_INDEX) {
    return { type: 'sourceFile', filePath: CAPPED[moduleName] };
  }
  return next ? next(context, moduleName, platform) : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
