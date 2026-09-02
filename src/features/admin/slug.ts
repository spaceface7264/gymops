/**
 * Slugs are used in URLs and must be unique; `name` is what people read.
 * æ, ø and å are letters, not accented vowels — NFD leaves them intact and the
 * ASCII filter would eat them, so "Aalborg Øst" needs the Danish spellings.
 */
export function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'oe')
    .replace(/å/g, 'aa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}
