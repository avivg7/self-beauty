import { fetchPublicListing, statusKey } from '@/lib/public-listings';

type Locale = 'he' | 'ru' | 'en';
const INTL: Record<Locale, string> = { he: 'he-IL', ru: 'ru-RU', en: 'en-GB' };

const root = document.querySelector<HTMLElement>('[data-live-detail]');
if (root) {
  (async () => {
    const locale = (root.dataset.locale ?? 'he') as Locale;
    const strings = JSON.parse(root.dataset.strings ?? '{}') as Record<string, string | undefined>;
    const S = (k: string): string => strings[k] ?? '';
    const statusLabels = JSON.parse(root.dataset.statusLabels ?? '{}') as Record<string, string>;
    const sexLabels = JSON.parse(root.dataset.sexLabels ?? '{}') as Record<string, string>;
    const breedLabels = JSON.parse(root.dataset.breedLabels ?? '{}') as Record<string, string>;
    const loading = root.querySelector<HTMLElement>('[data-live-loading]')!;
    const notFound = root.querySelector<HTMLElement>('[data-live-notfound]')!;
    const error = root.querySelector<HTMLElement>('[data-live-error]')!;
    const content = root.querySelector<HTMLElement>('[data-live-content]')!;
    const show = (el: HTMLElement) => {
      for (const x of [loading, notFound, error, content]) x.hidden = x !== el;
    };
    const q = <T extends Element>(slot: string) => root.querySelector<T>(`[data-slot="${slot}"]`)!;
    const id = new URLSearchParams(location.search).get('id') ?? '';
    if (root.dataset.configured !== '1') {
      show(notFound); // no backend → no listing can exist under this id
      return;
    }
    let l;
    try {
      l = await fetchPublicListing(id);
    } catch {
      show(error);
      return;
    }
    if (!l) {
      show(notFound);
      return;
    }

    const name = l.name[locale] ?? l.name.he ?? '';
    const breed = breedLabels[l.breed] ?? l.breed;
    document.title = `${name} · ${breed} · Self Beauty`;
    const main = l.images[0]!;
    const mainImg = q<HTMLImageElement>('main-img');
    mainImg.src = main.urlLarge;
    mainImg.width = main.width;
    mainImg.height = main.height;
    mainImg.alt = S('imageAlt').replace('{name}', name);
    const mainBtn = q<HTMLButtonElement>('main-btn');
    Object.assign(mainBtn.dataset, {
      lbSrc: main.urlLarge,
      lbW: String(main.width),
      lbH: String(main.height),
      lbAlt: mainImg.alt,
      lbCaption: name,
    });
    mainBtn.setAttribute('aria-label', S('open').replace('{title}', name));
    const thumbs = q<HTMLUListElement>('thumbs');
    for (const im of l.images.slice(1)) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button';
      Object.assign(b.dataset, {
        lbItem: '',
        lbType: 'image',
        lbGroup: 'live-detail',
        lbSrc: im.urlLarge,
        lbW: String(im.width),
        lbH: String(im.height),
        lbAlt: mainImg.alt,
        lbCaption: name,
      });
      b.setAttribute('aria-label', S('open').replace('{title}', name));
      const img = document.createElement('img');
      img.src = im.urlCard;
      img.alt = '';
      img.loading = 'lazy';
      img.width = im.width;
      img.height = im.height;
      b.append(img);
      li.append(b);
      thumbs.append(li);
    }
    const sk = statusKey(l.status);
    const status = q<HTMLElement>('status');
    status.textContent = statusLabels[sk] ?? sk;
    status.className = `chip chip--${sk}`;
    if (l.showProspect) {
      q<HTMLElement>('prospect').hidden = false;
      q<HTMLElement>('prospect-label').textContent = S('showProspect');
    }
    q<HTMLElement>('breed').textContent = breed;
    q<HTMLElement>('name').textContent = name;
    const facts = q<HTMLElement>('facts');
    const fact = (el: HTMLElement, dt: string, dd: string) => {
      const d = document.createElement('div');
      const a = document.createElement('dt');
      a.textContent = dt;
      const b = document.createElement('dd');
      b.textContent = dd;
      d.append(a, b);
      el.append(d);
    };
    fact(facts, S('breed'), breed);
    if (l.sex !== 'unspecified') fact(facts, S('sex'), sexLabels[l.sex] ?? l.sex);
    if (l.birthDate)
      fact(
        facts,
        S('born'),
        new Intl.DateTimeFormat(INTL[locale], { year: 'numeric', month: 'long', day: 'numeric' }).format(
          new Date(l.birthDate + 'T00:00:00'),
        ),
      );
    fact(facts, S('status'), statusLabels[sk] ?? sk);
    q<HTMLElement>('about-h').textContent = S('about');
    q<HTMLElement>('desc').textContent = l.description[locale] ?? l.description.he ?? '';
    if (locale !== 'he' && !l.description[locale] && l.description.he) {
      const n = q<HTMLElement>('note');
      n.textContent = S('hebrewOnly');
      n.hidden = false;
    }
    const ped = l.pedigree[locale] ?? l.pedigree.he;
    if (ped || l.sireName || l.damName) {
      q<HTMLElement>('pedigree-h').hidden = false;
      q<HTMLElement>('pedigree-h').textContent = S('pedigree');
      if (ped) {
        const p = q<HTMLElement>('pedigree');
        p.textContent = ped;
        p.hidden = false;
      }
      if (l.sireName || l.damName) {
        const pr = q<HTMLElement>('parents');
        pr.hidden = false;
        if (l.sireName) fact(pr, S('sire'), l.sireName);
        if (l.damName) fact(pr, S('dam'), l.damName);
      }
    }
    q<HTMLElement>('noprice').textContent = S('noPrice');
    q<HTMLElement>('updated').textContent =
      `${S('updated')}: ${new Intl.DateTimeFormat(INTL[locale], { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(l.updatedAt))}`;
    const wa = q<HTMLAnchorElement>('wa');
    wa.href = `https://wa.me/972546781020?text=${encodeURIComponent(S('wa').replace('{name}', name).replace('{breed}', breed))}`;
    q<HTMLElement>('wa-label').textContent = S('talk');
    show(content);
  })();
}
