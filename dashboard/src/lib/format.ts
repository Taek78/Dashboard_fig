/*
 * Formateurs d'affichage (fr-FR). Les données restent en centimes et en ISO ;
 * la conversion en texte se fait ici, au dernier moment.
 *
 * Pourquoi des fonctions pures : même entrée → même sortie, sans lire l'heure,
 * le fuseau ou l'état de l'app. Elles sont donc testables avec des valeurs
 * fixes, utilisables côté serveur comme côté client, et le rendu ne varie pas
 * d'une machine à l'autre. Le fuseau est fixé à Europe/Paris pour la même
 * raison : sans lui, serveur et navigateur pourraient afficher deux jours
 * différents (erreur d'hydratation).
 *
 * Les formateurs Intl sont construits une fois au chargement du module :
 * leur création est coûteuse, leur usage ne l'est pas.
 */
const euros = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const dateFr = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Europe/Paris",
});

/** Centimes entiers → montant en euros formaté. 2490 → "24,90 €" */
export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

/** Date ISO (courte ou complète) → jour abrégé, numéro, mois. "2026-09-08" → "mar. 8 sept." */
export function formatDateFr(iso: string): string {
  return dateFr.format(new Date(iso));
}

/** Créneau de livraison → date + plage horaire. { date, start: "09:00", end: "11:00" } → "mar. 8 sept., 09:00–11:00" */
export function formatSlot(slot: {
  date: string;
  start: string;
  end: string;
}): string {
  return `${formatDateFr(slot.date)}, ${slot.start}–${slot.end}`;
}
