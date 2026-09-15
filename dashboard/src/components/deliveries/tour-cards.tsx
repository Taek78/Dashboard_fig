import { DeliveryCard } from "@/components/deliveries/delivery-card";
import { TourProgress } from "@/components/deliveries/tour-progress";
import type { AssignmentOptions } from "@/components/orders/order-team";
import {
  nextStopIndex,
  tourProgress,
  type DayGroup,
} from "@/domain/deliveries/rules";
import { formatDayLongFr } from "@/lib/format";

/*
 * Tournées groupées par jour (serveur). Chaque jour a son en-tête : la date, le
 * nombre de livraisons et, quand la période couvre plusieurs jours, son propre
 * avancement. Les commandes arrivent triées par créneau (la source) : l'ordre
 * de passage est leur rang dans le jour, et la première non terminée du jour
 * est mise en avant.
 */
export function TourCards({
  groups,
  canChangeStatus,
  canAssign,
  options,
}: {
  groups: DayGroup[];
  canChangeStatus: boolean;
  canAssign: boolean;
  options: AssignmentOptions;
}) {
  const severalDays = groups.length > 1;

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => {
        const next = nextStopIndex(group.orders);
        const day = formatDayLongFr(group.date);
        const count = group.orders.length;
        const headingId = `jour-${group.date}`;
        return (
          <section
            key={group.date}
            aria-labelledby={headingId}
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-2 border-b pb-3 @xl/main:flex-row @xl/main:items-end @xl/main:justify-between @xl/main:gap-6">
              <h2
                id={headingId}
                className="text-lg font-semibold first-letter:uppercase"
              >
                {day}
                <span className="text-muted-foreground text-sm font-normal">
                  {" "}
                  · {count} livraison{count > 1 ? "s" : ""}
                </span>
              </h2>
              {severalDays ? (
                <div className="w-full @xl/main:w-72">
                  <TourProgress
                    progress={tourProgress(group.orders)}
                    label={`Avancement du ${day}`}
                    compact
                  />
                </div>
              ) : null}
            </div>
            <ul className="flex flex-col gap-4">
              {group.orders.map((order, index) => (
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
          </section>
        );
      })}
    </div>
  );
}
