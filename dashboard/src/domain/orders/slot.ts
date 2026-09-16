/*
 * Créneau de livraison : UNE HEURE, sur l'heure pile, entre 10:00 et 20:00
 * (décisions du client, 2026-09-16) : de « 10:00 → 11:00 » à « 19:00 → 20:00 ».
 * Les contraintes orders_slot_one_hour et orders_slot_hours de la base
 * l'imposent à toute écriture, y compris celles de l'application FIG ; ces
 * fonctions disent la même règle pour les fixtures et les tests.
 */
export const DELIVERY_SLOT_MINUTES = 60;

/** Début du premier créneau et fin du dernier. */
export const DELIVERY_HOURS = { from: "10:00", to: "20:00" } as const;

const START = /^([01][0-9]|2[0-2]):00$/;

/** Fin du créneau qui commence à `start` ("14:00" → "15:00"). */
export function slotEndFor(start: string): string {
  const hour = Number(start.slice(0, 2));
  return `${String(hour + 1).padStart(2, "0")}:00`;
}

/** Les débuts de créneau possibles : "10:00", "11:00", …, "19:00". */
export const DELIVERY_SLOT_STARTS: readonly string[] = Array.from(
  {
    length:
      Number(DELIVERY_HOURS.to.slice(0, 2)) -
      Number(DELIVERY_HOURS.from.slice(0, 2)),
  },
  (_, i) =>
    `${String(Number(DELIVERY_HOURS.from.slice(0, 2)) + i).padStart(2, "0")}:00`,
);

/** Vrai pour un créneau d'une heure pile, de 00:00 à 22:00 au plus tard. */
export function isOneHourSlot(slot: { start: string; end: string }): boolean {
  return START.test(slot.start) && slot.end === slotEndFor(slot.start);
}

/** Vrai pour un créneau proposé par FIG : une heure pile, entre 10:00 et 20:00. */
export function isDeliverySlot(slot: { start: string; end: string }): boolean {
  return isOneHourSlot(slot) && DELIVERY_SLOT_STARTS.includes(slot.start);
}
