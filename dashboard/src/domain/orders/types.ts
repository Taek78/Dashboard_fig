import type { OrderStatus } from "@/domain/orders/status";

/*
 * Types métier des commandes : le vocabulaire du FRONT.
 *
 * Pourquoi src/domain/<domaine>/ et pas src/types/ : tout ce qui concerne les
 * commandes (types, statuts, règles, fixtures, contrat) vit dans un seul dossier ;
 * un dossier types/ global finit toujours en fourre-tout.
 *
 * Ces types ne sont PAS le schéma de la base du client : ils seront mappés dessus
 * dans toOrder() (piste B3), jamais migrés vers elle. Le front ne change donc pas
 * quand le schéma réel est découvert.
 *
 * Conventions : dates en chaînes ISO (sérialisables, comparables par `<`, pas de
 * problème d'hydratation), montants en centimes entiers, quantités en unité de base.
 */
export type OrderLine = {
  productId: string;
  productName: string;
  quantity: number;
  unit: "piece" | "g";
  lineTotalCents: number;
};

export type Order = {
  id: string;
  reference: string;
  /** ISO 8601 avec fuseau, ex. "2026-09-07T08:15:00.000Z" */
  createdAt: string;
  status: OrderStatus;
  customer: { id: string; fullName: string; email: string; phone: string };
  /** date "AAAA-MM-JJ", heures "HH:mm" */
  deliverySlot: { date: string; start: string; end: string };
  deliveryCity: string;
  deliveryPostalCode: string;
  lines: OrderLine[];
  totalCents: number;
};

/*
 * Filtres de la liste, déjà validés (sortie de parseOrderFilters, jamais l'URL brute).
 * `date` est un jour de livraison "AAAA-MM-JJ" comparé à deliverySlot.date, pas à
 * createdAt : le gestionnaire cherche « les commandes à livrer tel jour ».
 * Chaque champ absent = pas de filtre sur ce critère.
 */
export type OrderFilters = {
  status?: OrderStatus;
  date?: string;
  /** Fiche client (A5) : commandes d'une personne. */
  customerId?: string;
};
