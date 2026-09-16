import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { RECENT_DAYS, type DayCount } from "@/domain/deliveries/rules";
import { orderFiltersQuery } from "@/domain/orders/rules";
import type { OrderFilters } from "@/domain/orders/types";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Raccourcis des RECENT_DAYS derniers jours de livraison (serveur), hérités
 * de l'ancienne section Livraisons : un bouton par jour avec son nombre de
 * livraisons (compté par la base), « Aujourd'hui » en dernier, et « Les 7
 * jours » pour toute la semaine. Chaque lien garde la recherche et les
 * autres filtres en cours (orderFiltersQuery) : seul le jour change. Le jour
 * affiché porte aria-current ; un jour sans livraison reste cliquable, en
 * retrait.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

export function DeliveryDayShortcuts({
  days,
  today,
  weekStart,
  filters,
}: {
  days: readonly DayCount[];
  today: string;
  weekStart: string;
  filters: OrderFilters;
}) {
  const shortcut = (from: string, to: string) =>
    `/commandes?${orderFiltersQuery({ ...filters, from, to })}`;
  const singleDay =
    filters.from !== undefined && filters.from === filters.to
      ? filters.from
      : null;
  const isWeek = filters.from === weekStart && filters.to === today;

  return (
    <nav
      aria-label={`${RECENT_DAYS} derniers jours`}
      className="bg-card/60 ring-foreground/10 flex flex-wrap items-center gap-1.5 rounded-xl px-3 py-2 text-sm ring-1"
    >
      <span className="text-muted-foreground mr-1 flex items-center gap-1.5">
        <CalendarDays className="size-4" aria-hidden="true" />
        {RECENT_DAYS} derniers jours :
      </span>
      <Link
        href={shortcut(weekStart, today)}
        aria-current={isWeek ? "true" : undefined}
        className={buttonVariants({
          size: "xs",
          variant: isWeek ? "secondary" : "outline",
        })}
      >
        Les {RECENT_DAYS} jours
      </Link>
      {days.map((day) => {
        const current = singleDay === day.date;
        return (
          <Link
            key={day.date}
            href={shortcut(day.date, day.date)}
            aria-current={current ? "date" : undefined}
            className={cn(
              buttonVariants({
                size: "xs",
                variant: current ? "secondary" : "ghost",
              }),
              day.count === 0 && !current && "text-muted-foreground",
            )}
          >
            {day.date === today ? "Aujourd'hui" : formatDateFr(day.date)}
            <span className="bg-muted text-foreground rounded-full px-1.5 text-[0.7rem] leading-4 tabular-nums">
              {day.count}
            </span>
            <span className="sr-only"> livraison{plural(day.count)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
