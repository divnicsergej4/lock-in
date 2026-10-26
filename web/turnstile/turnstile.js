// Lock In: the Turnstile (CAPTCHA) page the app opens in a WebView before it emails a sign-in code.
// The app passes the public site key in the address (?sitekey=...). The token and anything else that happens
// go back to the app as small JSON messages; the protocol is mobile/src/auth/turnstile.ts (a test checks both).
(function () {
  function post(m) {
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(JSON.stringify(m));
  }

  var key = new URLSearchParams(window.location.search).get('sitekey') || '';
  if (!/^[0-9A-Za-z_-]{10,64}$/.test(key)) {
    post({ type: 'error', code: 'bad-sitekey' });
    return;
  }

  window.lockinTurnstileReady = function () {
    window.turnstile.render('#w', {
      sitekey: key,
      appearance: 'interaction-only',
      theme: 'auto',
      'refresh-expired': 'never',
      callback: function (t) { post({ type: 'token', token: t }); },
      'error-callback': function (c) { post({ type: 'error', code: String(c || 'error') }); return true; },
      'expired-callback': function () { post({ type: 'error', code: 'expired' }); },
      'timeout-callback': function () { post({ type: 'error', code: 'timeout' }); },
      'unsupported-callback': function () { post({ type: 'error', code: 'unsupported' }); },
      'before-interactive-callback': function () { post({ type: 'show' }); },
      'after-interactive-callback': function () { post({ type: 'hide' }); }
    });
  };

  var s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=lockinTurnstileReady';
  s.async = true;
  s.onerror = function () { post({ type: 'error', code: 'load' }); };
  document.head.appendChild(s);
})();
