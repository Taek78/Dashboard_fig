/*
 * Message entre composants clients, dans l'onglet : le relevé des alertes
 * (AlertCenter) annonce combien de nouvelles commandes et de nouveaux
 * messages viennent d'arriver ; le menu (NavMain) illumine la section
 * concernée jusqu'à ce qu'on l'ouvre, et le bouton du menu porte un point
 * sur téléphone (NewItemsDot). Un CustomEvent sur window : aucun état
 * partagé à monter, aucune dépendance. Navigateur seulement.
 */
export const NEW_ITEMS_EVENT = "fig:nouveautes";

/** Les sections qu'une nouveauté illumine. */
export const LIT_SECTIONS = ["/commandes", "/messages"] as const;
export type LitSection = (typeof LIT_SECTIONS)[number];
export type NewItems = Partial<Record<LitSection, number>>;

export function announceNewItems(items: NewItems): void {
  if (Object.values(items).every((n) => !n)) return;
  window.dispatchEvent(
    new CustomEvent<NewItems>(NEW_ITEMS_EVENT, { detail: items }),
  );
}

/** Abonnement ; renvoie la fonction de désabonnement (pour un effet). */
export function onNewItems(handler: (items: NewItems) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<NewItems>).detail);
  window.addEventListener(NEW_ITEMS_EVENT, listener);
  return () => window.removeEventListener(NEW_ITEMS_EVENT, listener);
}

/** Ajoute des nouveautés à un compte courant, section par section. */
export function addNewItems(current: NewItems, items: NewItems): NewItems {
  const next: NewItems = { ...current };
  for (const section of LIT_SECTIONS) {
    const n = items[section] ?? 0;
    if (n > 0) next[section] = (next[section] ?? 0) + n;
  }
  return next;
}
