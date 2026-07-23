const COMBINING_DIACRITICS = /[̀-ͯ]/g;

/** Minúsculas y sin tildes — para matchear texto sin depender de cómo lo haya escrito el cliente. */
export function normalizeText(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(COMBINING_DIACRITICS, "");
}

/** ¿`candidate` contiene `query` como substring, ignorando mayúsculas y tildes? */
export function matchesQuery(candidate: string, query: string): boolean {
  return normalizeText(candidate).includes(normalizeText(query));
}
