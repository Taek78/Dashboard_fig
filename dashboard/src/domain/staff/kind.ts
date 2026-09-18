/*
 * Vocabulaire du personnel : trois métiers, cinq créneaux de travail (dont
 * « 24 h/24 », sans horaire fixe), quatre disponibilités (dont « Arrêt
 * maladie », 2026-09-18) et les jours de la semaine. Clés anglaises ou françaises sans
 * accent (identifiants de code), libellés français (interface). Les enums
 * Postgres staff_kind, staff_shift et staff_availability reprennent ces clés
 * (test/db/schema.test.ts le vérifie).
 */
export const STAFF_KINDS = ["livreur", "preparateur", "gestionnaire"] as const;
export type StaffKind = (typeof STAFF_KINDS)[number];

export const STAFF_KIND_LABELS: Record<StaffKind, string> = {
  livreur: "Livreur",
  preparateur: "Préparateur de commandes",
  gestionnaire: "Gestionnaire",
};

/** Pluriel des onglets et des compteurs. */
export const STAFF_KIND_PLURALS: Record<StaffKind, string> = {
  livreur: "Livreurs",
  preparateur: "Préparateurs de commandes",
  gestionnaire: "Gestionnaires",
};

export const SHIFTS = [
  "matin",
  "apres_midi",
  "soir",
  "journee",
  "h24",
] as const;
export type Shift = (typeof SHIFTS)[number];

export const SHIFT_LABELS: Record<Shift, string> = {
  matin: "Matin (6 h – 14 h)",
  apres_midi: "Après-midi (13 h – 21 h)",
  soir: "Soir (16 h – 22 h)",
  journee: "Journée (9 h – 18 h)",
  h24: "24 h/24 (sans horaire fixe)",
};

export const AVAILABILITIES = [
  "disponible",
  "indisponible",
  "conge",
  "arret_maladie",
] as const;
export type Availability = (typeof AVAILABILITIES)[number];

export const AVAILABILITY_LABELS: Record<Availability, string> = {
  disponible: "Disponible",
  indisponible: "Indisponible",
  conge: "En congé",
  arret_maladie: "Arrêt maladie",
};

export const WEEKDAYS = [
  "lun",
  "mar",
  "mer",
  "jeu",
  "ven",
  "sam",
  "dim",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  lun: "Lundi",
  mar: "Mardi",
  mer: "Mercredi",
  jeu: "Jeudi",
  ven: "Vendredi",
  sam: "Samedi",
  dim: "Dimanche",
};
