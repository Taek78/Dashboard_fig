import type { CommunityRef } from "@/domain/communities/types";
import type { NotificationDraft } from "@/domain/notifications/types";
import type { StaffRef } from "@/domain/orders/assignment";
import type { Cancellation } from "@/domain/orders/cancellation";
import type { OrderDiscount } from "@/domain/orders/discount";
import type { OrderStatus } from "@/domain/orders/status";

/*
 * Types métier des commandes : le vocabulaire du FRONT.
 *
 * Pourquoi src/domain/<domaine>/ et pas src/types/ : tout ce qui concerne les
 * commandes (types, statuts, règles, fixtures, contrat) vit dans un seul dossier ;
 * un dossier types/ global finit toujours en fourre-tout.
 *
 * Ces types sont le vocabulaire du front ; les lignes Postgres y sont converties
 * par src/db/mappers.ts (toOrder), jamais renvoyées telles quelles.
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
  /** date "AAAA-MM-JJ", heures "HH:mm" ; créneau d'une heure (orders/slot.ts). */
  deliverySlot: { date: string; start: string; end: string };
  /**
   * Rue de livraison (instantané au moment de la commande) : celle du client,
   * ou le lieu de retrait pour une communauté ; null si l'application ne l'a
   * pas fournie, ou effacée par l'anonymisation RGPD.
   */
  deliveryAddressLine: string | null;
  deliveryCity: string;
  deliveryPostalCode: string;
  lines: OrderLine[];
  /**
   * Frais de livraison facturés par l'application (instantané ; barème dans
   * orders/delivery-fee.ts) ; 0 pour une communauté, livraison offerte.
   */
  deliveryFeeCents: number;
  /** Total dû : sous-total des lignes moins la remise, plus les frais de livraison. */
  totalCents: number;
  /** Motif communiqué au client quand la commande est annulée, sinon null. */
  cancellation: Cancellation | null;
  /** Communauté dont le client est membre : livraison au point de retrait. */
  community: CommunityRef | null;
  /**
   * Remise appliquée par l'application FIG au paiement (communauté ou
   * fidélité), sinon null. Source de vérité : le paiement dans l'application ;
   * le dashboard l'affiche et ne la calcule jamais.
   */
  discount: OrderDiscount | null;
  /** Préparateur affecté par l'équipe, sinon null. */
  preparer: StaffRef | null;
  /** Livreur affecté par l'équipe, sinon null. */
  driver: StaffRef | null;
};

/** Longueur maximale de la recherche libre (?q=) des commandes et des livraisons. */
export const ORDER_SEARCH_MAX_LENGTH = 100;

/** Valeur d'URL des filtres d'équipe pour « personne d'affecté » (?livreur=aucun). */
export const UNASSIGNED_FILTER = "aucun";

/*
 * Filtres des listes, déjà validés (sortie de parseOrderFilters, jamais l'URL brute).
 * `from` / `to` bornent le jour de livraison "AAAA-MM-JJ" (deliverySlot.date,
 * bornes incluses), pas createdAt : on cherche « les commandes à livrer entre
 * tel et tel jour ». `preparerId` / `driverId` : l'id d'une personne, ou null
 * pour « non affecté ». Chaque champ absent = pas de filtre sur ce critère.
 */
export type OrderFilters = {
  /** Référence, nom du client, e-mail, téléphone, ville ou code postal. */
  query?: string;
  status?: OrderStatus;
  from?: string;
  to?: string;
  preparerId?: string | null;
  driverId?: string | null;
  /** Fiche client : commandes d'une personne. */
  customerId?: string;
  /** Fiche communauté : commandes livrées à son point de retrait. */
  communityId?: string;
  /** Fiche personnel : commandes où la personne est préparateur OU livreur. */
  staffId?: string;
};

/** Qui a fait le geste : l'utilisateur de la session, jamais un champ de formulaire. */
export type OrderActor = { id: string; name: string };

/*
 * Trace métier durable d'un changement de statut : qui, quand, de
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
  /**
   * Notification à déposer pour le client (domain/notifications/rules.ts),
   * dans la même transaction que le statut, SEULEMENT s'il a autorisé les
   * notifications d'état de commande : la source relit ce consentement dans
   * la base, jamais l'action. null = rien à déposer.
   */
  notification: NotificationDraft | null;
};
