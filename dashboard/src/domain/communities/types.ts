import type { CommunityKind } from "@/domain/communities/kind";

/*
 * Types métier des communautés : le vocabulaire du FRONT (les lignes Postgres y
 * sont converties par src/db/mappers.ts). Une communauté est créée et gérée
 * par l'application FIG (adhésion des clients, remise) ; le back-office la
 * lit, liste ses membres et ses commandes. Les commandes de ses membres sont
 * livrées au point de retrait et portent sa remise (Order.community,
 * Order.discount).
 */
export type Community = {
  id: string;
  name: string;
  kind: CommunityKind;
  /** Personne référente côté communauté (données personnelles). */
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  /** Où les membres récupèrent leurs produits : « Hall d'accueil de la crèche ». */
  pickupPlace: string;
  pickupCity: string;
  pickupPostalCode: string;
  /** "HH:mm", heure de retrait convenue. */
  pickupTime: string;
  /** Remise décidée et appliquée par l'application, en pourcentage entier. */
  discountPercent: number;
  active: boolean;
  /** ISO 8601. */
  createdAt: string;
};

/** Référence légère à une communauté, telle que portée par un client ou une commande. */
export type CommunityRef = { id: string; name: string };
