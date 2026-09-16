import "server-only";
import { ordersDb } from "@/data/orders.db";
import type { OrdersSource } from "@/domain/orders/source";

/*
 * FAÇADE des commandes : le seul module que le front (pages, Server Actions)
 * importe. L'implémentation est PostgreSQL (orders.db.ts, et
 * orders-aggregates.db.ts pour les chiffres agrégés) ; la façade fixe le
 * contrat OrdersSource et `server-only` (un composant client qui l'importerait
 * casse le build).
 */
export const {
  getOrders,
  countOrders,
  getOrdersPage,
  getOrder,
  updateOrderStatus,
  getOrderEvents,
  assignStaff,
  getOrderStats,
  getOrderSeries,
  getDeliveryDayCounts,
  getTopProducts,
  getStaffWorkSummaries,
  getStaffWorkSummary,
  getDirectoryStats,
  getCustomerTierEvents,
}: OrdersSource = ordersDb;
