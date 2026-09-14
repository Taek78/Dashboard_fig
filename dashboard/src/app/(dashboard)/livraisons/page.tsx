import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { TourCards } from "@/components/deliveries/tour-cards";
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
import { getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canChangeOrderStatus } from "@/domain/auth/roles";
import {
  deliveryDates,
  summarizeTour,
  todayInParis,
} from "@/domain/deliveries/rules";
import { parseTourDate } from "@/domain/deliveries/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Tournée du jour : toutes les commandes livrées un jour donné (?date=, défaut :
 * aujourd'hui en Europe/Paris), en cartes de terrain (ordre de passage, appel,
 * itinéraire, geste suivant en un bouton) avec la progression de la tournée.
 * Composant serveur : lectures via les façades, compteurs purs.
 * Pas d'attribution de livreur (choix du client) : la tournée se pilote par le statut.
 */
export const metadata: Metadata = { title: "Livraisons" };

export default async function LivraisonsPage({
  searchParams,
}: PageProps<"/livraisons">) {
  const raw = await searchParams;
  const date = parseTourDate(raw) ?? todayInParis(new Date());

  const [orders, allOrders, user] = await Promise.all([
    getOrders({ date }),
    getOrders(),
    getCurrentUser(),
  ]);
  const summary = summarizeTour(orders);
  const dates = deliveryDates(allOrders);
  const plural = (n: number) => (n > 1 ? "s" : "");

  return (
    <>
      <PageHeader
        title="Livraisons"
        description="Tournée du jour : suivez chaque livraison et faites avancer son statut."
      />
      <div className="flex flex-col gap-4">
        <Form
          action="/livraisons"
          aria-label="Choix du jour"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <div className="grid gap-1.5 sm:w-48">
            <Label htmlFor="date">Jour de livraison</Label>
            <Input
              key={date}
              id="date"
              type="date"
              name="date"
              defaultValue={date}
              className="dark:scheme-dark"
            />
          </div>
          <Button type="submit" className="w-full sm:w-auto">
            Afficher
          </Button>
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

        <div className="flex flex-col gap-2">
          <p role="status" className="text-muted-foreground text-sm">
            {formatDateFr(date)} : {summary.total} commande
            {plural(summary.total)}
            {summary.total > 0
              ? ` · ${summary.toConfirm} à confirmer · ${summary.inProgress} en cours · ${summary.done} terminée${plural(summary.done)}`
              : ""}
          </p>
          {summary.total > 0 ? (
            <div
              role="progressbar"
              aria-label="Avancement de la tournée"
              aria-valuemin={0}
              aria-valuemax={summary.total}
              aria-valuenow={summary.done}
              className="bg-muted h-2 w-full max-w-md overflow-hidden rounded-full"
            >
              <div
                className="bg-gradient-brand h-full rounded-full transition-[width]"
                style={{
                  width: `${Math.round((summary.done / summary.total) * 100)}%`,
                }}
              />
            </div>
          ) : null}
        </div>

        {orders.length > 0 ? (
          <TourCards
            orders={orders}
            canChangeStatus={canChangeOrderStatus(user.role)}
          />
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-2xl border border-dashed">
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
