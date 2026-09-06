import { useEffect, useRef, useState } from 'preact/hooks';
import {
  addImage,
  removeImage,
  reorderImages,
  replaceImage,
  previewUrl,
  ApiError,
  type Listing,
  type UploadPhase,
} from './api';
import { PipelineError } from './image-pipeline';
import { useT } from './i18n';
import { useApp } from './context';

interface Pending {
  id: string;
  phase: UploadPhase | 'failed';
  error?: string;
  replacing?: string;
}

const ACCEPT = 'image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif';

/** "תמונות — n/3": add (disabled at 3/3), replace, remove, reorder, choose main. Controls lock while saving. */
export function PhotoManager({ listing, onChange }: { listing: Listing; onChange: (l: Listing) => void }) {
  const { ui, dict, fmt } = useT();
  const { onAuthError, toast } = useApp();
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  const images = listing.listing_images;
  const count = images.length;
  const full = count >= 3;

  useEffect(() => {
    let alive = true;
    (async () => {
      const missing = images.filter((i) => !previews[i.id]);
      if (!missing.length) return;
      const entries = await Promise.all(
        missing.map(async (i) => [i.id, await previewUrl(listing.id, i.id).catch(() => null)] as const),
      );
      if (alive)
        setPreviews((p) => ({
          ...p,
          ...Object.fromEntries(entries.filter((e): e is readonly [string, string] => !!e[1])),
        }));
    })();
    return () => {
      alive = false;
    };
  }, [images.map((i) => i.id).join(',')]);

  const errorText = (e: unknown): string => {
    if (e instanceof PipelineError)
      return dict.admin.upload[
        e.code === 'tooLarge' ? 'tooLarge' : e.code === 'unsupportedType' ? 'unsupportedType' : 'invalidImage'
      ];
    if (e instanceof ApiError && e.code === 'LIMIT_REACHED') return ui.photos.limitReached;
    return ui.photos.failed;
  };

  const handleFiles = async (files: FileList | null, replaceId: string | null) => {
    if (!files || !files.length) return;
    const list = Array.from(files).slice(0, replaceId ? 1 : Math.max(0, 3 - count));
    if (!list.length) {
      toast(ui.photos.limitReached, 'error');
      return;
    }
    setBusy(true);
    let current = listing;
    for (const file of list) {
      const pid = crypto.randomUUID();
      setPending((p) => [
        ...p,
        { id: pid, phase: 'processing', ...(replaceId ? { replacing: replaceId } : {}) },
      ]);
      const onPhase = (phase: UploadPhase) =>
        setPending((p) => p.map((x) => (x.id === pid ? { ...x, phase } : x)));
      try {
        const added = replaceId
          ? await replaceImage(current, replaceId, file, onPhase)
          : await addImage(current, file, onPhase);
        const url = URL.createObjectURL(added.preview);
        setPreviews((p) => ({ ...p, [added.image.id]: url }));
        const others = replaceId
          ? current.listing_images.filter((i) => i.id !== replaceId)
          : current.listing_images;
        const next = [...others, added.image];
        if (replaceId) {
          const old = current.listing_images.find((i) => i.id === replaceId);
          if (old) {
            next.sort((a, b) => a.position - b.position);
            const idx = next.findIndex((i) => i.id === added.image.id);
            next.splice(idx, 1);
            next.splice(old.position - 1, 0, added.image);
            next.forEach((i, n) => {
              i.position = n + 1;
            });
          }
        }
        current = { ...current, listing_images: next.sort((a, b) => a.position - b.position) };
        onChange(current);
        setPending((p) => p.filter((x) => x.id !== pid));
      } catch (e) {
        if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
        setPending((p) => p.map((x) => (x.id === pid ? { ...x, phase: 'failed', error: errorText(e) } : x)));
      }
    }
    setBusy(false);
  };

  const withBusy = async (fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
      toast(ui.form.saveFailed, 'error');
    } finally {
      setBusy(false);
    }
  };
  const reorder = (ids: string[]) =>
    withBusy(async () => {
      await reorderImages(listing.id, ids);
      onChange({
        ...listing,
        listing_images: ids.map((id, n) => ({ ...images.find((i) => i.id === id)!, position: n + 1 })),
      });
    });
  const move = (id: string, delta: number) => {
    const ids = images.map((i) => i.id);
    const from = ids.indexOf(id),
      to = from + delta;
    if (from < 0 || to < 0 || to >= ids.length) return;
    ids.splice(from, 1);
    ids.splice(to, 0, id);
    void reorder(ids);
  };
  const setMain = (id: string) => {
    const ids = images.map((i) => i.id).filter((x) => x !== id);
    void reorder([id, ...ids]);
  };
  const remove = (id: string) => {
    if (!window.confirm(ui.photos.removeConfirm)) return;
    void withBusy(async () => {
      await removeImage(listing, id);
      onChange({
        ...listing,
        listing_images: images.filter((i) => i.id !== id).map((i, n) => ({ ...i, position: n + 1 })),
      });
    });
  };

  return (
    <section class="adm-photos" aria-labelledby="photos-h" data-photo-manager data-count={count}>
      <div class="adm-photos__head">
        <h2 id="photos-h" class="adm-h2">
          {fmt(ui.form.photosCount, { count })}
        </h2>
        <button
          type="button"
          class="btn btn--secondary btn--sm"
          disabled={full || busy}
          onClick={() => addInput.current?.click()}
          data-add-photo
        >
          {count === 2 ? ui.photos.addOne : ui.photos.add}
        </button>
        <input
          ref={addInput}
          class="sr-only"
          type="file"
          accept={ACCEPT}
          multiple={count < 2}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const el = e.currentTarget as HTMLInputElement;
            void handleFiles(el.files, null);
            el.value = '';
          }}
        />
        <input
          ref={replaceInput}
          class="sr-only"
          type="file"
          accept={ACCEPT}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const el = e.currentTarget as HTMLInputElement;
            void handleFiles(el.files, replacing.current);
            replacing.current = null;
            el.value = '';
          }}
        />
      </div>
      <p class="adm-hint">{ui.photos.heicNote}</p>
      <ul role="list" class="adm-tiles">
        {images.map((im, n) => (
          <li key={im.id} class="adm-tile" data-image-tile>
            <div class="adm-tile__img">
              {previews[im.id] ? (
                <img src={previews[im.id]} alt="" width={im.width} height={im.height} />
              ) : (
                <span class="adm-tile__ph" />
              )}
              {n === 0 && <span class="chip adm-tile__main">{ui.photos.main}</span>}
            </div>
            <div class="adm-tile__actions">
              {n !== 0 && (
                <button type="button" class="adm-tile__btn" disabled={busy} onClick={() => setMain(im.id)}>
                  {ui.photos.setMain}
                </button>
              )}
              <button
                type="button"
                class="adm-tile__btn"
                disabled={busy || n === 0}
                onClick={() => move(im.id, -1)}
                aria-label={ui.photos.moveUp}
              >
                ▲
              </button>
              <button
                type="button"
                class="adm-tile__btn"
                disabled={busy || n === images.length - 1}
                onClick={() => move(im.id, 1)}
                aria-label={ui.photos.moveDown}
              >
                ▼
              </button>
              <button
                type="button"
                class="adm-tile__btn"
                disabled={busy}
                onClick={() => {
                  replacing.current = im.id;
                  replaceInput.current?.click();
                }}
              >
                {ui.photos.replace}
              </button>
              <button
                type="button"
                class="adm-tile__btn adm-danger"
                disabled={busy}
                onClick={() => remove(im.id)}
              >
                {ui.photos.remove}
              </button>
            </div>
          </li>
        ))}
        {pending.map((p) => (
          <li
            key={p.id}
            class={`adm-tile adm-tile--pending ${p.phase === 'failed' ? 'adm-tile--failed' : ''}`}
            aria-busy={p.phase !== 'failed'}
          >
            <div class="adm-tile__img">
              <span class="adm-tile__ph" />
            </div>
            <p class="adm-tile__status" role="status">
              {p.phase === 'processing'
                ? ui.photos.processing
                : p.phase === 'uploading'
                  ? ui.photos.uploading
                  : p.error}
            </p>
            {p.phase === 'failed' && (
              <button
                type="button"
                class="adm-tile__btn"
                onClick={() => setPending((x) => x.filter((y) => y.id !== p.id))}
              >
                {ui.form.close}
              </button>
            )}
          </li>
        ))}
      </ul>
      {full && (
        <p class="adm-hint" role="status">
          {ui.photos.limitReached}
        </p>
      )}
    </section>
  );
}
