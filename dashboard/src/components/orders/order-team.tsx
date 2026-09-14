import { ChefHat, Truck } from "lucide-react";
import { StaffAssignField } from "@/components/orders/staff-assign-field";
import {
  ASSIGNMENT_ROLE_LABELS,
  type AssignmentRole,
} from "@/domain/orders/assignment";
import type { Order } from "@/domain/orders/types";
import type { StaffOption } from "@/domain/staff/rules";

/*
 * Bloc « Équipe » d'une commande (serveur) : le préparateur et le livreur
 * affectés. Avec le droit d'affecter, deux listes déroulantes qui écrivent
 * aussitôt ; sinon, les noms en lecture. Les champs ne sont pas remontés
 * après une écriture : le <select> garde le choix fait, et le message de
 * résultat reste visible.
 */
export type AssignmentOptions = Record<AssignmentRole, StaffOption[]>;

const ICONS: Record<AssignmentRole, React.ReactNode> = {
  preparer: <ChefHat />,
  driver: <Truck />,
};

export function OrderTeam({
  order,
  options,
  canAssign,
  roles = ["preparer", "driver"],
}: {
  order: Order;
  options: AssignmentOptions;
  canAssign: boolean;
  /** Rôles affichés, dans l'ordre : la tournée met le livreur en premier. */
  roles?: readonly AssignmentRole[];
}) {
  if (!canAssign) {
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {roles.map((role) => (
          <div key={role} className="contents">
            <dt className="text-muted-foreground flex items-center gap-1.5 [&_svg]:size-3.5">
              {ICONS[role]}
              {ASSIGNMENT_ROLE_LABELS[role]}
            </dt>
            <dd
              className={order[role] ? "font-medium" : "text-muted-foreground"}
            >
              {order[role]?.name ?? "Non affecté"}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Équipe de la commande ${order.reference}`}
      className="flex flex-col gap-2"
    >
      {roles.map((role) => (
        <StaffAssignField
          key={role}
          orderId={order.id}
          role={role}
          current={order[role]}
          options={options[role]}
          icon={ICONS[role]}
        />
      ))}
    </div>
  );
}
