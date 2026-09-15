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

/** Vrai si la saisie ressemble à un numéro : chiffres, espaces, points, tirets ou +. */
export function isPhoneLike(text: string): boolean {
  return /^[\d\s.+-]+$/.test(text.trim());
}

/** Ne garde que les chiffres : "06 39 98 00 01" → "0639980001". */
export function digitsOnly(text: string): string {
  return text.replace(/\D/g, "");
}

/**
 * Motif SQL LIKE « contient » : "100%" → "%100\%%". Les caractères spéciaux de
 * LIKE (%, _ et l'échappement \) saisis restent du texte.
 */
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Initiales d'un nom pour un avatar : "Zaki Affane" → "ZA", "admin" → "A",
 * "  " → "?". Première lettre du premier et du dernier mot, en majuscules.
 */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.charAt(0) ?? "") : "";
  return (first + last).toUpperCase() || "?";
}
