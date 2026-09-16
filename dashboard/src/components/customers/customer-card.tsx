import Link from "next/link";
import {
  ArrowRight,
  Mail,
  MapPin,
  NotebookPen,
  Percent,
  Phone,
  Sparkles,
} from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { ConsentPills } from "@/components/customers/consent-pills";
import { LoyaltyBadge } from "@/components/customers/loyalty-badge";
import { TierBadge } from "@/components/customers/tier-badge";
import { buttonVariants } from "@/components/ui/button";
import type { CustomerEntry } from "@/domain/customers/directory";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { initials } from "@/lib/text";
import { cn } from "@/lib/utils";

/*
 * Grande carte d'un client (serveur), en quatre bandes pour rester lisible
 * malgré tout ce qu'elle porte :
 *   1. identité : initiales teintées par le type, nom, catégorie (étoiles),
 *      type de client, ancienneté ;
 *   2. contact et adresse de livraison en un geste (e-mail, téléphone, rue) ;
 *   3. les trois autorisations, en pastilles ;
 *   4. chiffres clés, puis fidélité (compteur, prochaine remise) et notes.
 * Le code de parrainage et les filleuls ne sont PAS sur la carte : ils
 * n'apparaissent que dans la fiche (décision du client).
 */
export function CustomerCard({ entry }: { entry: CustomerEntry }) {
  const { customer, stats, loyalty, tier, nextDiscount } = entry;
  const notes = customer.notes.length;
  const anonymized = customer.anonymizedAt !== null;

  return (
    <article
      aria-label={`Client ${customer.fullName}`}
      className={cn(
        "bg-card text-card-foreground card-lift cv-auto flex h-full flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 @2xl/main:p-5",
        tier.tier === "loyal" ? "ring-loyal/40" : "ring-foreground/10",
      )}
    >
      {/* 1. Identité */}
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
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            <h3 className="text-lg leading-tight font-semibold [overflow-wrap:anywhere]">
              {customer.fullName}
            </h3>
            {anonymized ? null : <TierBadge state={tier} />}
          </div>
          <ClientTypeLabel
            community={customer.community}
            className="self-start"
          />
          <span className="text-muted-foreground text-xs">
            Client depuis le {formatDateFr(customer.createdAt)}
          </span>
        </div>
      </div>

      {/* 2. Contact et adresse */}
      {anonymized ? (
        <p className="text-muted-foreground text-sm">
          Données personnelles anonymisées le{" "}
          {formatDateFr(customer.anonymizedAt!)}.
        </p>
      ) : (
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
            <span className="sr-only">Adresse de livraison</span>
          </dt>
          <dd className="[overflow-wrap:anywhere]">
            {customer.addressLine ? `${customer.addressLine}, ` : ""}
            {customer.postalCode} {customer.city}
            {customer.community ? (
              <span className="text-muted-foreground">
                {" "}
                · livraison au point de retrait de sa communauté
              </span>
            ) : null}
          </dd>
        </dl>
      )}

      {/* 3. Autorisations */}
      {anonymized ? null : <ConsentPills consents={customer.consents} />}

      {/* 4. Chiffres, fidélité, notes */}
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
        <LoyaltyBadge status={loyalty} />
        {nextDiscount?.kind === "community" ? (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Percent className="size-3.5" aria-hidden="true" />
            Remise communauté −{nextDiscount.percent} %
          </span>
        ) : null}
        {nextDiscount?.kind === "loyalty" && entry.communityDiscountPercent ? (
          <span className="text-muted-foreground inline-flex items-center gap-1">
            <Sparkles className="size-3.5" aria-hidden="true" />
            remplace la remise communauté −{entry.communityDiscountPercent} %
          </span>
        ) : null}
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
