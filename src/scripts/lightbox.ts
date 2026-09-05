/**
 * Accessible lightbox for photos and videos.
 * - <dialog> with native focus trapping; Esc closes; arrows/Home/End navigate; swipe on touch.
 * - Group = items sharing data-lb-group, in DOM order (only those not hidden by filters).
 * - Images use a larger derivative (data-lb-src); videos load only when opened (data-lb-src720/480).
 * - Video tier chosen at play time (480p under 640px or Save-Data).
 */
const dialog = document.querySelector<HTMLDialogElement>('[data-lightbox]');
if (dialog) {
  const media = dialog.querySelector<HTMLElement>('[data-lb-media]')!;
  const cap = dialog.querySelector<HTMLElement>('[data-lb-cap]')!;
  const counter = dialog.querySelector<HTMLElement>('[data-lb-counter]')!;
  const prevBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-prev]')!;
  const nextBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-next]')!;
  const closeBtn = dialog.querySelector<HTMLButtonElement>('[data-lb-close]')!;
  const stickyBar = document.querySelector<HTMLElement>('[data-sticky-bar]');
  const rtl = document.documentElement.dir === 'rtl';
  const counterTpl = counter.dataset.tpl ?? '{current} / {total}';

  let items: HTMLElement[] = [];
  let index = 0;
  let opener: HTMLElement | null = null;

  const lowTier = () =>
    window.innerWidth < 640 ||
    (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;

  function render() {
    const el = items[index];
    if (!el) return;
    media.innerHTML = '';
    media.classList.add('is-loading');
    const d = el.dataset;
    if (d.lbType === 'video') {
      const v = document.createElement('video');
      v.controls = true;
      v.playsInline = true;
      v.preload = 'metadata';
      v.poster = d.lbPoster ?? '';
      v.src = (lowTier() ? d.lbSrc480 : d.lbSrc720) ?? d.lbSrc720 ?? '';
      if (d.lbW && d.lbH) {
        v.width = Number(d.lbW);
        v.height = Number(d.lbH);
      }
      v.setAttribute('aria-label', d.lbAlt ?? '');
      v.addEventListener('loadeddata', () => media.classList.remove('is-loading'), { once: true });
      media.appendChild(v);
      v.play().catch(() => {
        /* autoplay may be blocked; controls are visible */
      });
    } else {
      const img = new Image();
      img.alt = d.lbAlt ?? '';
      if (d.lbSrcset) img.srcset = d.lbSrcset;
      img.sizes = '100vw';
      img.src = d.lbSrc ?? '';
      if (d.lbW && d.lbH) {
        img.width = Number(d.lbW);
        img.height = Number(d.lbH);
      }
      img.decoding = 'async';
      img.addEventListener('load', () => media.classList.remove('is-loading'), { once: true });
      media.appendChild(img);
    }
    cap.textContent = d.lbCaption ?? '';
    counter.textContent = counterTpl
      .replace('{current}', String(index + 1))
      .replace('{total}', String(items.length));
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === items.length - 1;
    prevBtn.hidden = nextBtn.hidden = items.length < 2;
    // Preload neighbours' images
    [index - 1, index + 1].forEach((i) => {
      const n = items[i];
      if (n && n.dataset.lbType !== 'video' && n.dataset.lbSrc) {
        const p = new Image();
        p.src = n.dataset.lbSrc;
      }
    });
  }
  function stopVideo() {
    media.querySelector('video')?.pause();
  }
  function go(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= items.length) return;
    stopVideo();
    index = next;
    render();
  }

  function open(trigger: HTMLElement) {
    opener = trigger;
    const group = trigger.dataset.lbGroup ?? '';
    const all = Array.from(document.querySelectorAll<HTMLElement>('[data-lb-item]'));
    items = all.filter((el) => (el.dataset.lbGroup ?? '') === group && !el.closest('[hidden]'));
    index = Math.max(0, items.indexOf(trigger));
    render();
    if (typeof dialog!.showModal === 'function') dialog!.showModal();
    else dialog!.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    stickyBar?.classList.add('is-hidden');
    closeBtn.focus();
  }
  function close() {
    stopVideo();
    dialog!.close();
  }

  dialog.addEventListener('close', () => {
    media.innerHTML = '';
    document.body.style.overflow = '';
    stickyBar?.classList.remove('is-hidden');
    opener?.focus();
  });
  closeBtn.addEventListener('click', close);
  prevBtn.addEventListener('click', () => go(-1));
  nextBtn.addEventListener('click', () => go(1));
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target === media) close();
  });
  dialog.addEventListener('keydown', (e) => {
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    if (e.key === forward) {
      e.preventDefault();
      go(1);
    } else if (e.key === back) {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      go(-index);
    } else if (e.key === 'End') {
      e.preventDefault();
      go(items.length - 1 - index);
    }
  });
  // Touch swipe (horizontal, with threshold; vertical scrolls are ignored)
  let sx = 0,
    sy = 0,
    tracking = false;
  dialog.addEventListener(
    'touchstart',
    (e) => {
      const t = e.touches[0];
      if (!t) return;
      sx = t.clientX;
      sy = t.clientY;
      tracking = true;
    },
    { passive: true },
  );
  dialog.addEventListener(
    'touchend',
    (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      if (!t) return;
      const dx = t.clientX - sx,
        dy = t.clientY - sy;
      if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
      const forwardSwipe = dx < 0; // swiping content to the left reveals the next item visually (LTR); mirror for RTL
      go((rtl ? !forwardSwipe : forwardSwipe) ? 1 : -1);
    },
    { passive: true },
  );

  document.addEventListener('click', (e) => {
    const trigger = (e.target as HTMLElement).closest<HTMLElement>('[data-lb-item]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });
}

export {};
