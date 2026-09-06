import type { ComponentChildren } from 'preact';
import { useT } from './i18n';
import { useApp, routeHref, type Route } from './context';
import type { Locale } from '@/i18n';

export function Shell({
  route,
  locale,
  onLocale,
  onLogout,
  children,
}: {
  route: Route;
  locale: Locale;
  onLocale: (l: Locale) => void;
  onLogout: () => void;
  children: ComponentChildren;
}) {
  const { ui } = useT();
  const { siteHref } = useApp();
  const inList = route.name === 'list' || route.name === 'new' || route.name === 'edit';
  return (
    <div class="adm">
      <header class="adm-header">
        <div class="adm-header__row">
          <a class="adm-brand" href="#/">
            {ui.appName}
          </a>
          <div class="adm-header__tools">
            <label class="sr-only" for="adm-lang">
              Language
            </label>
            <select
              id="adm-lang"
              class="adm-select adm-select--sm"
              value={locale}
              onChange={(e) => onLocale((e.currentTarget as HTMLSelectElement).value as Locale)}
            >
              <option value="he">עברית</option>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
            <a class="adm-link" href={siteHref} target="_blank" rel="noopener">
              {ui.nav.backToSite}
            </a>
            <button type="button" class="adm-link adm-link--btn" onClick={onLogout}>
              {ui.nav.logout}
            </button>
          </div>
        </div>
        <nav class="adm-tabs" aria-label={ui.title}>
          <a class="adm-tab" aria-current={inList ? 'page' : undefined} href={routeHref({ name: 'list' })}>
            {ui.nav.listings}
          </a>
          <a
            class="adm-tab"
            aria-current={route.name === 'archive' ? 'page' : undefined}
            href={routeHref({ name: 'archive' })}
          >
            {ui.nav.archive}
          </a>
        </nav>
      </header>
      <main class="adm-main" id="main">
        {children}
      </main>
    </div>
  );
}
