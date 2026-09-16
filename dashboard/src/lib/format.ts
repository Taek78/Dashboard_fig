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

const NBSP = "\u00A0";

const dayLongFr = new Intl.DateTimeFormat("fr-FR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "Europe/Paris",
});

const dateTimeFr = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Paris",
});

const kilos = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

/** Centimes entiers → montant en euros formaté. 2490 → "24,90 €" */
export function formatEuros(cents: number): string {
  return euros.format(cents / 100);
}

/** Date ISO (courte ou complète) → jour abrégé, numéro, mois. "2026-09-08" → "mar. 8 sept." */
export function formatDateFr(iso: string): string {
  return dateFr.format(new Date(iso));
}

/** Jour "AAAA-MM-JJ" → en-tête de tournée. "2026-09-07" → "lundi 7 septembre" */
export function formatDayLongFr(day: string): string {
  return dayLongFr.format(new Date(day));
}

/** Instant ISO → jour et heure de Paris. "2026-09-07T08:15:00.000Z" → "lun. 7 sept., 10:15" */
export function formatDateTimeFr(iso: string): string {
  return dateTimeFr.format(new Date(iso));
}

/**
 * Période de jours "AAAA-MM-JJ", bornes facultatives → texte.
 * ("2026-09-05", "2026-09-09") → "du sam. 5 sept. au mer. 9 sept." ;
 * même jour → "le lun. 7 sept." ; début seul → "depuis le …" ; fin seule →
 * "jusqu'au …" ; aucune borne → "".
 */
export function formatPeriodFr(from?: string, to?: string): string {
  if (from && to) {
    return from === to
      ? `le ${formatDateFr(from)}`
      : `du ${formatDateFr(from)} au ${formatDateFr(to)}`;
  }
  if (from) return `depuis le ${formatDateFr(from)}`;
  if (to) return `jusqu'au ${formatDateFr(to)}`;
  return "";
}

/** Créneau de livraison → date + plage horaire. { date, start: "09:00", end: "11:00" } → "mar. 8 sept., 09:00–11:00" */
export function formatSlot(slot: {
  date: string;
  start: string;
  end: string;
}): string {
  return `${formatDateFr(slot.date)}, ${slot.start}–${slot.end}`;
}

/**
 * Quantité en unité de base → texte lisible. 500 g → "500 g", 1500 g → "1,5 kg",
 * 1 pièce → "1 pièce", 3 → "3 pièces". Espace insécable pour ne jamais séparer le
 * nombre de son unité en fin de ligne. Union inline plutôt qu'un import de
 * OrderLine["unit"] : src/lib ne dépend pas du domaine.
 */
export function formatQuantity(quantity: number, unit: "piece" | "g"): string {
  if (unit === "piece") {
    const label = quantity > 1 ? "pièces" : "pièce";
    return `${quantity}${NBSP}${label}`;
  }
  if (quantity < 1000) {
    return `${quantity}${NBSP}g`;
  }
  return `${kilos.format(quantity / 1000)}${NBSP}kg`;
}

/**
 * Taille d'un fichier en octets → texte court. 0 → "0 o", 940 → "940 o",
 * 128 940 → "126 ko", 842 310 → "822 ko", 5 242 880 → "5 Mo". Unités binaires
 * (1 ko = 1024 o), comme les explorateurs de fichiers de Windows et de macOS :
 * l'équipe compare ce nombre à ce que son système affiche.
 */
export function formatFileSize(bytes: number): string {
  const units = ["o", "ko", "Mo", "Go"];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // Une décimale seulement sous 10 Mo/Go : « 1,5 Mo » informe, « 822,4 ko » non.
  const rounded =
    unit >= 2 && value < 10
      ? kilos.format(Math.round(value * 10) / 10)
      : String(Math.round(value));
  return `${rounded}${NBSP}${units[unit]}`;
}

/** Numéro affiché "06 39 98 00 01" → href "tel:+33639980001" (espaces retirés, 0 initial → +33). */
export function toTelHref(phone: string): string {
  const digits = phone.replace(/\s/g, "");
  const international = digits.startsWith("0")
    ? `+33${digits.slice(1)}`
    : digits;
  return `tel:${international}`;
}

/** Compteur de la liste filtrée. 0 → "0 commande", 1 → "1 commande", 5 → "5 commandes" */
export function formatOrdersCount(count: number): string {
  const label = count > 1 ? "commandes" : "commande";

  return `${count}${NBSP}${label}`;
}
