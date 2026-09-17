import { ChefHat, Truck } from "lucide-react";
import { StaffAssignField } from "@/components/orders/staff-assign-field";
import {
  ASSIGNMENT_ROLE_LABELS,
  type AssignmentRole,
} from "@/domain/orders/assignment";
import type { Order } from "@/domain/orders/types";
import type { StaffOption } from "@/domain/staff/rules";
import { cn } from "@/lib/utils";

/*
 * Bloc « Équipe » d'une commande (serveur) : le préparateur et le livreur
 * affectés. Avec le droit d'affecter, deux listes déroulantes qui écrivent
 * aussitôt ; sinon, les noms en lecture, avec la gommette de présence (verte
 * = présent, rouge = absent) quand la personne est encore dans les options.
 * La gommette ne dit que la présence du jour, utile pour AFFECTER : sur une
 * commande terminée (livrée ou annulée), elle est grise (décision du client,
 * 2026-09-16).
 * Les champs ne sont pas remontés après une écriture : le <select> garde le
 * choix fait, et le message de résultat reste visible.
 */
export type AssignmentOptions = Record<AssignmentRole, StaffOption[]>;

/** Gommette en lecture : présent, absent, ou grise sur une commande terminée. */
const DOT_COLORS = {
  present: "bg-success",
  absent: "bg-destructive",
  done: "bg-muted-foreground/45",
} as const;

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
  /** Rôles affichés, dans l'ordre. */
  roles?: readonly AssignmentRole[];
}) {
  if (!canAssign) {
    const done = order.status === "delivered" || order.status === "cancelled";
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        {roles.map((role) => {
          const assigned = order[role];
          const option = assigned
            ? options[role].find((o) => o.id === assigned.id)
            : undefined;
          const present = option?.availability === "disponible";
          const dot = done
            ? assigned
              ? "done"
              : null
            : option
              ? present
                ? "present"
                : "absent"
              : null;
          return (
            <div key={role} className="contents">
              <dt className="text-muted-foreground flex items-center gap-1.5 [&_svg]:size-3.5">
                {ICONS[role]}
                {ASSIGNMENT_ROLE_LABELS[role]}
              </dt>
              <dd
                className={cn(
                  "flex items-center gap-1.5",
                  assigned ? "font-medium" : "text-muted-foreground",
                )}
              >
                {dot ? (
                  <span
                    aria-hidden="true"
                    data-presence={dot}
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      DOT_COLORS[dot],
                    )}
                  />
                ) : null}
                {assigned?.name ?? "Non affecté"}
                {dot && dot !== "done" ? (
                  <span className="sr-only">
                    {dot === "present" ? " (présent)" : " (absent)"}
                  </span>
                ) : null}
              </dd>
            </div>
          );
        })}
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
