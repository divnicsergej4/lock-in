// "Get notified at launch": sends the email to the launch list (Supabase RPC join_waitlist, migration 0008).
// Only the publishable key is used: it can call this one function and read nothing (see the migration).
// ?from=instagram in the link is kept as where the person came from.
(function () {
  var URL_RPC = 'https://jezdcanghhdnwnnnntzh.supabase.co/rest/v1/rpc/join_waitlist';
  var KEY = 'sb_publishable_N8vq9RJE2Ra0FFsFSdAkfQ_NOLqI5OK';
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

  var form = document.getElementById('join');
  if (!form) return;
  var input = document.getElementById('join-email');
  var button = form.querySelector('button');
  var msg = document.getElementById('join-msg');

  function source() {
    var m = /[?&](?:from|utm_source)=([a-z0-9_-]{1,30})/i.exec(location.search);
    return m ? m[1].toLowerCase() : null;
  }
  function say(text, kind) {
    msg.textContent = text;
    msg.className = 'msg' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = input.value.trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) {
      say('Enter a valid email address.', 'bad');
      input.focus();
      return;
    }
    if (form.elements.website.value) {
      // a bot filled the hidden field: answer as if it worked, store nothing
      say("You're on the list. We'll email you once, the day Lock In is out.", 'good');
      form.reset();
      return;
    }
    button.disabled = true;
    say('Saving…');
    fetch(URL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify({ email: email, source: source() }),
    })
      .then(function (r) {
        if (r.ok) {
          say("You're on the list. We'll email you once, the day Lock In is out.", 'good');
          form.reset();
          return;
        }
        return r.json().then(
          function (b) {
            var known = b && (b.hint === 'invalid' || b.hint === 'rate_limited');
            say(known ? b.message : 'Something went wrong. Try again in a moment.', 'bad');
          },
          function () {
            say('Something went wrong. Try again in a moment.', 'bad');
          }
        );
      })
      .catch(function () {
        say('Couldn’t reach the server. Check your connection and try again.', 'bad');
      })
      .then(function () {
        button.disabled = false;
      });
  });
})();
