import { DeliveryCard } from "@/components/deliveries/delivery-card";
import type { AssignmentOptions } from "@/components/orders/order-team";
import { nextStopIndex } from "@/domain/deliveries/rules";
import type { Order } from "@/domain/orders/types";

/*
 * Liste verticale de la tournée (serveur) : les commandes arrivent déjà triées
 * par créneau (la source), l'ordre de passage est leur rang ; la première non
 * terminée est mise en avant.
 */
export function TourCards({
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
  const next = nextStopIndex(orders);
  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order, index) => (
        <li key={order.id}>
          <DeliveryCard
            order={order}
            position={index + 1}
            isNext={index === next}
            canChangeStatus={canChangeStatus}
            canAssign={canAssign}
            options={options}
          />
        </li>
      ))}
    </ul>
  );
}
