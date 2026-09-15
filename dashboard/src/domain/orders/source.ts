import type { DirectoryStats } from "@/domain/customers/directory";
import type {
  Bucket,
  DateRange,
  OrderStats,
  ProductPoint,
  SeriesPoint,
} from "@/domain/metrics/rules";
import type { StaffAssignment } from "@/domain/orders/assignment";
import type { Page } from "@/domain/orders/rules";
import type {
  Order,
  OrderEvent,
  OrderFilters,
  StatusChange,
} from "@/domain/orders/types";
import type { StaffWorkSummary } from "@/domain/staff/rules";

/*
 * CONTRAT des commandes, implémenté par PostgreSQL (src/data/orders.db.ts et
 * src/data/orders-aggregates.db.ts).
 *
 * Pourquoi le contrat vit dans src/domain et pas dans src/data : le domaine déclare
 * ce dont le front a besoin, src/data l'implémente. Ce fichier ne contient que des
 * types, jamais de fonction.
 *
 * Choix : async ; `null` pour « introuvable » (cas métier normal, pas une panne,
 * et `strict` force l'appelant à le traiter, ce qu'un throw ne fait pas).
 *
 * Lectures :
 * - getOrders : commandes complètes filtrées (recherche comprise), triées par
 *   créneau ; pour des listes bornées (une tournée, un client, une personne).
 * - getOrdersPage : une page de la liste, les plus récentes d'abord ; filtre,
 *   recherche, compte et découpage faits par la base (pageWindow).
 * - getOrderStats, getOrderSeries, getTopProducts : les chiffres d'une période,
 *   agrégés par la base ; les arrondis restent ceux des règles pures
 *   (statsFromTotals, fillSeries, rankProducts).
 * - getStaffWorkSummaries, getDirectoryStats : compteurs du personnel et
 *   chiffres de l'annuaire clients, agrégés par la base.
 *
 * Écritures (conditionnelles) :
 * - updateOrderStatus reçoit un StatusChange (statut relu, statut visé, acteur,
 *   motif d'annulation éventuel) et ÉCRIT l'événement d'historique avec le statut
 *   (même transaction) ; null si `from` ne correspond plus.
 * - assignStaff pose ou retire le préparateur ou le livreur (la personne a déjà
 *   été relue et vérifiée par l'action) ; null (rien d'écrit) si la commande
 *   n'existe pas, si elle est terminée ou si la personne affectée n'est plus
 *   `expectedStaffId`.
 */
export type OrdersSource = {
  getOrders(filters?: OrderFilters): Promise<Order[]>;
  getOrdersPage(
    filters: OrderFilters,
    page: number,
    size?: number,
  ): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, change: StatusChange): Promise<Order | null>;
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  assignStaff(id: string, assignment: StaffAssignment): Promise<Order | null>;
  getOrderStats(range: DateRange): Promise<OrderStats>;
  getOrderSeries(range: DateRange, bucket: Bucket): Promise<SeriesPoint[]>;
  getTopProducts(range: DateRange, limit: number): Promise<ProductPoint[]>;
  getStaffWorkSummaries(): Promise<ReadonlyMap<string, StaffWorkSummary>>;
  getDirectoryStats(): Promise<DirectoryStats>;
};
