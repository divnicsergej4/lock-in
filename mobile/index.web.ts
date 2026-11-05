// App entry on the web (used only to look at screens in a browser while developing).
// Skia needs CanvasKit (public/canvaskit.wasm, copied by "npx setup-skia-web public") before any
// Skia code is loaded, so the app starts after it.
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

LoadSkiaWeb({ locateFile: (file: string) => '/' + file }).then(() => require('expo-router/entry'));
