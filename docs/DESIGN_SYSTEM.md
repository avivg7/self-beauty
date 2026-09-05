# Design system

"European show-ring prestige, modern boutique." Derived from the official logo (`images/site_logo.png`), reinterpreted
so the website reads as contemporary and calm rather than ornate.

## Colour

Sampled from the logo by region (k-means): crimson `#A40C0B`, deep red `#631A0D`, gold `#D9AE72`/`#C1A583`,
black `#0C0909`, ivory `#F2EFEA`. Tokens live in `src/styles/tokens.css`.

| Token                              | Value                             | Role                                                    | Contrast          |
| ---------------------------------- | --------------------------------- | ------------------------------------------------------- | ----------------- |
| `--c-bg`                           | `#F8F4EC`                         | page ground                                             | —                 |
| `--c-cream`                        | `#F1EAE0`                         | alternate section ground                                | —                 |
| `--c-surface`                      | `#FFFDF9`                         | cards, dialogs                                          | —                 |
| `--c-border` / `--c-border-strong` | `#E2D8C8` / `#CDBFA8`             | hairlines, inputs                                       | —                 |
| `--c-burgundy`                     | `#7B1B22`                         | primary action, links, emphasis                         | 9.5:1 on ivory    |
| `--c-burgundy-deep`                | `#4F0D14`                         | pressed state, contact band                             | 13.7:1            |
| `--c-crimson`                      | `#A8121A`                         | logo red, tiny accents only                             | 6.9:1             |
| `--c-charcoal` / `--c-black`       | `#1F1B1A` / `#0C0909`             | text, dark sections, footer                             | 15.6:1 / 18:1     |
| `--c-gold`                         | `#C9A46A`                         | lines, frames, chips on dark — never body text on light | 7.3:1 on charcoal |
| `--c-gold-bright`                  | `#DDB877`                         | gold text on dark                                       | 9.1:1 on charcoal |
| `--c-gold-text`                    | `#7E603A`                         | gold-toned text on light (eyebrows)                     | 5.3:1             |
| `--c-text-2`                       | `#5C544F`                         | secondary text                                          | 6.7:1             |
| success / warning / error          | `#2F6F4E` / `#8A5E0E` / `#A8232B` | status                                                  | ≥ 5.2:1           |

Rules: gold is a line, a frame or a chip, never a background. Burgundy is the action colour. Most of any page
is ivory and photograph. `.dark` sections swap the tokens; `html[data-contrast="high"]` swaps them again.

## Typography

**Arial everywhere** (client decision, 2026-09-05). No web fonts are loaded: `--font-sans: Arial, Helvetica, sans-serif`
covers Hebrew, Cyrillic and Latin through the operating system's Arial / Arial Hebrew families, which removes ~150 KB of
font downloads and any font-swap flash. The ornate brand lettering lives in the logo image only.

- Weights: Arial ships 400 and 700 only, so the system uses exactly those (no synthesized 500/600).
- Scale (fluid): `--fs-hero` 2.1–4.1rem, `--fs-3xl` 2.1–3.5rem, `--fs-2xl` 1.75–2.5rem, `--fs-xl` 1.35–1.75rem,
  body 1rem (1.0625rem ≥ 768px). Body line-height 1.6, headings 1.1 with −0.012em tracking.
- Russian headlines get a slightly smaller hero size and wider measure because Cyrillic words run long.
- Bidi: `.ltr` / `.num` isolate Latin fragments in RTL copy; `.phone` additionally prevents wrapping at hyphens.

## Signature elements

1. **The mounted photograph** — `.frame`: a 1px gold hairline offset 8px (12px ≥ 768px) from the photo, like a
   mounted show print. Used on the hero, the breeder portrait, the shows band and puppy detail. Nowhere else.
2. **The rosette** — `.rosette` (icon + label) reserved for verified show titles and show/breeding prospect flags.
   Puppy availability uses plain `.chip` pills: a status is not an award.
3. **Gold rule eyebrows** — `.eyebrow::before` is a short gold line; section titles follow.

Deliberately absent: gold backgrounds, paw-print patterns, cartoon dogs, e-commerce badges, gradient heroes,
decorative "01/02/03" numbering (the litters "how it works" list is a real sequence and is numbered).

## Layout and spacing

4pt rhythm (`--sp-1`…`--sp-9`), section padding `clamp(3.5rem, 8vw, 7rem)`, container 72rem, narrow 46rem,
gutter `clamp(1rem, 4vw, 2.5rem)`. Grid helpers `.grid--2/3/4` collapse to two columns on tablet and one on
phones. Every fixed element reserves space (`body` padding-bottom for the sticky bar; safe-area insets).

## Galleries

Tiles are uniform 4:5 crops (focal-point positioned); landscape photos and videos span two columns, and
when landscape tiles outnumber portrait ones the surplus are promoted to full-width rows so no column is
left empty. Icons come from one inline SVG family (`Icon.astro`, 1.75 stroke) and size relative to text.

## Components

- Buttons `.btn` (pill, 48px min height): primary burgundy, `--secondary` outline, `--ghost`, `--whatsapp`,
  `--on-dark` gold. Icons 1.15em. Full-width under 480px where they are the page's main action.
- Cards `.card`: surface, hairline border, 10px radius, soft shadow on hover, image scale 1.03.
- Chips `.chip--available/reserved/planned/placed/coming-soon`, `.chip--demo` (dashed amber, never in production).
- Forms `.field/.input/.select/.textarea`: 48px inputs, visible labels, error text below field, burgundy focus ring.

## Motion

One orchestrated hero sequence (eyebrow, title, image frame, lede, actions rise 14px over 640ms with 90ms
stagger). Scroll reveals (`.reveal`, 14px/420ms, ≤3 stagger steps). Hover: image scale 1.03, 420ms.
Lightbox crossfade 150ms. All animation collapses under `prefers-reduced-motion` and `html[data-motion=reduce]`.
No parallax, no scroll-jacking, no autoplay with sound.

## Accessibility controls

The panel offers text ×1.125/×1.25, high contrast and reduce motion; preferences persist per device (`sb:a11y`)
and apply before first paint via an inline script in `Base.astro`.
