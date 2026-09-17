import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { RECENT_DAYS, type DayCount } from "@/domain/deliveries/rules";
import { orderFiltersQuery } from "@/domain/orders/rules";
import type { OrderFilters } from "@/domain/orders/types";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Raccourcis des RECENT_DAYS derniers jours de livraison (serveur), sur leur
 * propre ligne dans la zone de dates des filtres des commandes : « Aujourd'hui »
 * EN PREMIER et toujours en évidence (teinte de marque : c'est le jour de la
 * tournée), puis les jours précédents du plus récent au plus ancien, chacun
 * avec son nombre de livraisons (compté par la base), et « Les 7 jours » pour
 * toute la semaine. Chaque lien garde la recherche et les autres filtres en
 * cours (orderFiltersQuery) : seul le jour change. Le jour affiché porte
 * aria-current ; un jour sans livraison reste cliquable, en retrait.
 */
const plural = (n: number) => (n > 1 ? "s" : "");

export function DeliveryDayShortcuts({
  days,
  today,
  weekStart,
  filters,
}: {
  /** Les derniers jours, du plus ancien au plus récent (recentDeliveryDaysFromCounts). */
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
      className="flex w-full min-w-0 flex-wrap items-center gap-1.5 text-sm"
    >
      {[...days].reverse().map((day) => {
        const current = singleDay === day.date;
        const isToday = day.date === today;
        return (
          <Link
            key={day.date}
            href={shortcut(day.date, day.date)}
            aria-current={current ? "date" : undefined}
            data-today={isToday ? "true" : undefined}
            className={cn(
              buttonVariants({
                size: "xs",
                variant: current ? "secondary" : "ghost",
              }),
              day.count === 0 && !current && "text-muted-foreground",
              isToday &&
                "bg-primary/12 text-primary ring-primary/35 hover:bg-primary/20 hover:text-primary font-semibold ring-1",
              isToday &&
                current &&
                "bg-primary text-primary-foreground ring-primary hover:bg-primary/90 hover:text-primary-foreground",
            )}
          >
            {isToday ? "Aujourd'hui" : formatDateFr(day.date)}
            <span
              className={cn(
                "rounded-full px-1.5 text-[0.7rem] leading-4 tabular-nums",
                isToday && current
                  ? "bg-primary-foreground/25"
                  : isToday
                    ? "bg-primary/15"
                    : "bg-muted text-foreground",
              )}
            >
              {day.count}
            </span>
            <span className="sr-only"> livraison{plural(day.count)}</span>
          </Link>
        );
      })}
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
    </nav>
  );
}
