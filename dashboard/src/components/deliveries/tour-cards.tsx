import { DeliveryCard } from "@/components/deliveries/delivery-card";
import type { Order } from "@/domain/orders/types";

/* Tournée du jour : une carte horizontale par commande, empilées dans l'ordre des créneaux. */
export function TourCards({
  orders,
  canChangeStatus,
}: {
  orders: Order[];
  canChangeStatus: boolean;
}) {
  return (
    <ul className="flex flex-col gap-4">
      {orders.map((order) => (
        <li key={order.id}>
          <DeliveryCard order={order} canChangeStatus={canChangeStatus} />
        </li>
      ))}
    </ul>
  );
}
