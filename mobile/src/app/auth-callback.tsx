// Google sign-in comes back to lockin://auth-callback. The sign-in screen already reads the code from the
// browser sheet; on Android the same link can also open this route, so it only steps back out of the way.

import { router } from 'expo-router';
import { useEffect } from 'react';

export default function AuthCallback() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
