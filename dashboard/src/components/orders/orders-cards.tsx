import { Suspense } from "react";
import { OrderCard } from "@/components/orders/order-card";
import type { AssignmentOptions } from "@/components/orders/order-team";
import type { Order } from "@/domain/orders/types";

/*
 * Pile de cartes de commandes (serveur), même présentation que la tournée.
 * Chaque carte est dans sa propre frontière Suspense (audit du 2026-09-17) :
 * rien n'est différé au rendu (le contenu est déjà là), mais React hydrate
 * alors les cartes une par une, en cédant la main entre deux, au lieu d'une
 * seule tâche de plusieurs centaines de millisecondes sur téléphone pour les
 * quarante cartes et leurs cent vingt formulaires ; une carte touchée est
 * hydratée en priorité.
 */
export function OrdersCards({
  orders,
  canChangeStatus,
  canAssign,
  options,
}: {
  orders: Order[];
  canChangeStatus: boolean;
  canAssign: boolean;
  options: AssignmentOptions;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li key={order.id}>
          <Suspense>
            <OrderCard
              order={order}
              canChangeStatus={canChangeStatus}
              canAssign={canAssign}
              options={options}
            />
          </Suspense>
        </li>
      ))}
    </ul>
  );
}
