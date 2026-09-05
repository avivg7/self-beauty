/** Header behaviour: scrolled state, mobile menu sheet (focus trap, Esc, inert), language menu, language persistence. */
const header = document.querySelector<HTMLElement>('[data-header]');
const sheet = document.querySelector<HTMLElement>('[data-menu-sheet]');
const openBtn = document.querySelector<HTMLButtonElement>('[data-menu-open]');
const stickyBar = document.querySelector<HTMLElement>('[data-sticky-bar]');
const main = document.getElementById('main');
const footer = document.getElementById('footer');
const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

let lastY = 0;
const onScroll = () => {
  const y = window.scrollY;
  header?.classList.toggle('is-scrolled', y > 8);
  lastY = y;
};
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });
void lastY;

function openSheet() {
  if (!sheet || !openBtn) return;
  sheet.hidden = false;
  openBtn.setAttribute('aria-expanded', 'true');
  document.body.classList.add('menu-open');
  main?.setAttribute('inert', '');
  footer?.setAttribute('inert', '');
  stickyBar?.classList.add('is-hidden');
  const first = sheet.querySelector<HTMLElement>('[data-menu-close]');
  first?.focus();
}
function closeSheet(returnFocus = true) {
  if (!sheet || !openBtn) return;
  sheet.hidden = true;
  openBtn.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('menu-open');
  main?.removeAttribute('inert');
  footer?.removeAttribute('inert');
  stickyBar?.classList.remove('is-hidden');
  if (returnFocus) openBtn.focus();
}
openBtn?.addEventListener('click', openSheet);
sheet?.querySelector('[data-menu-close]')?.addEventListener('click', () => closeSheet());
sheet?.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeSheet();
    return;
  }
  if (e.key !== 'Tab' || !sheet) return;
  const items = Array.from(sheet.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null,
  );
  if (!items.length) return;
  const first = items[0]!,
    last = items[items.length - 1]!;
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
});
// Close when navigating within the same page (anchors) or when resizing to desktop.
sheet?.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => closeSheet(false)));
window.matchMedia('(min-width: 64rem)').addEventListener('change', (e) => {
  if (e.matches) closeSheet(false);
});

// Language dropdown(s)
document.querySelectorAll<HTMLElement>('[data-lang]').forEach((root) => {
  const btn = root.querySelector<HTMLButtonElement>('[data-lang-btn]');
  const menu = root.querySelector<HTMLElement>('[data-lang-menu]');
  if (!btn || !menu) return;
  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  const open = () => {
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    menu.querySelector<HTMLElement>('a')?.focus();
  };
  btn.addEventListener('click', () => (menu.hidden ? open() : close()));
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      btn.focus();
    }
    const links = Array.from(menu.querySelectorAll<HTMLElement>('a'));
    const i = links.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      (links[(i + 1) % links.length] ?? links[0])?.focus();
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      (links[(i - 1 + links.length) % links.length] ?? links[0])?.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!root.contains(e.target as Node)) close();
  });
});

// Persist an explicit language choice (used by the root gateway). Never persisted implicitly.
document.querySelectorAll<HTMLAnchorElement>('[data-lang-choice]').forEach((a) => {
  a.addEventListener('click', () => {
    try {
      localStorage.setItem('sb:lang', a.dataset.langChoice ?? '');
    } catch {
      /* storage unavailable */
    }
  });
});

export {};
