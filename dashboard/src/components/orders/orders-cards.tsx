import { OrderCard } from "@/components/orders/order-card";
import type { Order } from "@/domain/orders/types";

/* Pile de cartes de commandes (serveur), même présentation que la tournée. */
export function OrdersCards({
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
          <OrderCard order={order} canChangeStatus={canChangeStatus} />
        </li>
      ))}
    </ul>
  );
}
