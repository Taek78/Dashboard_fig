import type { DirectoryStats } from "@/domain/customers/directory";
import type { TierEvent } from "@/domain/customers/tier";
import type {
  Bucket,
  DateRange,
  OrderStats,
  ProductPoint,
  SeriesPoint,
  StatusCounts,
} from "@/domain/metrics/rules";
import type { StaffAssignment } from "@/domain/orders/assignment";
import type { Page } from "@/domain/orders/rules";
import type {
  NewOrder,
  Order,
  OrderEvent,
  UpdatedOrder,
  OrderFilters,
  RefundChange,
  StatusChange,
} from "@/domain/orders/types";
import type { StaffWorkSummary } from "@/domain/staff/rules";
import type { KeysetPage, KeysetResult } from "@/lib/api/cursor";

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
 * Lectures (aucun écran ne charge un historique non borné) :
 * - getOrders : commandes complètes filtrées (recherche comprise), triées par
 *   créneau ; pour des listes bornées par nature (une tournée de 7 jours au
 *   plus) ou par `limit` (les plus proches d'abord).
 * - countOrders : le nombre de commandes qui passent les filtres ;
 *   getOrderStatusCounts : ce nombre par statut (barre d'avancement de la
 *   liste, toutes pages confondues), chaque statut présent, 0 compris.
 * - getOrdersPage : une page de la liste, les plus récentes d'abord ; filtre,
 *   recherche, compte et découpage faits par la base (pageWindow).
 * - getOrderStats, getOrderSeries, getTopProducts : les chiffres d'une période,
 *   agrégés par la base ; les arrondis restent ceux des règles pures
 *   (statsFromTotals, fillSeries, rankProducts). getDeliveryDayCounts : le
 *   nombre de livraisons de chaque jour d'une période.
 * - getStaffWorkSummaries, getStaffWorkSummary, getDirectoryStats : compteurs
 *   du personnel (toute l'équipe ou une personne) et chiffres de l'annuaire
 *   clients (tout l'annuaire, ou restreints à un client ou à une communauté),
 *   compteur fidélité et date de la dernière catégorie « fidèle » compris ;
 *   getCustomerTierEvents : l'historique daté des atteintes d'un client.
 *
 * Écritures (conditionnelles) :
 * - updateOrderStatus reçoit un StatusChange (statut relu, statut visé, acteur,
 *   motif d'annulation éventuel, notification à déposer) et ÉCRIT l'événement
 *   d'historique avec le statut, puis la notification si le client l'a
 *   autorisée (même transaction) ; null si `from` ne correspond plus.
 * - setOrderRefund enregistre (commande ANNULÉE, montant ≤ total, relus par la
 *   base) ou retire le remboursement ou l'avoir ; null si rien n'a été écrit.
 * - assignStaff pose ou retire le préparateur ou le livreur (la personne a déjà
 *   été relue et vérifiée par l'action) ; null (rien d'écrit) si la commande
 *   n'existe pas, si elle est terminée ou si la personne affectée n'est plus
 *   `expectedStaffId`.
 *
 * API de l'application (2026-09-17) :
 * - createOrder écrit une commande déjà calculée (NewOrder) et ses lignes en
 *   une transaction, attribue l'identifiant et la référence du jour de
 *   livraison (« FIG-AAMMJJ-NNN », unique : réessai sur collision) ;
 * - listCustomerOrders : « mes commandes », les plus récentes d'abord
 *   (création puis identifiant), page par CURSEUR (index composite).
 */
export type OrdersSource = {
  createOrder(input: NewOrder): Promise<Order>;
  listCustomerOrders(
    customerId: string,
    page: KeysetPage,
  ): Promise<KeysetResult<Order>>;
  getOrders(
    filters?: OrderFilters,
    options?: { limit?: number },
  ): Promise<Order[]>;
  countOrders(filters: OrderFilters): Promise<number>;
  getOrderStatusCounts(filters: OrderFilters): Promise<StatusCounts>;
  getOrdersPage(
    filters: OrderFilters,
    page: number,
    size?: number,
  ): Promise<Page<Order>>;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(
    id: string,
    change: StatusChange,
  ): Promise<UpdatedOrder | null>;
  getOrderEvents(orderId: string): Promise<OrderEvent[]>;
  assignStaff(id: string, assignment: StaffAssignment): Promise<Order | null>;
  setOrderRefund(id: string, change: RefundChange): Promise<Order | null>;
  getOrderStats(range: DateRange): Promise<OrderStats>;
  getOrderSeries(range: DateRange, bucket: Bucket): Promise<SeriesPoint[]>;
  getDeliveryDayCounts(range: DateRange): Promise<ReadonlyMap<string, number>>;
  getTopProducts(range: DateRange, limit: number): Promise<ProductPoint[]>;
  getStaffWorkSummaries(): Promise<ReadonlyMap<string, StaffWorkSummary>>;
  getStaffWorkSummary(staffId: string): Promise<StaffWorkSummary>;
  getDirectoryStats(
    scope?: Pick<OrderFilters, "customerId" | "communityId">,
  ): Promise<DirectoryStats>;
  getCustomerTierEvents(customerId: string): Promise<TierEvent[]>;
};
