import Link from "next/link";
import { ArrowRight, Mail, MapPin, NotebookPen, Phone } from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { LoyaltyBadge } from "@/components/customers/loyalty-badge";
import { buttonVariants } from "@/components/ui/button";
import type { CustomerEntry } from "@/domain/customers/directory";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";

/*
 * Grande carte d'un client (serveur) : identité et type (particulier ou
 * membre d'une communauté, en couleur), coordonnées en un geste, chiffres clés
 * tirés de ses commandes, fidélité d'un particulier, notes internes, et un
 * bouton dédié vers la fiche détaillée.
 */
export function CustomerCard({ entry }: { entry: CustomerEntry }) {
  const { customer, stats, loyalty } = entry;
  const notes = customer.notes.length;

  return (
    <article
      aria-label={`Client ${customer.fullName}`}
      className="bg-card text-card-foreground ring-foreground/10 card-lift flex h-full flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 @2xl/main:p-5"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "flex size-12 shrink-0 items-center justify-center rounded-full text-base font-semibold",
            customer.community
              ? "bg-community/15 text-community"
              : "bg-individual/15 text-individual",
          )}
        >
          {initials(customer.fullName)}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-lg leading-tight font-semibold [overflow-wrap:anywhere]">
            {customer.fullName}
          </h3>
          <ClientTypeLabel
            community={customer.community}
            className="self-start"
          />
          <span className="text-muted-foreground text-xs">
            Client depuis le {formatDateFr(customer.createdAt)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">
          <Mail className="size-4" aria-hidden="true" />
          <span className="sr-only">E-mail</span>
        </dt>
        <dd className="min-w-0 truncate">
          <a
            href={`mailto:${customer.email}`}
            className="underline-offset-4 hover:underline"
          >
            {customer.email}
          </a>
        </dd>
        <dt className="text-muted-foreground">
          <Phone className="size-4" aria-hidden="true" />
          <span className="sr-only">Téléphone</span>
        </dt>
        <dd>
          <a
            href={toTelHref(customer.phone)}
            className="tabular-nums underline-offset-4 hover:underline"
          >
            {customer.phone}
          </a>
        </dd>
        <dt className="text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          <span className="sr-only">Ville</span>
        </dt>
        <dd>
          {customer.postalCode} {customer.city}
        </dd>
      </dl>

      <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl p-3 text-center">
        <div>
          <dt className="text-muted-foreground text-xs">Commandes</dt>
          <dd className="text-lg font-bold tabular-nums">{stats.orderCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Dépensé</dt>
          <dd className="text-sm font-bold tabular-nums">
            {formatEuros(stats.totalSpentCents)}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Dernière</dt>
          <dd className="text-sm font-medium">
            {stats.lastDeliveryDate
              ? formatDateFr(stats.lastDeliveryDate)
              : "—"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {loyalty ? (
          <LoyaltyBadge status={loyalty} />
        ) : (
          <span className="text-muted-foreground">
            Remise de sa communauté, appliquée par l&apos;application
          </span>
        )}
        {notes > 0 ? (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <NotebookPen className="size-3.5" aria-hidden="true" />
            {notes} note{notes > 1 ? "s" : ""} interne{notes > 1 ? "s" : ""}
          </span>
        ) : null}
      </div>

      <div className="mt-auto border-t pt-3">
        <Link
          href={`/clients/${customer.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Voir le détail
          <span className="sr-only"> ({customer.fullName})</span>
          <ArrowRight />
        </Link>
      </div>
    </article>
  );
}
