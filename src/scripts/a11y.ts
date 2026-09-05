/** Accessibility panel: text size, high contrast, reduce motion. Persisted in localStorage under sb:a11y. */
type Prefs = { text?: '' | 'lg' | 'xl'; contrast?: boolean; motion?: boolean };
const KEY = 'sb:a11y';
const html = document.documentElement;
const panel = document.querySelector<HTMLDialogElement>('[data-a11y-panel]');
const form = panel?.querySelector<HTMLFormElement>('[data-a11y-form]');
let opener: HTMLElement | null = null;

function read(): Prefs {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}
function write(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}
function apply(p: Prefs) {
  if (p.text) html.setAttribute('data-text', p.text);
  else html.removeAttribute('data-text');
  if (p.contrast) html.setAttribute('data-contrast', 'high');
  else html.removeAttribute('data-contrast');
  if (p.motion) html.setAttribute('data-motion', 'reduce');
  else html.removeAttribute('data-motion');
}
function syncForm(p: Prefs) {
  if (!form) return;
  const text = form.elements.namedItem('text') as RadioNodeList | null;
  if (text) text.value = p.text ?? '';
  (form.elements.namedItem('contrast') as HTMLInputElement).checked = !!p.contrast;
  (form.elements.namedItem('motion') as HTMLInputElement).checked = !!p.motion;
}
function current(): Prefs {
  if (!form) return {};
  const text = (form.elements.namedItem('text') as RadioNodeList | null)?.value as Prefs['text'];
  return {
    text: text || '',
    contrast: (form.elements.namedItem('contrast') as HTMLInputElement).checked,
    motion: (form.elements.namedItem('motion') as HTMLInputElement).checked,
  };
}

if (panel && form) {
  syncForm(read());
  form.addEventListener('change', () => {
    const p = current();
    apply(p);
    write(p);
  });
  form.querySelector('[data-a11y-reset]')?.addEventListener('click', () => {
    const p: Prefs = {};
    syncForm(p);
    apply(p);
    write(p);
  });
  document.querySelectorAll<HTMLElement>('[data-a11y-open]').forEach((btn) =>
    btn.addEventListener('click', () => {
      opener = btn;
      if (typeof panel.showModal === 'function') panel.showModal();
      else panel.setAttribute('open', '');
    }),
  );
  panel.addEventListener('close', () => opener?.focus());
  panel.addEventListener('click', (e) => {
    if (e.target === panel) panel.close();
  });
}

export {};
