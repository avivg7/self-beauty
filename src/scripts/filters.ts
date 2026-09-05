/** Gallery filters: type (all/image/video) and breed. Hidden items are excluded from the lightbox group. */
document.querySelectorAll<HTMLElement>('[data-gallery]').forEach((root) => {
  const typeInputs = root.querySelectorAll<HTMLInputElement>('input[data-filter="type"]');
  const breedSel = root.querySelector<HTMLSelectElement>('select[data-filter="breed"]');
  const items = Array.from(root.querySelectorAll<HTMLElement>('.gallery__item'));
  const count = root.querySelector<HTMLElement>('[data-gallery-count]');
  const empty = root.querySelector<HTMLElement>('[data-gallery-empty]');
  if (!typeInputs.length && !breedSel) return;
  const apply = () => {
    const type = Array.from(typeInputs).find((i) => i.checked)?.value ?? 'all';
    const breed = breedSel?.value ?? 'all';
    let shown = 0;
    items.forEach((li) => {
      const okType = type === 'all' || li.dataset.type === type;
      const okBreed = breed === 'all' || (li.dataset.breeds ?? '').split(' ').includes(breed);
      const show = okType && okBreed;
      li.hidden = !show;
      if (show) shown++;
    });
    if (count) count.textContent = shown ? `${shown}` : '';
    if (empty) empty.hidden = shown > 0;
  };
  typeInputs.forEach((i) => i.addEventListener('change', apply));
  breedSel?.addEventListener('change', apply);
  apply();
});

export {};
