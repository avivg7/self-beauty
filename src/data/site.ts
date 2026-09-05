/**
 * Business facts. Self Beauty was established in 2014 (matches the logo); the owner's professional canine
 * education year is 2016 — keep the two distinct.
 * Everything here was supplied by the owner or verified; nothing is invented.
 * Empty strings are deliberate TODOs and render as nothing (never as a fake link).
 */
export const site = {
  name: 'Self Beauty',
  established: 2014,
  ownerEducationYear: 2016,
  city: { he: 'בת ים', ru: 'Бат-Ям', en: 'Bat Yam' },
  country: { he: 'ישראל', ru: 'Израиль', en: 'Israel' },
  phone: {
    display: '054-678-1020',
    e164: '+972546781020',
    tel: 'tel:+972546781020',
    international: '+972 54 678 1020',
  },
  whatsapp: {
    number: '972546781020',
    base: 'https://wa.me/972546781020',
  },
  facebook: 'https://www.facebook.com/share/1HHNuHMq8z/?mibextid=wwXIfr',
  /** TODO-002: official kennel club / association page. Leave empty until a verified URL is supplied. */
  kennelClubUrl: '',
  kennelClubName: '',
  /** TODO-005: owner's public display name, if she wants it shown. */
  ownerDisplayName: '',
  breeds: ['yorkshire', 'poodle', 'bichon', 'pomeranian', 'shihtzu'] as const,
  geo: { lat: 32.0231, lng: 34.7503 }, // Bat Yam city centre (approximate, city-level only)
} as const;

export const includeDemo = import.meta.env.SB_INCLUDE_DEMO === '1' || import.meta.env.DEV;
