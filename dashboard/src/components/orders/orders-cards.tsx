import { OrderCard } from "@/components/orders/order-card";
import type { AssignmentOptions } from "@/components/orders/order-team";
import type { Order } from "@/domain/orders/types";

/* Pile de cartes de commandes (serveur), même présentation que la tournée. */
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
          <OrderCard
            order={order}
            canChangeStatus={canChangeStatus}
            canAssign={canAssign}
            options={options}
          />
        </li>
      ))}
    </ul>
  );
}
