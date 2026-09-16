import type { CommunityRef } from "@/domain/communities/types";

/*
 * Types métier des clients : le vocabulaire du FRONT (les lignes Postgres y
 * sont converties par src/db/mappers.ts). Les commandes d'un client se retrouvent par
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

/*
 * Autorisations données par la personne DANS L'APPLICATION FIG (décision du
 * client, 2026-09-16) ; le dashboard les lit et ne les modifie jamais.
 * `updatedAt` date le dernier choix : c'est la preuve du consentement (RGPD,
 * article 7.1), posée par l'application.
 */
export type CustomerConsents = {
  /** Notifications d'offres, promotions et liquidations. */
  offers: boolean;
  /** Notification à chaque changement d'état de sa commande (file déposée par le dashboard). */
  orderStatus: boolean;
  /** Communications marketing. */
  marketing: boolean;
  /** ISO 8601, sinon null si l'application n'a rien daté. */
  updatedAt: string | null;
};

/** Le parrain d'un client, tel que porté par sa fiche. */
export type ReferrerRef = { id: string; fullName: string };

/** Un filleul, dans la liste de la fiche de son parrain. */
export type CustomerReferral = {
  id: string;
  fullName: string;
  /** ISO 8601 : création du compte du filleul, donc date du parrainage. */
  createdAt: string;
};

export type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  /** Rue de livraison (« 12 rue des Lilas ») ; null si inconnue ou anonymisée. */
  addressLine: string | null;
  city: string;
  postalCode: string;
  /** ISO 8601, date de création du compte */
  createdAt: string;
  /** Communauté dont la personne est membre (adhésion gérée par l'application), sinon null. */
  community: CommunityRef | null;
  consents: CustomerConsents;
  /** Code de parrainage « Nom#0000 » (customers/referral.ts) ; null une fois anonymisé. */
  referralCode: string | null;
  /** Client dont le code a été saisi à l'inscription, sinon null. */
  referredBy: ReferrerRef | null;
  notes: CustomerNote[];
  /**
   * ISO 8601 : date de l'anonymisation RGPD (identité, coordonnées et notes
   * effacées, commandes conservées ; domain/privacy/anonymization.ts), sinon null.
   */
  anonymizedAt: string | null;
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
