/*
 * Créneau de livraison : UNE HEURE, sur l'heure pile (décision du client,
 * 2026-09-16), « 14:00 → 15:00 ». La contrainte orders_slot_one_hour de la
 * base l'impose à toute écriture, y compris celles de l'application FIG ; ces
 * fonctions disent la même règle pour les fixtures et les tests.
 */
export const DELIVERY_SLOT_MINUTES = 60;

const START = /^([01][0-9]|2[0-2]):00$/;

/** Fin du créneau qui commence à `start` ("14:00" → "15:00"). */
export function slotEndFor(start: string): string {
  const hour = Number(start.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00`;
}

/** Vrai pour un créneau d'une heure pile, de 00:00 à 22:00 au plus tard. */
export function isOneHourSlot(slot: { start: string; end: string }): boolean {
  return START.test(slot.start) && slot.end === slotEndFor(slot.start);
}
