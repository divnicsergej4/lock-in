// Runs Lock In's Turnstile page (https://<DOMAIN>/turnstile/, folder web/turnstile) in a WebView while "Send code"
// waits for a token (see src/auth/turnstile.ts). Normally nothing shows; if Cloudflare wants a click, the widget
// appears in place with a short line above it. The WebView may only open that page and Cloudflare's challenge.

import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { captchaBroker, captchaOn, TURNSTILE_HOSTNAME, TURNSTILE_SITE_KEY } from '@/auth/captcha';
import { allowedInTurnstile, parseMessage, turnstilePageUrl, type BrokerState } from '@/auth/turnstile';
import { Small } from '@/components/home/Section';

export function TurnstileHost() {
  const [st, setSt] = useState<BrokerState>({ running: false, visible: false, run: 0 });
  useEffect(() => captchaBroker.subscribe(setSt), []);
  const on = captchaOn();
  const host = TURNSTILE_HOSTNAME!;
  const uri = useMemo(() => (on ? turnstilePageUrl(host, TURNSTILE_SITE_KEY!) : ''), [on, host]);
  if (!on || !st.running) return null;

  return (
    <View style={st.visible ? s.shown : s.hidden} pointerEvents={st.visible ? 'auto' : 'none'}>
      {st.visible && <Small style={{ marginBottom: 6 }}>Quick check that you’re human:</Small>}
      <WebView
        key={st.run} // a new challenge for every send: a token works only once
        source={{ uri }}
        originWhitelist={[`https://${host}`, 'https://challenges.cloudflare.com', 'about:blank', 'about:srcdoc']}
        onShouldStartLoadWithRequest={(r) => allowedInTurnstile(r.url, host)}
        onMessage={(e: WebViewMessageEvent) => captchaBroker.handle(parseMessage(e.nativeEvent.data))}
        onError={() => captchaBroker.fail('load')}
        onHttpError={() => captchaBroker.fail('load')}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        setSupportMultipleWindows={false}
        scrollEnabled={false}
        style={{ backgroundColor: 'transparent' }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  // Still on screen (1 px, see-through) while hidden, so both phones keep running the page.
  hidden: { height: 1, opacity: 0.01, overflow: 'hidden' },
  shown: { height: 100, marginTop: 14 },
});
