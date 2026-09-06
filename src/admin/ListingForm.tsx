import { useEffect, useState } from 'preact/hooks';
import {
  createListing,
  getListing,
  publishListing,
  unpublishListing,
  updateListing,
  ApiError,
  BREEDS,
  STATUSES,
  type Listing,
  type ListingInput,
} from './api';
import { useT } from './i18n';
import { useApp, navigate, routeHref } from './context';
import { PhotoManager } from './PhotoManager';
import { StatusSheet } from './StatusSheet';
import { statusKey } from '@/lib/public-listings';

const LIMITS = { name: 80, description: 1500, pedigree: 600, parent: 80, note: 2000 } as const;

const blank = (): ListingInput => ({
  breed: 'bichon',
  sex: 'unspecified',
  birth_date: null,
  status: 'available',
  featured: false,
  sort_order: 100,
  name_he: '',
  name_ru: null,
  name_en: null,
  description_he: '',
  description_ru: null,
  description_en: null,
  pedigree_he: null,
  pedigree_ru: null,
  pedigree_en: null,
  sire_name: null,
  dam_name: null,
  show_prospect: false,
  internal_note: null,
});
const toInput = (l: Listing): ListingInput => {
  const {
    id: _id,
    created_at: _c,
    updated_at: _u,
    published: _p,
    archived_at: _a,
    listing_images: _i,
    ...rest
  } = l;
  return rest;
};
const nul = (v: string) => (v.trim() ? v : null);

export function ListingForm({ id }: { id?: string | undefined }) {
  const { ui, dict } = useT();
  const { toast, onAuthError } = useApp();
  const [listing, setListing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState<ListingInput>(blank());
  const [loading, setLoading] = useState(!!id);
  const [notFound, setNotFound] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'save' | 'publish' | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [sheet, setSheet] = useState(false);
  const [showTranslations, setShowTranslations] = useState(false);

  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      try {
        const l = await getListing(id);
        if (!alive) return;
        if (!l) {
          setNotFound(true);
          return;
        }
        setListing(l);
        setDraft(toInput(l));
        setShowTranslations(!!(l.name_ru || l.name_en || l.description_ru || l.description_en));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
        setFormError(ui.list.loadFailed);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
      }
    };
    addEventListener('beforeunload', h);
    return () => removeEventListener('beforeunload', h);
  }, [dirty]);

  const set = <K extends keyof ListingInput>(k: K, v: ListingInput[K]) => {
    setDraft((d) => ({ ...d, [k]: v }));
    setDirty(true);
  };
  const text = (k: keyof ListingInput, max: number, nullable: boolean) => ({
    value: (draft[k] as string | null) ?? '',
    maxLength: max,
    onInput: (e: Event) => {
      const v = (e.currentTarget as HTMLInputElement | HTMLTextAreaElement).value;
      set(k, (nullable ? nul(v) : v) as ListingInput[typeof k]);
    },
  });

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!draft.name_he.trim()) errs.name_he = ui.form.required;
    if (draft.name_he.length > LIMITS.name) errs.name_he = ui.form.tooLong;
    if (draft.description_he.length > LIMITS.description) errs.description_he = ui.form.tooLong;
    setErrors(errs);
    return !Object.keys(errs).length;
  };

  const save = async (): Promise<Listing | null> => {
    if (!validate()) return null;
    setBusy('save');
    setFormError('');
    try {
      const saved = listing ? await updateListing(listing.id, draft) : await createListing(draft);
      const merged = listing ? { ...saved, listing_images: listing.listing_images } : saved;
      setListing(merged);
      setDraft(toInput(merged));
      setDirty(false);
      if (!listing) navigate({ name: 'edit', id: saved.id });
      toast(ui.form.saved, 'ok');
      return merged;
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') {
        onAuthError();
        return null;
      }
      setFormError(ui.form.saveFailed);
      return null;
    } finally {
      setBusy(null);
    }
  };

  const publish = async () => {
    let l = listing;
    if (dirty || !l) {
      l = await save();
      if (!l) return;
    }
    if (!l.listing_images.length) {
      setFormError(ui.form.publishNeedsPhoto);
      return;
    }
    setBusy('publish');
    setFormError('');
    try {
      const updated = await publishListing(l);
      setListing({ ...updated, listing_images: l.listing_images });
      toast(ui.form.publishedOk, 'ok');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
      const code = e instanceof ApiError ? e.code : '';
      setFormError(
        code === 'NO_IMAGE'
          ? ui.form.publishNeedsPhoto
          : code === 'MISSING_HEBREW_TEXT'
            ? ui.form.publishNeedsText
            : ui.form.publishFailed,
      );
    } finally {
      setBusy(null);
    }
  };
  const unpublish = async () => {
    if (!listing) return;
    setBusy('publish');
    setFormError('');
    try {
      const r = await unpublishListing(listing);
      setListing({ ...r.listing, listing_images: listing.listing_images });
      toast(
        r.cleanupFailed ? ui.form.unpublishCleanupFailed : ui.form.unpublishedOk,
        r.cleanupFailed ? 'error' : 'ok',
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
      setFormError(ui.form.saveFailed);
    } finally {
      setBusy(null);
    }
  };
  const back = (e: Event) => {
    if (dirty && !window.confirm(ui.form.unsaved)) e.preventDefault();
  };

  if (loading)
    return (
      <p class="muted" aria-busy="true">
        {ui.list.loading}
      </p>
    );
  if (notFound)
    return (
      <div class="adm-empty">
        <p>{ui.list.loadFailed}</p>
        <a class="btn btn--secondary" href={routeHref({ name: 'list' })}>
          {ui.nav.back}
        </a>
      </div>
    );
  const locked = !!busy;
  const sk = statusKey(draft.status);

  return (
    <form
      class="adm-form"
      data-listing-form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      noValidate
    >
      <div class="adm-form__head">
        <a class="adm-link" href={routeHref({ name: 'list' })} onClick={back}>
          ‹ {ui.nav.back}
        </a>
        <h1 class="adm-h1">{listing ? ui.form.editTitle : ui.form.newTitle}</h1>
        {listing && (
          <p class="adm-form__state">
            <span class={`chip chip--${sk}`}>{dict.status[sk]}</span>
            <span class={`adm-pub ${listing.published ? 'adm-pub--on' : ''}`}>
              {listing.published ? ui.list.published : ui.list.unpublished}
            </span>
          </p>
        )}
      </div>

      <fieldset class="adm-fieldset" disabled={locked}>
        <legend class="adm-legend">{ui.form.basics}</legend>
        <label class="adm-field">
          <span class="adm-label">{ui.form.nameHe} *</span>
          <input
            class="adm-input"
            type="text"
            name="name_he"
            required
            {...text('name_he', LIMITS.name, false)}
            aria-invalid={!!errors.name_he}
            aria-describedby="name-hint"
          />
          <span id="name-hint" class="adm-hint">
            {errors.name_he ? <span class="adm-error">{errors.name_he}</span> : ui.form.nameHint}
          </span>
        </label>
        <div class="adm-grid2">
          <label class="adm-field">
            <span class="adm-label">{ui.form.breed}</span>
            <select
              class="adm-select"
              name="breed"
              value={draft.breed}
              onChange={(e) =>
                set('breed', (e.currentTarget as HTMLSelectElement).value as ListingInput['breed'])
              }
            >
              {BREEDS.map((b) => (
                <option key={b} value={b}>
                  {dict.breeds[b].name}
                </option>
              ))}
            </select>
          </label>
          <label class="adm-field">
            <span class="adm-label">{ui.form.sex}</span>
            <select
              class="adm-select"
              name="sex"
              value={draft.sex}
              onChange={(e) =>
                set('sex', (e.currentTarget as HTMLSelectElement).value as ListingInput['sex'])
              }
            >
              <option value="unspecified">{ui.form.sexUnspecified}</option>
              <option value="female">{dict.sex.female}</option>
              <option value="male">{dict.sex.male}</option>
            </select>
          </label>
          <label class="adm-field">
            <span class="adm-label">{ui.form.birthDate}</span>
            <input
              class="adm-input"
              type="date"
              name="birth_date"
              value={draft.birth_date ?? ''}
              max={new Date().toISOString().slice(0, 10)}
              onInput={(e) => set('birth_date', nul((e.currentTarget as HTMLInputElement).value))}
            />
            <span class="adm-hint">{ui.form.birthDateHint}</span>
          </label>
          <label class="adm-field">
            <span class="adm-label">{ui.form.status}</span>
            <select
              class="adm-select"
              name="status"
              value={draft.status}
              onChange={(e) =>
                set('status', (e.currentTarget as HTMLSelectElement).value as ListingInput['status'])
              }
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {dict.status[statusKey(s)]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label class="adm-check">
          <input
            type="checkbox"
            checked={draft.show_prospect}
            onChange={(e) => set('show_prospect', (e.currentTarget as HTMLInputElement).checked)}
          />{' '}
          <span>{ui.form.showProspect}</span>
        </label>
        <label class="adm-check">
          <input
            type="checkbox"
            checked={draft.featured}
            onChange={(e) => set('featured', (e.currentTarget as HTMLInputElement).checked)}
          />{' '}
          <span>{ui.form.featured}</span>
        </label>
        <label class="adm-field">
          <span class="adm-label">{ui.form.descriptionHe}</span>
          <textarea
            class="adm-textarea"
            name="description_he"
            rows={5}
            {...text('description_he', LIMITS.description, false)}
            aria-invalid={!!errors.description_he}
          />
          {errors.description_he && <span class="adm-error">{errors.description_he}</span>}
        </label>
        <label class="adm-field">
          <span class="adm-label">{ui.form.pedigreeHe}</span>
          <textarea
            class="adm-textarea"
            name="pedigree_he"
            rows={3}
            {...text('pedigree_he', LIMITS.pedigree, true)}
          />
        </label>
        <div class="adm-grid2">
          <label class="adm-field">
            <span class="adm-label">{ui.form.sire}</span>
            <input
              class="adm-input"
              type="text"
              name="sire_name"
              {...text('sire_name', LIMITS.parent, true)}
            />
          </label>
          <label class="adm-field">
            <span class="adm-label">{ui.form.dam}</span>
            <input class="adm-input" type="text" name="dam_name" {...text('dam_name', LIMITS.parent, true)} />
          </label>
        </div>
      </fieldset>

      <fieldset class="adm-fieldset" disabled={locked}>
        <legend class="adm-legend">{ui.form.translations}</legend>
        <p class="adm-hint">{ui.form.translationsHint}</p>
        {!showTranslations ? (
          <button type="button" class="btn btn--ghost btn--sm" onClick={() => setShowTranslations(true)}>
            {ui.form.translations} +
          </button>
        ) : (
          <div class="adm-grid2">
            <label class="adm-field">
              <span class="adm-label">{ui.form.nameRu}</span>
              <input class="adm-input" type="text" name="name_ru" {...text('name_ru', LIMITS.name, true)} />
            </label>
            <label class="adm-field">
              <span class="adm-label">{ui.form.nameEn}</span>
              <input
                class="adm-input"
                type="text"
                name="name_en"
                dir="ltr"
                {...text('name_en', LIMITS.name, true)}
              />
            </label>
            <label class="adm-field">
              <span class="adm-label">{ui.form.descriptionRu}</span>
              <textarea
                class="adm-textarea"
                name="description_ru"
                rows={4}
                {...text('description_ru', LIMITS.description, true)}
              />
            </label>
            <label class="adm-field">
              <span class="adm-label">{ui.form.descriptionEn}</span>
              <textarea
                class="adm-textarea"
                name="description_en"
                dir="ltr"
                rows={4}
                {...text('description_en', LIMITS.description, true)}
              />
            </label>
            <label class="adm-field">
              <span class="adm-label">{ui.form.pedigreeRu}</span>
              <textarea
                class="adm-textarea"
                name="pedigree_ru"
                rows={3}
                {...text('pedigree_ru', LIMITS.pedigree, true)}
              />
            </label>
            <label class="adm-field">
              <span class="adm-label">{ui.form.pedigreeEn}</span>
              <textarea
                class="adm-textarea"
                name="pedigree_en"
                dir="ltr"
                rows={3}
                {...text('pedigree_en', LIMITS.pedigree, true)}
              />
            </label>
          </div>
        )}
      </fieldset>

      {listing ? (
        <PhotoManager listing={listing} onChange={(l) => setListing(l)} />
      ) : (
        <section class="adm-photos" aria-labelledby="photos-h">
          <h2 id="photos-h" class="adm-h2">
            {ui.form.photos}
          </h2>
          <p class="adm-hint">
            {ui.form.save} → {ui.photos.add}
          </p>
        </section>
      )}

      <fieldset class="adm-fieldset" disabled={locked}>
        <legend class="adm-legend">{ui.form.internalNote}</legend>
        <textarea
          class="adm-textarea"
          name="internal_note"
          rows={3}
          aria-label={ui.form.internalNote}
          {...text('internal_note', LIMITS.note, true)}
        />
      </fieldset>

      {formError && (
        <p class="adm-error adm-form__error" role="alert" data-form-error>
          {formError}
        </p>
      )}

      <div class="adm-bar">
        <button
          type="submit"
          class="btn btn--primary"
          disabled={locked || (!dirty && !!listing)}
          aria-busy={busy === 'save'}
          data-save
        >
          {busy === 'save' ? ui.form.saving : ui.form.save}
        </button>
        {listing && !listing.published && (
          <button
            type="button"
            class="btn btn--secondary"
            disabled={locked}
            aria-busy={busy === 'publish'}
            onClick={() => void publish()}
            data-publish
          >
            {busy === 'publish' ? ui.form.publishing : ui.list.publish}
          </button>
        )}
        {listing?.published && (
          <button
            type="button"
            class="btn btn--secondary"
            disabled={locked}
            onClick={() => void unpublish()}
            data-unpublish
          >
            {ui.list.unpublish}
          </button>
        )}
        {listing && (
          <button type="button" class="btn btn--ghost" disabled={locked} onClick={() => setSheet(true)}>
            {ui.list.changeStatus}
          </button>
        )}
      </div>

      {sheet && listing && (
        <StatusSheet
          listing={listing}
          onClose={() => setSheet(false)}
          onChanged={(updated, message) => {
            setSheet(false);
            if (message) toast(message.text, message.kind);
            if (!updated) {
              navigate({ name: 'archive' });
              return;
            }
            const merged = { ...updated, listing_images: listing.listing_images };
            setListing(merged);
            setDraft(toInput(merged));
            setDirty(false);
            if (merged.archived_at) navigate({ name: 'archive' });
          }}
        />
      )}
    </form>
  );
}
