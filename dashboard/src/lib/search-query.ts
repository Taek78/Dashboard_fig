/*
 * Règles pures de la recherche automatique (AutoSubmitForm), testées dans
 * test/lib/search-query.test.ts.
 */

/**
 * Champs d'un formulaire → chaîne de requête : valeurs texte seulement,
 * espaces de bord retirés, champs vides omis (URL propre ; « benali » et
 * « benali␣ » donnent la même URL, donc une seule navigation).
 */
export function searchQueryFrom(
  entries: Iterable<[string, FormDataEntryValue]>,
): string {
  const params = new URLSearchParams();
  for (const [name, value] of entries) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed !== "") params.append(name, trimmed);
  }
  return params.toString();
}

/**
 * L'URL affichée vient de changer : est-ce l'une de NOS recherches (encore en
 * attente) ou une navigation extérieure (lien « Réinitialiser », raccourci,
 * retour arrière) ?
 * - la nôtre : elle et les demandes plus anciennes sont soldées (le routeur
 *   abandonne une navigation doublée par une plus récente, elles n'arriveront
 *   jamais) ; les champs gardent la saisie en cours ;
 * - extérieure : plus rien n'est en attente, les champs doivent reprendre les
 *   valeurs de la nouvelle URL.
 */
export function settleRequests(
  pending: readonly string[],
  current: string,
): { pending: string[]; external: boolean } {
  const index = pending.indexOf(current);
  return index === -1
    ? { pending: [], external: true }
    : { pending: pending.slice(index + 1), external: false };
}
