import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Session } from '@supabase/supabase-js';
import { supabase, configured } from './client';
import { I18nContext, makeI18n, loadLocale, storeLocale } from './i18n';
import { AppContext, parseRoute, type Route } from './context';
import { Login } from './Login';
import { Shell } from './Shell';
import { ListingList } from './ListingList';
import { ListingForm } from './ListingForm';
import { Toasts, useToasts } from './Toast';
import type { Locale } from '@/i18n';

type Auth =
  | { kind: 'loading' }
  | { kind: 'out'; message?: 'unavailable' | 'expired' | 'notAdmin' }
  | { kind: 'in'; session: Session };

export default function App({ siteHref }: { siteHref: string }) {
  const [locale, setLocale] = useState<Locale>(loadLocale);
  const i18n = useMemo(() => makeI18n(locale), [locale]);
  const [auth, setAuth] = useState<Auth>({ kind: 'loading' });
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  const toasts = useToasts();

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === 'he' ? 'rtl' : 'ltr';
    document.title = i18n.ui.title;
    storeLocale(locale);
  }, [locale, i18n]);

  useEffect(() => {
    const h = () => {
      setRoute(parseRoute(location.hash));
      window.scrollTo(0, 0);
    };
    addEventListener('hashchange', h);
    return () => removeEventListener('hashchange', h);
  }, []);

  const verify = async (session: Session) => {
    const { data, error } = await supabase.rpc('is_admin');
    if (error) {
      await supabase.auth.signOut().catch(() => {});
      setAuth({ kind: 'out', message: 'unavailable' });
      return;
    }
    if (data !== true) {
      await supabase.auth.signOut().catch(() => {});
      setAuth({ kind: 'out', message: 'notAdmin' });
      return;
    }
    setAuth({ kind: 'in', session });
  };

  useEffect(() => {
    if (!configured) {
      setAuth({ kind: 'out', message: 'unavailable' });
      return;
    }
    let alive = true;
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!alive) return;
        if (data.session) void verify(data.session);
        else setAuth({ kind: 'out' });
      })
      .catch(() => alive && setAuth({ kind: 'out', message: 'unavailable' }));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setAuth((a) => (a.kind === 'out' ? a : { kind: 'out' }));
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    await supabase.auth.signOut().catch(() => {});
    setAuth({ kind: 'out' });
    location.hash = '#/';
  };
  const onAuthError = () => {
    void supabase.auth.signOut().catch(() => {});
    setAuth({ kind: 'out', message: 'expired' });
  };
  const api = useMemo(() => ({ toast: toasts.push, onAuthError, siteHref }), [toasts.push, siteHref]);

  return (
    <I18nContext.Provider value={i18n}>
      <AppContext.Provider value={api}>
        {auth.kind === 'loading' && (
          <p class="adm-loading muted" aria-busy="true">
            {i18n.ui.list.loading}
          </p>
        )}
        {auth.kind === 'out' && (
          <Login {...(auth.message ? { message: auth.message } : {})} onSignedIn={(s) => void verify(s)} />
        )}
        {auth.kind === 'in' && (
          <Shell route={route} locale={locale} onLocale={setLocale} onLogout={() => void logout()}>
            {route.name === 'list' && <ListingList archived={false} />}
            {route.name === 'archive' && <ListingList archived={true} />}
            {route.name === 'new' && <ListingForm />}
            {route.name === 'edit' && <ListingForm key={route.id} id={route.id} />}
          </Shell>
        )}
        <Toasts items={toasts.items} dismiss={toasts.dismiss} closeLabel={i18n.ui.form.close} />
      </AppContext.Provider>
    </I18nContext.Provider>
  );
}
