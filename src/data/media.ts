/**
 * Media catalogue: every committed web master with its localized caption, alt text,
 * focal point (0–1, used for object-position so faces are never cropped out) and chapter.
 * Ids match scripts/media/manifest.json → src/assets/media/<set>/<id>.jpg
 *
 * `year` is only set when the source carried a real capture date (EXIF / container metadata).
 * Show photos have no metadata and therefore no year — we do not guess.
 */
import type { Locale } from '@/i18n/locales';

export type L = Record<Locale, string>;
export type Chapter = 'puppies' | 'home' | 'table' | 'ring' | 'awards';
export type Breed = 'yorkshire' | 'poodle' | 'bichon' | 'pomeranian' | 'shihtzu';

export interface MediaImage {
  id: string;
  kind: 'image';
  set: 'shows' | 'years' | 'brand';
  alt: L;
  caption?: L;
  focal: { x: number; y: number };
  chapter?: Chapter;
  breeds?: Breed[];
  year?: number;
  /** Lower-quality source; keep to card sizes */
  small?: boolean;
  credit?: string;
}

export interface MediaVideo {
  id: string;
  kind: 'video';
  set: 'shows' | 'years';
  alt: L;
  caption?: L;
  chapter?: Chapter;
  breeds?: Breed[];
  year?: number;
  orientation: 'portrait' | 'landscape';
  hasAudio: boolean;
  /** Seconds; used for the duration badge */
  duration: number;
}

export type MediaItem = MediaImage | MediaVideo;

const img = (
  set: MediaImage['set'],
  id: string,
  alt: L,
  focal: { x: number; y: number },
  extra: Partial<Omit<MediaImage, 'id' | 'kind' | 'set' | 'alt' | 'focal'>> = {},
): MediaImage => ({ id: `${set}/${id}`, kind: 'image', set, alt, focal, ...extra });

export const images: MediaImage[] = [
  // Brand
  img(
    'brand',
    'hero-red-poodle',
    {
      he: 'פודל טוי בגוון אדמדם, מטופח לתערוכה, יושב על שולחן טיפוח',
      ru: 'Рыжий той-пудель в выставочном груминге на столе для груминга',
      en: 'Apricot Toy Poodle in show trim on a grooming table',
    },
    { x: 0.5, y: 0.3 },
    { chapter: 'table', breeds: ['poodle'] },
  ),
  img(
    'brand',
    'owner-portrait',
    {
      he: 'המגדלת של Self Beauty מחבקת יורקשייר טרייר עם סרט אדום',
      ru: 'Заводчик Self Beauty обнимает йоркширского терьера с красным бантиком',
      en: 'The Self Beauty breeder hugging a Yorkshire Terrier with a red bow',
    },
    { x: 0.45, y: 0.45 },
    { breeds: ['yorkshire'] },
  ),

  // Shows
  img(
    'shows',
    'ring-red-poodle',
    {
      he: 'מציגה מציבה פודל טוי אדמדם בזירת השיפוט',
      ru: 'Хендлер ставит рыжего той-пуделя в ринге',
      en: 'A handler stacking an apricot Toy Poodle in the judging ring',
    },
    { x: 0.5, y: 0.6 },
    {
      chapter: 'ring',
      breeds: ['poodle'],
      caption: {
        he: 'בזירה, בזמן השיפוט',
        ru: 'В ринге во время экспертизы',
        en: 'In the ring, under judgement',
      },
    },
  ),
  img(
    'shows',
    'yorkie-ring-044',
    {
      he: 'מציגה עם מספר 044 מחזיקה יורקשייר טרייר על שולחן התצוגה',
      ru: 'Хендлер с номером 044 держит йоркширского терьера на выставочном столе',
      en: 'Handler number 044 holding a Yorkshire Terrier on the show table',
    },
    { x: 0.5, y: 0.45 },
    {
      chapter: 'ring',
      breeds: ['yorkshire'],
      caption: {
        he: 'יורקשייר טרייר על שולחן השיפוט',
        ru: 'Йоркширский терьер на столе эксперта',
        en: 'A Yorkshire Terrier on the judging table',
      },
    },
  ),
  img(
    'shows',
    'owner-yorkie-stage',
    {
      he: 'המגדלת מחייכת לצד יורקשייר טרייר מטופח עם סרט אדום בתערוכה',
      ru: 'Заводчик улыбается рядом с ухоженным йоркширским терьером с красным бантом на выставке',
      en: 'The breeder smiling beside a groomed Yorkshire Terrier with a red bow at a show',
    },
    { x: 0.55, y: 0.4 },
    {
      chapter: 'ring',
      breeds: ['yorkshire'],
      credit: 'Svetlana Zohar Photography',
      caption: { he: 'אחרי השיפוט', ru: 'После экспертизы', en: 'After judging' },
    },
  ),
  img(
    'shows',
    'trophy-hall',
    {
      he: 'אולם תערוכה עם שולחנות גביעים זהובים לפני חלוקת הפרסים',
      ru: 'Выставочный зал со столами золотых кубков перед награждением',
      en: 'A show hall with tables of gold trophies before the awards',
    },
    { x: 0.7, y: 0.6 },
    {
      chapter: 'awards',
      caption: { he: 'לפני חלוקת הפרסים', ru: 'Перед награждением', en: 'Before the awards' },
    },
  ),
  img(
    'shows',
    'group-awards',
    {
      he: 'קבוצת מציגים עם פודלים וגביעים על במת הפרסים',
      ru: 'Группа хендлеров с пуделями и кубками на подиуме награждения',
      en: 'A group of handlers with Poodles and trophies on the awards podium',
    },
    { x: 0.5, y: 0.6 },
    {
      chapter: 'awards',
      breeds: ['poodle'],
      caption: { he: 'טקס הפרסים', ru: 'Церемония награждения', en: 'Awards ceremony' },
    },
  ),
  img(
    'shows',
    'owner-two-yorkies',
    {
      he: 'המגדלת מחזיקה שני יורקשייר טריירים מטופחים עם סרטים אדומים',
      ru: 'Заводчик держит двух ухоженных йоркширских терьеров с красными бантами',
      en: 'The breeder holding two groomed Yorkshire Terriers with red bows',
    },
    { x: 0.5, y: 0.35 },
    { chapter: 'ring', breeds: ['yorkshire'], small: true },
  ),
  img(
    'shows',
    'tent-red-poodle',
    {
      he: 'מציגה בז׳קט כחול מחזיקה פודל טוי אדמדם באוהל תערוכה',
      ru: 'Хендлер в синем жакете держит рыжего той-пуделя под выставочным шатром',
      en: 'A handler in a blue jacket holding an apricot Toy Poodle under a show tent',
    },
    { x: 0.45, y: 0.4 },
    { chapter: 'ring', breeds: ['poodle'] },
  ),
  img(
    'shows',
    'judging-outdoor',
    {
      he: 'שופט ושלושה מציגים עם פודלים בזירה פתוחה',
      ru: 'Эксперт и три хендлера с пуделями на открытом ринге',
      en: 'A judge and three handlers with Poodles in an outdoor ring',
    },
    { x: 0.5, y: 0.55 },
    {
      chapter: 'ring',
      breeds: ['poodle'],
      caption: {
        he: 'שיפוט בזירה פתוחה',
        ru: 'Экспертиза на открытом ринге',
        en: 'Judging in an outdoor ring',
      },
    },
  ),
  img(
    'shows',
    'best-of-breed',
    {
      he: 'שלושה אנשים עם פודלים לצד שלט Best of Breed',
      ru: 'Три человека с пуделями у таблички Best of Breed',
      en: 'Three people with Poodles beside a Best of Breed sign',
    },
    { x: 0.5, y: 0.45 },
    {
      chapter: 'awards',
      breeds: ['poodle'],
      caption: { he: 'Best of Breed', ru: 'Best of Breed', en: 'Best of Breed' },
    },
  ),
  img(
    'shows',
    'trophies-rosette',
    {
      he: 'שני גביעים ורוזטה כחולה-צהובה על רקע שחור',
      ru: 'Два кубка и сине-жёлтая розетка на чёрном фоне',
      en: 'Two trophies and a blue-and-yellow rosette on a black background',
    },
    { x: 0.5, y: 0.45 },
    {
      chapter: 'awards',
      caption: { he: 'גביעים ורוזטה', ru: 'Кубки и розетка', en: 'Trophies and a rosette' },
    },
  ),
  img(
    'shows',
    'shih-tzu-ring',
    {
      he: 'שני שיצו על שטיח אדום בזירת התערוכה',
      ru: 'Два ши-тцу на красной дорожке в ринге',
      en: 'Two Shih Tzu on the red carpet of the show ring',
    },
    { x: 0.65, y: 0.7 },
    {
      chapter: 'ring',
      breeds: ['shihtzu'],
      caption: { he: 'שיצו בזירה', ru: 'Ши-тцу в ринге', en: 'Shih Tzu in the ring' },
    },
  ),
  img(
    'shows',
    'owner-yorkie-portrait',
    {
      he: 'המגדלת בז׳קט פסים מחזיקה יורקשייר טרייר עם סרט אדום בתערוכה',
      ru: 'Заводчик в полосатом жакете держит йоркширского терьера с красным бантом на выставке',
      en: 'The breeder in a striped jacket holding a Yorkshire Terrier with a red bow at a show',
    },
    { x: 0.5, y: 0.3 },
    { chapter: 'ring', breeds: ['yorkshire'] },
  ),

  // Through the years (real capture dates from EXIF where available)
  img(
    'years',
    'pomeranian-puppy-blanket',
    {
      he: 'גור פומרניאן על שמיכה עם דובדבנים',
      ru: 'Щенок померанского шпица на одеяле с вишенками',
      en: 'A Pomeranian puppy on a cherry-print blanket',
    },
    { x: 0.5, y: 0.35 },
    { chapter: 'puppies', breeds: ['pomeranian'], year: 2026 },
  ),
  img(
    'years',
    'poodle-white-venue',
    {
      he: 'פודל לבן מוחזק על הכתף באולם תערוכה',
      ru: 'Белый пудель на плече в выставочном зале',
      en: 'A white Poodle held over a shoulder in a show hall',
    },
    { x: 0.5, y: 0.3 },
    { chapter: 'home', breeds: ['poodle'], year: 2026 },
  ),
  img(
    'years',
    'poodle-red-heart',
    {
      he: 'פודל טוי אדמדם עם כרית לב אדומה על שולחן הטיפוח',
      ru: 'Рыжий той-пудель с красной подушкой-сердцем на столе для груминга',
      en: 'An apricot Toy Poodle with a red heart cushion on the grooming table',
    },
    { x: 0.5, y: 0.4 },
    { chapter: 'table', breeds: ['poodle'], year: 2026 },
  ),
  img(
    'years',
    'bichon-puppies-pile',
    {
      he: 'גורי בישון פריזה ישנים בערימה ליד כדור',
      ru: 'Щенки бишон фризе спят кучкой рядом с мячиком',
      en: 'Bichon Frise puppies asleep in a pile beside a ball',
    },
    { x: 0.5, y: 0.5 },
    { chapter: 'puppies', breeds: ['bichon'], year: 2026 },
  ),
  img(
    'years',
    'bichon-puppies-pen',
    {
      he: 'שני גורי בישון פריזה בלול עם צעצוע',
      ru: 'Два щенка бишон фризе в манеже с игрушкой',
      en: 'Two Bichon Frise puppies in a pen with a toy',
    },
    { x: 0.5, y: 0.5 },
    { chapter: 'puppies', breeds: ['bichon'], year: 2026 },
  ),
  img(
    'years',
    'bichon-puppy-hands',
    {
      he: 'גור בישון פריזה מוחזק בשתי ידיים',
      ru: 'Щенок бишон фризе на двух ладонях',
      en: 'A Bichon Frise puppy held in two hands',
    },
    { x: 0.5, y: 0.35 },
    { chapter: 'puppies', breeds: ['bichon'], year: 2026 },
  ),
  img(
    'years',
    'bichon-adult-floor',
    {
      he: 'בישון פריזה בוגר יושב על רצפת שיש',
      ru: 'Взрослый бишон фризе сидит на мраморном полу',
      en: 'An adult Bichon Frise sitting on a marble floor',
    },
    { x: 0.5, y: 0.35 },
    { chapter: 'home', breeds: ['bichon'] },
  ),
  img(
    'years',
    'bichon-puppy-bows',
    {
      he: 'גור בישון פריזה לבן עם סרטים ורודים על רקע תכלת',
      ru: 'Белый щенок бишон фризе с розовыми бантиками на голубом фоне',
      en: 'A white Bichon Frise puppy with pink bows against a light-blue background',
    },
    { x: 0.5, y: 0.4 },
    { chapter: 'puppies', breeds: ['bichon'] },
  ),
  img(
    'years',
    'red-poodle-show-table',
    {
      he: 'פודל טוי אדמדם מטופח לתערוכה שוכב על שולחן',
      ru: 'Рыжий той-пудель в выставочном груминге лежит на столе',
      en: 'An apricot Toy Poodle in show trim lying on a table',
    },
    { x: 0.5, y: 0.3 },
    { chapter: 'table', breeds: ['poodle'] },
  ),
];

export const videos: MediaVideo[] = [
  {
    id: 'years/bichon-puppy-play',
    kind: 'video',
    set: 'years',
    orientation: 'portrait',
    hasAudio: true,
    duration: 18.5,
    year: 2026,
    chapter: 'puppies',
    breeds: ['bichon'],
    alt: {
      he: 'גור בישון פריזה משחק עם צעצוע על מזרן כחול',
      ru: 'Щенок бишон фризе играет с игрушкой на синем матрасе',
      en: 'A Bichon Frise puppy playing with a toy on a blue mat',
    },
    caption: { he: 'משחק בלול', ru: 'Игра в манеже', en: 'Playtime in the pen' },
  },
  {
    id: 'shows/poodle-ring-gait',
    kind: 'video',
    set: 'shows',
    orientation: 'landscape',
    hasAudio: true,
    duration: 13.6,
    year: 2026,
    chapter: 'ring',
    breeds: ['poodle'],
    alt: {
      he: 'פודל לבן נע ברצועה בזירת התערוכה',
      ru: 'Белый пудель движется на ринговке в выставочном ринге',
      en: 'A white Poodle moving on the lead in the show ring',
    },
    caption: { he: 'תנועה בזירה', ru: 'Движение в ринге', en: 'Movement in the ring' },
  },
  {
    id: 'shows/shih-tzu-ring-video',
    kind: 'video',
    set: 'shows',
    orientation: 'portrait',
    hasAudio: false,
    duration: 32.4,
    chapter: 'ring',
    breeds: ['shihtzu'],
    alt: {
      he: 'שיצו מוצג בזירה על שטיח אדום',
      ru: 'Ши-тцу показывают в ринге на красной дорожке',
      en: 'A Shih Tzu being shown in the ring on a red carpet',
    },
    caption: { he: 'שיצו בזירה', ru: 'Ши-тцу в ринге', en: 'Shih Tzu in the ring' },
  },
];

export const media: MediaItem[] = [...images, ...videos];
export const mediaById = new Map<string, MediaItem>(media.map((m) => [m.id, m]));

export function getImage(id: string): MediaImage {
  const m = mediaById.get(id);
  if (!m || m.kind !== 'image') throw new Error(`Unknown image media id: ${id}`);
  return m;
}
export function getVideo(id: string): MediaVideo {
  const m = mediaById.get(id);
  if (!m || m.kind !== 'video') throw new Error(`Unknown video media id: ${id}`);
  return m;
}
