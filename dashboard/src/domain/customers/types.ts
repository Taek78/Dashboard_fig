import type { CommunityRef } from "@/domain/communities/types";

/*
 * Types métier des clients : le vocabulaire du FRONT (les lignes Postgres y sont
 * converties par src/db/mappers.ts). Les commandes d'un client se retrouvent par
 * `customer.id` dans les Order (croisement fait par la page, via
 * OrderFilters.customerId).
 *
 * Les notes internes sont écrites par l'équipe et ne sont jamais visibles de la
 * personne concernée ; elles restent des données personnelles au sens du RGPD.
 */
export type CustomerNote = {
  id: string;
  text: string;
  authorName: string;
  /** ISO 8601 */
  createdAt: string;
};

export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  city: string;
  postalCode: string;
  /** ISO 8601, date de création du compte */
  createdAt: string;
  /** Communauté dont la personne est membre (adhésion gérée par l'application), sinon null. */
  community: CommunityRef | null;
  notes: CustomerNote[];
};

/*
 * Filtres de la liste, déjà validés (parseCustomerSearch). `membership` sépare
 * les particuliers (sans communauté) des membres d'une communauté ;
 * `communityId` restreint à une communauté précise (fiche communauté).
 */
export type CustomerFilters = {
  query?: string;
  membership?: "individual" | "community";
  communityId?: string;
};

/** Longueur maximale d'une note interne (formulaire et zod). */
export const NOTE_MAX_LENGTH = 500;
