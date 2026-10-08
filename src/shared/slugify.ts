const TRANSLITERATION: Record<string, string> = {
  ä: 'ae',
  ö: 'oe',
  ü: 'ue',
  ß: 'ss',
}

/**
 * URL segment from a menu label: German umlauts are transliterated (ä → ae, ß → ss),
 * other accents are dropped, everything else that is not a-z/0-9 becomes a single "-".
 */
export function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[äöüß]/g, (char) => TRANSLITERATION[char] ?? char)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
