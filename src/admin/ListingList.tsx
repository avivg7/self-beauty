import { useEffect, useState } from 'preact/hooks';
import { listListings, previewUrl, ApiError, type Listing } from './api';
import { useT } from './i18n';
import { useApp, routeHref } from './context';
import { StatusSheet } from './StatusSheet';
import { statusKey } from '@/lib/public-listings';

type Filter = 'all' | 'published' | 'drafts';

export function ListingList({ archived }: { archived: boolean }) {
  const { ui, dict, fmt, locale } = useT();
  const { onAuthError, toast } = useApp();
  const [state, setState] = useState<
    { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: Listing[] }
  >({ kind: 'loading' });
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [sheet, setSheet] = useState<Listing | null>(null);

  const load = async () => {
    setState({ kind: 'loading' });
    try {
      const items = await listListings(archived);
      setState({ kind: 'ready', items });
      const entries = await Promise.all(
        items.map(async (l) => {
          const first = l.listing_images[0];
          return [l.id, first ? await previewUrl(l.id, first.id).catch(() => null) : null] as const;
        }),
      );
      setThumbs(Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1])));
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
      setState({ kind: 'error' });
    }
  };
  useEffect(() => {
    void load();
  }, [archived]);

  const fmtDate = new Intl.DateTimeFormat(locale === 'he' ? 'he-IL' : locale === 'ru' ? 'ru-RU' : 'en-GB', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <section class="adm-list" data-admin-list>
      <div class="adm-list__head">
        <h1 class="adm-h1">{archived ? ui.nav.archive : ui.list.title}</h1>
        {!archived && (
          <a class="btn btn--primary" href={routeHref({ name: 'new' })} data-add-listing>
            {ui.list.add}
          </a>
        )}
      </div>
      {!archived && (
        <div class="adm-filters" role="group" aria-label={ui.list.filters.all}>
          {(['all', 'published', 'drafts'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              class="chip adm-filter"
              aria-pressed={filter === f}
              onClick={() => setFilter(f)}
            >
              {ui.list.filters[f]}
            </button>
          ))}
        </div>
      )}
      {state.kind === 'loading' && (
        <p class="muted" aria-busy="true">
          {ui.list.loading}
        </p>
      )}
      {state.kind === 'error' && (
        <div class="adm-empty" role="status">
          <p>{ui.list.loadFailed}</p>
          <button type="button" class="btn btn--secondary" onClick={() => void load()}>
            {ui.list.retry}
          </button>
        </div>
      )}
      {state.kind === 'ready' &&
        (() => {
          const items = state.items.filter(
            (l) => filter === 'all' || (filter === 'published' ? l.published : !l.published),
          );
          if (!items.length)
            return (
              <div class="adm-empty">
                <p>{archived ? ui.list.emptyArchive : ui.list.empty}</p>
              </div>
            );
          return (
            <ul role="list" class="adm-rows">
              {items.map((l) => {
                const sk = statusKey(l.status);
                return (
                  <li key={l.id} class="adm-row" data-listing-row>
                    <a class="adm-row__main" href={routeHref({ name: 'edit', id: l.id })}>
                      <span class="adm-row__thumb">
                        {thumbs[l.id] ? (
                          <img src={thumbs[l.id]} alt="" width="64" height="80" />
                        ) : (
                          <span class="adm-row__nothumb">{ui.list.noPhoto}</span>
                        )}
                      </span>
                      <span class="adm-row__text">
                        <span class="adm-row__name">{l.name_he}</span>
                        <span class="adm-row__meta">
                          {dict.breeds[l.breed].short} ·{' '}
                          {fmt(ui.list.photos, { count: l.listing_images.length })}
                        </span>
                        <span class="adm-row__meta">
                          <span class={`chip chip--${sk}`}>{dict.status[sk]}</span>
                          <span class={`adm-pub ${l.published ? 'adm-pub--on' : ''}`}>
                            {archived
                              ? ui.list.archived
                              : l.published
                                ? ui.list.published
                                : ui.list.unpublished}
                          </span>
                        </span>
                        <span class="adm-row__meta muted">
                          {ui.list.updated} {fmtDate.format(new Date(l.updated_at))}
                        </span>
                      </span>
                    </a>
                    <button
                      type="button"
                      class="btn btn--ghost btn--sm adm-row__action"
                      onClick={() => setSheet(l)}
                      aria-label={`${ui.list.changeStatus}: ${l.name_he}`}
                    >
                      {ui.list.changeStatus}
                    </button>
                  </li>
                );
              })}
            </ul>
          );
        })()}
      {sheet && (
        <StatusSheet
          listing={sheet}
          onClose={() => setSheet(null)}
          onChanged={(updated, message) => {
            setSheet(null);
            if (message) toast(message.text, message.kind);
            if (state.kind === 'ready') {
              const items =
                updated && updated.archived_at === null && !archived
                  ? state.items.map((x) => (x.id === updated.id ? updated : x))
                  : state.items.filter((x) => x.id !== sheet.id);
              if (updated && !!updated.archived_at === archived)
                setState({
                  kind: 'ready',
                  items: state.items.map((x) => (x.id === updated.id ? updated : x)),
                });
              else setState({ kind: 'ready', items });
            }
          }}
        />
      )}
    </section>
  );
}
