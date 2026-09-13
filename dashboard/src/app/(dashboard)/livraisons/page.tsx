import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { TourTable } from "@/components/deliveries/tour-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getAssignments, getCouriers } from "@/data/deliveries";
import { getOrders } from "@/data/orders";
import {
  buildTour,
  countUnassigned,
  deliveryDates,
  todayInParis,
} from "@/domain/deliveries/rules";
import { parseTourDate } from "@/domain/deliveries/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Tournée du jour : toutes les commandes livrées un jour donné (?date=, défaut :
 * aujourd'hui en Europe/Paris) avec leur livreur, et l'attribution en ligne.
 * Composant serveur : trois lectures via les façades, croisement par buildTour().
 * Les raccourcis « jours avec des commandes » évitent de chercher à l'aveugle.
 */
export const metadata: Metadata = { title: "Livraisons" };

export default async function LivraisonsPage({
  searchParams,
}: PageProps<"/livraisons">) {
  const raw = await searchParams;
  const date = parseTourDate(raw) ?? todayInParis(new Date());

  const [orders, assignments, couriers, allOrders] = await Promise.all([
    getOrders({ date }),
    getAssignments(date),
    getCouriers(),
    getOrders(),
  ]);
  const tour = buildTour(orders, assignments, couriers);
  const unassigned = countUnassigned(tour);
  const dates = deliveryDates(allOrders);

  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournée du jour et attribution des livreurs."
      />
      <div className="flex flex-col gap-4">
        <Form
          action="/livraisons"
          aria-label="Choix du jour"
          className="flex flex-col gap-3 md:flex-row md:items-end"
        >
          <div className="grid gap-1.5 md:w-48">
            <Label htmlFor="date">Jour de livraison</Label>
            <Input
              id="date"
              type="date"
              name="date"
              defaultValue={date}
              className="dark:scheme-dark"
            />
          </div>
          <Button type="submit">Afficher</Button>
        </Form>

        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            Jours avec des commandes :
          </span>
          {dates.map((d) => (
            <Button
              key={d}
              size="xs"
              variant={d === date ? "secondary" : "ghost"}
              render={<Link href={`/livraisons?date=${d}`} />}
            >
              {formatDateFr(d)}
            </Button>
          ))}
        </div>

        <p role="status" className="text-muted-foreground text-sm">
          {formatDateFr(date)} : {tour.length} commande
          {tour.length > 1 ? "s" : ""}
          {tour.length > 0 ? `, ${unassigned} sans livreur` : ""}
        </p>

        {tour.length > 0 ? (
          <TourTable tour={tour} couriers={couriers} date={date} />
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
              >
                <CalendarX2 />
              </EmptyMedia>
              <EmptyTitle>Aucune livraison ce jour</EmptyTitle>
              <EmptyDescription>
                Choisissez un autre jour ou l&apos;un des raccourcis ci-dessus.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  );
}
