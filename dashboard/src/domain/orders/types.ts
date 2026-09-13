import type { Cancellation } from "@/domain/orders/cancellation";
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
  /** Motif communiqué au client quand la commande est annulée, sinon null. */
  cancellation: Cancellation | null;
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

/** Qui a fait le geste : l'utilisateur de la session, jamais un champ de formulaire. */
export type OrderActor = { id: string; name: string };

/*
 * Trace métier durable d'un changement de statut (2026-09-14) : qui, quand, de
 * quel statut à quel statut. Écrite par la source en même temps que le statut
 * (une transaction en base), lue par la fiche commande. Jamais modifiée.
 */
export type OrderEvent = {
  id: string;
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actor: OrderActor;
  /** Motif, seulement pour un passage à « annulée ». */
  cancellation: Cancellation | null;
  /** ISO 8601 avec fuseau. */
  at: string;
};

/** Ce que la Server Action transmet à la source pour changer un statut. */
export type StatusChange = {
  /** Statut RELU par l'action, jamais celui que le formulaire prétend. */
  from: OrderStatus;
  to: OrderStatus;
  actor: OrderActor;
  cancellation: Cancellation | null;
};
