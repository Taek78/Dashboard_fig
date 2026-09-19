import {
  ArrowRight,
  Clock,
  MapPin,
  Percent,
  Phone,
  Truck,
  Users,
} from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { CommunityBanner } from "@/components/customers/community-banner";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { HoverPrefetchLink } from "@/components/ui/hover-prefetch-link";
import { nextCommunityDiscountTier } from "@/domain/communities/discount";
import type { CommunityEntry } from "@/domain/customers/directory";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Grande carte d'une communauté (serveur) : bandeau du type et de la
 * visibilité en tête, remise déduite du nombre de
 * membres et livraison offerte, point de retrait, contact, chiffres (membres,
 * commandes, remises accordées) et un bouton dédié vers la fiche. L'horaire
 * de retrait n'appartient pas à la communauté : chaque membre le choisit à la
 * commande, dans l'application.
 */
export function CommunityDiscountBadges({
  memberCount,
  discountPercent,
}: {
  memberCount: number;
  discountPercent: number;
}) {
  const next = nextCommunityDiscountTier(memberCount);
  return (
    <div className="flex flex-wrap gap-1.5">
      {discountPercent > 0 ? (
        <Badge variant="success" className="h-auto whitespace-normal">
          <Percent aria-hidden="true" />
          {`−${discountPercent} % sur chaque commande`}
        </Badge>
      ) : (
        <Badge variant="outline" className="h-auto whitespace-normal">
          <Percent aria-hidden="true" />
          Pas encore de remise
        </Badge>
      )}
      <Badge variant="secondary" className="h-auto whitespace-normal">
        <Truck aria-hidden="true" />
        Livraison offerte
      </Badge>
      {next ? (
        <span className="text-muted-foreground self-center text-xs">
          −{next.percent} % à partir de {next.minMembers} membres
        </span>
      ) : null}
    </div>
  );
}

export function CommunityCard({
  entry,
  showSpending = true,
}: {
  entry: CommunityEntry;
  /** Faux pour le livreur (canSeeRevenue) : les remises accordées ne sont pas rendues. */
  showSpending?: boolean;
}) {
  const { community, memberCount, discountPercent, summary } = entry;

  return (
    <article
      aria-label={`Communauté ${community.name}`}
      className={cn(
        // Fond nuancé de la couleur « communauté » du thème (token --community).
        "bg-card from-community/12 to-community/4 text-card-foreground ring-foreground/10 card-highlight cv-auto flex h-full flex-col gap-4 rounded-none bg-linear-to-b p-4 shadow-sm ring-1 @2xl/main:p-5",
        !community.active && "opacity-70",
      )}
    >
      <CommunityBanner
        community={community}
        className="-mx-4 -mt-4 rounded-t-2xl @2xl/main:-mx-5 @2xl/main:-mt-5"
      />
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-community/15 text-community flex size-12 shrink-0 items-center justify-center rounded-xl"
        >
          <Users className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-lg leading-tight font-semibold wrap-anywhere">
            {community.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <ClientTypeLabel type="communaute" />
            {!community.active ? (
              <Badge variant="destructive">Inactive</Badge>
            ) : null}
          </div>
          <CommunityDiscountBadges
            memberCount={memberCount}
            discountPercent={discountPercent}
          />
          <span className="text-muted-foreground text-xs">
            Créée le {formatDateFr(community.createdAt)}
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-[1.25rem_1fr] gap-x-2 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">
          <MapPin className="size-4" aria-hidden="true" />
          <span className="sr-only">Point de retrait</span>
        </dt>
        <dd>
          {community.pickupPlace}
          <span className="text-muted-foreground">
            {" "}
            · {community.pickupPostalCode} {community.pickupCity}
          </span>
        </dd>
        <dt className="text-muted-foreground">
          <Clock className="size-4" aria-hidden="true" />
          <span className="sr-only">Horaire de retrait</span>
        </dt>
        <dd className="text-muted-foreground">
          Horaire choisi par chaque membre à la commande
        </dd>
        <dt className="text-muted-foreground">
          <Phone className="size-4" aria-hidden="true" />
          <span className="sr-only">Contact</span>
        </dt>
        <dd>
          {community.contactName} ·{" "}
          <a
            href={toTelHref(community.contactPhone)}
            className="tabular-nums underline-offset-4 hover:underline"
          >
            {community.contactPhone}
          </a>
        </dd>
      </dl>

      <dl
        className={cn(
          "bg-muted/40 grid gap-2 rounded-none p-3 text-center",
          showSpending ? "grid-cols-3" : "grid-cols-2",
        )}
      >
        <div>
          <dt className="text-muted-foreground text-xs">Membres</dt>
          <dd className="text-lg font-bold tabular-nums">{memberCount}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">Commandes</dt>
          <dd className="text-lg font-bold tabular-nums">
            {summary.orderCount}
          </dd>
        </div>
        {showSpending ? (
          <div>
            <dt className="text-muted-foreground text-xs">Remises accordées</dt>
            <dd className="text-sm font-bold tabular-nums">
              {formatEuros(summary.discountCents)}
            </dd>
          </div>
        ) : null}
      </dl>

      <p className="text-muted-foreground text-xs">
        {summary.lastDeliveryDate
          ? `Dernier retrait : ${formatDateFr(summary.lastDeliveryDate)}`
          : "Aucune commande"}
      </p>

      <div className="mt-auto border-t pt-3">
        <HoverPrefetchLink
          href={`/clients/communautes/${community.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Voir le détail
          <span className="sr-only"> ({community.name})</span>
          <ArrowRight />
        </HoverPrefetchLink>
      </div>
    </article>
  );
}
