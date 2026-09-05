/** Scroll reveal, progressive: no-JS and reduced-motion show content immediately (see global.css). */
const html = document.documentElement;
const reduce =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches || html.dataset.motion === 'reduce';
const els = document.querySelectorAll<HTMLElement>('.reveal');
if (reduce || !('IntersectionObserver' in window)) {
  els.forEach((el) => el.classList.add('is-visible'));
} else {
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((en) => {
        if (en.isIntersecting) {
          en.target.classList.add('is-visible');
          io.unobserve(en.target);
        }
      }),
    { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
  );
  els.forEach((el) => io.observe(el));
}

export {};
