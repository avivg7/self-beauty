import { useEffect, useRef, useState } from 'preact/hooks';
import {
  archiveListing,
  deleteListing,
  publishListing,
  restoreListing,
  unpublishListing,
  updateListing,
  ApiError,
  STATUSES,
  type Listing,
  type Status,
} from './api';
import { useT } from './i18n';
import { useApp } from './context';
import { statusKey } from '@/lib/public-listings';
import type { ToastKind } from './context';

export type SheetMessage = { text: string; kind: ToastKind };

/** Bottom sheet: status change, publish/unpublish, archive/restore, permanent delete. One action at a time. */
export function StatusSheet({
  listing,
  onClose,
  onChanged,
}: {
  listing: Listing;
  onClose: () => void;
  onChanged: (updated: Listing | null, message?: SheetMessage) => void;
}) {
  const { ui, dict } = useT();
  const { onAuthError } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>(listing.status);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [confirm, setConfirm] = useState<'archive' | 'delete' | null>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    const onCancel = (e: Event) => {
      e.preventDefault();
      if (!busy) onClose();
    };
    d?.addEventListener('cancel', onCancel);
    return () => d?.removeEventListener('cancel', onCancel);
  }, [busy, onClose]);

  const run = async (
    name: string,
    fn: () => Promise<{ listing: Listing | null; message?: SheetMessage }>,
  ) => {
    if (busy) return;
    setBusy(name);
    setError('');
    try {
      const r = await fn();
      onChanged(r.listing, r.message);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'UNAUTHORIZED') return onAuthError();
      const code = e instanceof ApiError ? e.code : '';
      setError(
        code === 'NO_IMAGE'
          ? ui.form.publishNeedsPhoto
          : code === 'MISSING_HEBREW_TEXT'
            ? ui.form.publishNeedsText
            : name === 'publish'
              ? ui.form.publishFailed
              : name === 'delete'
                ? ui.form.deleteFailed
                : ui.form.saveFailed,
      );
    } finally {
      setBusy(null);
    }
  };

  const archived = !!listing.archived_at;
  return (
    <dialog ref={ref} class="adm-sheet" aria-labelledby="sheet-title" data-status-sheet>
      <div class="adm-sheet__body">
        <div class="adm-sheet__head">
          <h2 id="sheet-title" class="adm-h2">
            {ui.form.statusSheetTitle}
          </h2>
          <button
            type="button"
            class="adm-sheet__close"
            onClick={onClose}
            disabled={!!busy}
            aria-label={ui.form.close}
          >
            ×
          </button>
        </div>
        <p class="adm-sheet__name">{listing.name_he}</p>

        {!archived && (
          <fieldset class="adm-fieldset" disabled={!!busy}>
            <legend class="adm-label">{ui.form.status}</legend>
            <div class="adm-radios">
              {STATUSES.map((s) => (
                <label key={s} class={`adm-radio ${status === s ? 'adm-radio--on' : ''}`}>
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                  />
                  <span class={`chip chip--${statusKey(s)}`}>{dict.status[statusKey(s)]}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              class="btn btn--primary btn--block"
              disabled={!!busy || status === listing.status}
              aria-busy={busy === 'status'}
              onClick={() =>
                void run('status', async () => ({
                  listing: await updateListing(listing.id, { status }),
                  message: { text: ui.form.statusUpdated, kind: 'ok' },
                }))
              }
            >
              {busy === 'status' ? ui.form.saving : ui.form.save}
            </button>
          </fieldset>
        )}

        <div class="adm-sheet__actions">
          {!archived && !listing.published && (
            <button
              type="button"
              class="btn btn--secondary btn--block"
              disabled={!!busy}
              aria-busy={busy === 'publish'}
              data-publish
              onClick={() =>
                void run('publish', async () => ({
                  listing: await publishListing(listing),
                  message: { text: ui.form.publishedOk, kind: 'ok' },
                }))
              }
            >
              {busy === 'publish' ? ui.form.publishing : ui.list.publish}
            </button>
          )}
          {!archived && listing.published && (
            <button
              type="button"
              class="btn btn--secondary btn--block"
              disabled={!!busy}
              data-unpublish
              onClick={() =>
                void run('unpublish', async () => {
                  const r = await unpublishListing(listing);
                  return {
                    listing: r.listing,
                    message: r.cleanupFailed
                      ? { text: ui.form.unpublishCleanupFailed, kind: 'error' }
                      : { text: ui.form.unpublishedOk, kind: 'ok' },
                  };
                })
              }
            >
              {ui.list.unpublish}
            </button>
          )}
          {!archived && confirm !== 'archive' && (
            <button
              type="button"
              class="btn btn--ghost btn--block"
              disabled={!!busy}
              onClick={() => setConfirm('archive')}
            >
              {ui.list.archive}
            </button>
          )}
          {!archived && confirm === 'archive' && (
            <div class="adm-confirm" role="group" aria-label={ui.form.archiveConfirmTitle}>
              <p>
                <strong>{ui.form.archiveConfirmTitle}</strong> {ui.form.archiveConfirmText}
              </p>
              <div class="adm-confirm__row">
                <button
                  type="button"
                  class="btn btn--primary"
                  disabled={!!busy}
                  onClick={() =>
                    void run('archive', async () => {
                      const r = await archiveListing(listing);
                      return { listing: r.listing, message: { text: ui.form.archivedOk, kind: 'ok' } };
                    })
                  }
                >
                  {ui.form.archiveConfirm}
                </button>
                <button
                  type="button"
                  class="btn btn--ghost"
                  disabled={!!busy}
                  onClick={() => setConfirm(null)}
                >
                  {ui.form.cancel}
                </button>
              </div>
            </div>
          )}
          {archived && (
            <button
              type="button"
              class="btn btn--secondary btn--block"
              disabled={!!busy}
              onClick={() =>
                void run('restore', async () => ({
                  listing: await restoreListing(listing),
                  message: { text: ui.form.restoredOk, kind: 'ok' },
                }))
              }
            >
              {ui.list.restore}
            </button>
          )}
          {archived && confirm !== 'delete' && (
            <button
              type="button"
              class="btn btn--ghost btn--block adm-danger"
              disabled={!!busy}
              onClick={() => setConfirm('delete')}
            >
              {ui.list.delete}
            </button>
          )}
          {archived && confirm === 'delete' && (
            <div class="adm-confirm adm-confirm--danger" role="group" aria-label={ui.form.deleteConfirmTitle}>
              <p>
                <strong>{ui.form.deleteConfirmTitle}</strong> {ui.form.deleteConfirmText}
              </p>
              <input
                class="adm-input"
                type="text"
                value={typed}
                onInput={(e) => setTyped((e.currentTarget as HTMLInputElement).value)}
                aria-label={ui.form.nameHe}
              />
              <div class="adm-confirm__row">
                <button
                  type="button"
                  class="btn btn--primary adm-danger-btn"
                  disabled={!!busy || typed.trim() !== listing.name_he.trim()}
                  onClick={() =>
                    void run('delete', async () => {
                      await deleteListing(listing);
                      return { listing: null, message: { text: ui.form.deletedOk, kind: 'ok' } };
                    })
                  }
                >
                  {ui.form.deleteConfirm}
                </button>
                <button
                  type="button"
                  class="btn btn--ghost"
                  disabled={!!busy}
                  onClick={() => {
                    setConfirm(null);
                    setTyped('');
                  }}
                >
                  {ui.form.cancel}
                </button>
              </div>
            </div>
          )}
        </div>
        {busy && (
          <p class="muted" aria-live="polite">
            {ui.form.busy}
          </p>
        )}
        {error && (
          <p class="adm-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </dialog>
  );
}
