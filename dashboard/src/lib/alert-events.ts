import type { UnreadCounts } from "@/domain/alerts/types";

/*
 * Messages entre composants clients, dans l'onglet, par CustomEvent sur
 * window (aucun état partagé à monter, aucune dépendance) :
 * - UNREAD : le relevé des alertes (AlertCenter) publie à chaque relevé les
 *   compteurs non lus calculés par le serveur ; le menu (NavMain) les affiche
 *   à côté de Commandes, Messages et Catalogue, le bouton du menu porte un
 *   point sur téléphone (NewItemsDot) ;
 * - SEEN : le menu vient d'enregistrer la visite d'une section ; le relevé
 *   repart aussitôt, pour que les compteurs suivent sans attendre 5 s.
 * `polledAt` est l'instant (horloge du navigateur) où le relevé est PARTI :
 * un relevé parti avant une visite enregistrée ne rallume pas son compteur.
 * Navigateur seulement.
 */
export const UNREAD_EVENT = "fig:non-lus";
export const SEEN_EVENT = "fig:vu";

export type UnreadUpdate = { counts: UnreadCounts; polledAt: number };

export function announceUnread(update: UnreadUpdate): void {
  window.dispatchEvent(
    new CustomEvent<UnreadUpdate>(UNREAD_EVENT, { detail: update }),
  );
}

/** Abonnement ; renvoie la fonction de désabonnement (pour un effet). */
export function onUnread(handler: (update: UnreadUpdate) => void): () => void {
  const listener = (event: Event) =>
    handler((event as CustomEvent<UnreadUpdate>).detail);
  window.addEventListener(UNREAD_EVENT, listener);
  return () => window.removeEventListener(UNREAD_EVENT, listener);
}

export function announceSeen(): void {
  window.dispatchEvent(new Event(SEEN_EVENT));
}

export function onSeen(handler: () => void): () => void {
  window.addEventListener(SEEN_EVENT, handler);
  return () => window.removeEventListener(SEEN_EVENT, handler);
}

/**
 * Les compteurs à afficher : ceux du relevé, sauf pour un fil dont la visite
 * a été enregistrée APRÈS le départ de ce relevé (il était déjà en route avec
 * l'ancien compte) : celui-là reste à 0 jusqu'au relevé suivant.
 */
export function visibleUnread(
  update: UnreadUpdate,
  seenAt: Partial<Record<keyof UnreadCounts, number>>,
): UnreadCounts {
  const keep = (kind: keyof UnreadCounts) =>
    (seenAt[kind] ?? 0) > update.polledAt ? 0 : update.counts[kind];
  return {
    orders: keep("orders"),
    messages: keep("messages"),
    stock: keep("stock"),
  };
}
