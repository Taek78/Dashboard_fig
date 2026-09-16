import type { CommunityKind } from "@/domain/communities/kind";

/*
 * Types métier des communautés : le vocabulaire du FRONT (les lignes Postgres y
 * sont converties par src/db/mappers.ts). Une communauté est créée et gérée
 * par l'application FIG (adhésion des clients) ; le back-office la lit, liste
 * ses membres et ses commandes. Les commandes de ses membres sont livrées au
 * point de retrait, sans frais de livraison, et portent sa remise
 * (Order.community, Order.discount).
 *
 * Sources de vérité : l'application FIG. L'horaire de retrait est choisi par le
 * client à chaque commande (Order.deliverySlot) : une communauté n'a pas
 * d'heure fixe. Le taux de remise n'est pas stocké : il se déduit du nombre
 * de membres (communities/discount.ts) ; le montant réel est celui du paiement
 * dans l'application (Order.discount).
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
  active: boolean;
  /** ISO 8601. */
  createdAt: string;
};

/** Référence légère à une communauté, telle que portée par un client ou une commande. */
export type CommunityRef = { id: string; name: string };
