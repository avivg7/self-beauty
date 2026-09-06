import { fetchPublicListings, statusKey, type PublicListing } from '@/lib/public-listings';

type Locale = 'he' | 'ru' | 'en';
const INTL: Record<Locale, string> = { he: 'he-IL', ru: 'ru-RU', en: 'en-GB' };

function ageLabel(locale: Locale, birthDate: string): string {
  const ms = Date.now() - new Date(birthDate + 'T00:00:00').getTime();
  if (!(ms > 0)) return '';
  const days = Math.floor(ms / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(INTL[locale], { numeric: 'always' });
  const fmt = (n: number, unit: Intl.RelativeTimeFormatUnit) =>
    rtf.format(-n, unit).replace(/^[^\d]*?(\d)/, '$1');
  if (days < 7 * 16) return fmt(Math.max(1, Math.floor(days / 7)), 'week');
  const months = Math.floor(days / 30.4375);
  if (months < 12) return fmt(months, 'month');
  return fmt(Math.floor(months / 12), 'year');
}

document.querySelectorAll<HTMLElement>('[data-live-puppies]').forEach(async (root) => {
  const locale = (root.dataset.locale ?? 'he') as Locale;
  const limit = Number(root.dataset.limit) || 0;
  const detailBase = root.dataset.detailBase ?? '';
  const statusLabels = JSON.parse(root.dataset.statusLabels ?? '{}') as Record<string, string>;
  const sexLabels = JSON.parse(root.dataset.sexLabels ?? '{}') as Record<string, string>;
  const breedLabels = JSON.parse(root.dataset.breedLabels ?? '{}') as Record<string, string>;
  const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string | undefined>;
  const S = (k: string): string => strings[k] ?? '';
  const skeleton = root.querySelector<HTMLElement>('[data-live-skeleton]')!;
  const list = root.querySelector<HTMLUListElement>('[data-live-list]')!;
  const empty = root.querySelector<HTMLElement>('[data-live-empty]')!;
  const error = root.querySelector<HTMLElement>('[data-live-error]')!;
  const tpl = root.querySelector<HTMLTemplateElement>('[data-live-card]')!;

  const show = (el: HTMLElement | null) => {
    for (const x of [skeleton, list, empty, error]) x.hidden = x !== el;
  };

  if (root.dataset.configured !== '1') {
    show(error);
    return;
  }

  let listings: PublicListing[];
  try {
    listings = await fetchPublicListings();
  } catch {
    show(error);
    return;
  }
  if (limit) listings = listings.slice(0, limit);
  if (!listings.length) {
    show(empty);
    return;
  }

  const dateFmt = new Intl.DateTimeFormat(INTL[locale], { year: 'numeric', month: 'long', day: 'numeric' });
  for (const l of listings) {
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    const li = frag.querySelector('li')!;
    li.dataset.breed = l.breed;
    const q = <T extends Element>(slot: string) => frag.querySelector<T>(`[data-slot="${slot}"]`)!;
    const name = l.name[locale] ?? l.name.he ?? '';
    const breed = breedLabels[l.breed] ?? l.breed;
    const detail = `${detailBase}?id=${encodeURIComponent(l.id)}`;
    const img = l.images[0]!;
    const imgEl = q<HTMLImageElement>('img');
    imgEl.src = img.urlCard;
    imgEl.srcset = `${img.urlCard} 640w, ${img.urlLarge} 1600w`;
    imgEl.sizes = '(min-width: 64rem) 380px, (min-width: 40rem) 50vw, 100vw';
    imgEl.width = img.width;
    imgEl.height = img.height;
    imgEl.alt = '';
    imgEl.addEventListener('error', () => {
      imgEl.removeAttribute('srcset');
      imgEl.style.visibility = 'hidden';
    });
    q<HTMLAnchorElement>('link').href = detail;
    const sk = statusKey(l.status);
    const status = q<HTMLElement>('status');
    status.textContent = statusLabels[sk] ?? sk;
    status.className = `chip chip--${sk}`;
    q<HTMLElement>('sr-status').textContent = `${S('statusLabel')} ${statusLabels[sk] ?? sk}`.trim();
    q<HTMLElement>('breed').textContent = breed;
    const title = q<HTMLAnchorElement>('title-link');
    title.textContent = name;
    title.href = detail;
    const facts = q<HTMLElement>('facts');
    const fact = (dt: string, dd: string) => {
      const d = document.createElement('div');
      const a = document.createElement('dt');
      a.textContent = dt;
      const b = document.createElement('dd');
      b.textContent = dd;
      d.append(a, b);
      facts.append(d);
    };
    if (l.sex !== 'unspecified') fact(S('sex'), sexLabels[l.sex] ?? l.sex);
    if (l.birthDate) {
      const a = ageLabel(locale, l.birthDate);
      if (a) fact(S('age'), a);
    }
    if (l.showProspect) {
      const d = document.createElement('div');
      d.className = 'pcard__flag';
      const dd = document.createElement('dd');
      dd.textContent = S('showProspect');
      d.append(dd);
      facts.append(d);
    }
    const desc = l.description[locale] ?? l.description.he ?? '';
    q<HTMLElement>('desc').textContent = desc;
    const note = q<HTMLElement>('note');
    if (locale !== 'he' && !l.description[locale] && l.description.he) {
      note.textContent = S('hebrewOnly');
      note.hidden = false;
    }
    q<HTMLElement>('updated').textContent = `${S('updated')}: ${dateFmt.format(new Date(l.updatedAt))}`;
    const wa = q<HTMLAnchorElement>('wa');
    const msg = S('wa').replace('{name}', name).replace('{breed}', breed);
    wa.href = `https://wa.me/972546781020?text=${encodeURIComponent(msg)}`;
    q<HTMLElement>('wa-label').textContent = S('talk');
    const det = q<HTMLAnchorElement>('details');
    det.href = detail;
    q<HTMLElement>('details-label').textContent = S('details');
    list.append(frag);
  }
  list.dataset.count = String(listings.length);
  show(list);
});
