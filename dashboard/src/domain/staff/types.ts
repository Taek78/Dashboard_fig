import type {
  Availability,
  Shift,
  StaffKind,
  Weekday,
} from "@/domain/staff/kind";

/*
 * Types métier du personnel : le vocabulaire du FRONT (les lignes Postgres y
 * sont converties par src/db/mappers.ts). Une personne de l'équipe du client :
 * livreur, préparateur de commandes ou gestionnaire. Ses affectations se
 * retrouvent sur les commandes (Order.preparer, Order.driver), jamais ici :
 * l'historique d'une personne se calcule à partir des commandes (staff/rules.ts).
 *
 * Les gestionnaires listés ici sont des personnes ; leur accès au back-office
 * (compte, mot de passe, rôle) se gère dans /comptes, indépendamment.
 * Coordonnées = données personnelles de l'équipe du client (RGPD).
 */
export type StaffMember = {
  id: string;
  kind: StaffKind;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shift: Shift;
  availability: Availability;
  /** Jours travaillés, dans l'ordre de la semaine. */
  workDays: Weekday[];
  /** "AAAA-MM-JJ", date d'entrée dans l'équipe. */
  startedAt: string;
  /** Véhicule, zone, remarques : texte libre borné, interne à l'équipe. */
  notes: string | null;
  /** Une personne partie reste dans l'historique mais n'est plus proposée. */
  active: boolean;
  /**
   * "AAAA-MM-JJ", date de sortie de l'entreprise : seulement pour une personne
   * partie (null sinon ; null aussi pour un départ antérieur à la migration
   * 0019, dont la date n'a jamais été saisie).
   */
  leftAt: string | null;
  /** ISO 8601. */
  createdAt: string;
};

/** Tout ce qu'un formulaire définit : StaffMember sans les champs posés par la source. */
export type StaffInput = Omit<StaffMember, "id" | "createdAt">;

/** Bornes de saisie (formulaires et zod). */
export const STAFF_NAME_MAX_LENGTH = 60;
export const STAFF_NOTES_MAX_LENGTH = 300;
/** Longueur maximale de la recherche dans l'équipe (?q=). */
export const STAFF_SEARCH_MAX_LENGTH = 64;
