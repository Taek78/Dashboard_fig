/*
 * Utilitaires texte purs, partagés par les domaines (catalogue, clients).
 */

/** Sans accents, ligatures ni majuscules : "Pêche" → "peche", "cœur" → "coeur". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .toLowerCase()
    .trim();
}

/** Ne garde que les chiffres : "06 39 98 00 01" → "0639980001". */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}
