import { useState } from 'preact/hooks';
import { supabase, configured } from './client';
import { useT } from './i18n';
import type { Session } from '@supabase/supabase-js';

export function Login({
  message,
  onSignedIn,
}: {
  message?: 'unavailable' | 'expired' | 'notAdmin' | undefined;
  onSignedIn: (s: Session) => void;
}) {
  const { ui } = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>(message ? ui.login[message] : '');

  const submit = async (e: Event) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!configured) {
      setError(ui.login.unavailable);
      return;
    }
    setBusy(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (err) {
        // Generic message for bad credentials; connectivity/outage gets the "try later" message.
        const bad = err.status === 400 || /invalid login credentials|invalid_credentials/i.test(err.message);
        setError(bad ? ui.login.failed : ui.login.unavailable);
        return;
      }
      if (data.session) onSignedIn(data.session);
    } catch {
      setError(ui.login.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main class="adm-login">
      <form class="adm-login__card" onSubmit={submit} noValidate>
        <p class="adm-brand">Self Beauty</p>
        <h1 class="adm-login__title">{ui.login.title}</h1>
        <div class="adm-field">
          <label class="adm-label" for="adm-email">
            {ui.login.email}
          </label>
          <input
            id="adm-email"
            class="adm-input"
            type="email"
            name="email"
            autocomplete="username"
            inputMode="email"
            dir="ltr"
            required
            value={email}
            onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)}
          />
        </div>
        <div class="adm-field">
          <label class="adm-label" for="adm-password">
            {ui.login.password}
          </label>
          <span class="adm-input-wrap">
            <input
              id="adm-password"
              class="adm-input"
              type={show ? 'text' : 'password'}
              name="password"
              autocomplete="current-password"
              dir="ltr"
              required
              minLength={12}
              value={password}
              onInput={(e) => setPassword((e.currentTarget as HTMLInputElement).value)}
            />
            <button
              type="button"
              class="adm-input__toggle"
              aria-pressed={show}
              onClick={() => setShow((v) => !v)}
            >
              {show ? ui.login.hide : ui.login.show}
            </button>
          </span>
        </div>
        {error && (
          <p class="adm-error" role="alert" data-login-error>
            {error}
          </p>
        )}
        <button
          type="submit"
          class="btn btn--primary btn--lg adm-login__submit"
          disabled={busy}
          aria-busy={busy}
        >
          {busy ? ui.login.submitting : ui.login.submit}
        </button>
        <p class="adm-hint">{ui.login.forgot}</p>
      </form>
    </main>
  );
}
