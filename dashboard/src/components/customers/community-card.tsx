import Link from "next/link";
import { ArrowRight, Clock, MapPin, Percent, Phone, Users } from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { COMMUNITY_KIND_LABELS } from "@/domain/communities/kind";
import type { CommunityEntry } from "@/domain/customers/directory";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Grande carte d'une communauté (serveur) : type et remise annoncée, point de
 * retrait, contact, chiffres (membres, commandes, remises accordées) et un
 * bouton dédié vers la fiche. L'horaire de retrait n'appartient pas à la
 * communauté : chaque membre le choisit à la commande, dans l'application.
 */
export function CommunityCard({ entry }: { entry: CommunityEntry }) {
  const { community, memberCount, summary } = entry;

  return (
    <article
      aria-label={`Communauté ${community.name}`}
      className={cn(
        "bg-card text-card-foreground ring-foreground/10 card-lift flex h-full flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 @2xl/main:p-5",
        !community.active && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="bg-community/15 text-community flex size-12 shrink-0 items-center justify-center rounded-xl"
        >
          <Users className="size-6" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <h3 className="text-lg leading-tight font-semibold [overflow-wrap:anywhere]">
            {community.name}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <ClientTypeLabel
              community={{ id: community.id, name: community.name }}
              showName={false}
            />
            <Badge variant="secondary">
              {COMMUNITY_KIND_LABELS[community.kind]}
            </Badge>
            {!community.active ? (
              <Badge variant="destructive">Inactive</Badge>
            ) : null}
          </div>
          <Badge variant="success" className="h-auto whitespace-normal">
            <Percent aria-hidden="true" />
            {`−${community.discountPercent} % sur chaque commande`}
          </Badge>
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

      <dl className="bg-muted/40 grid grid-cols-3 gap-2 rounded-xl p-3 text-center">
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
        <div>
          <dt className="text-muted-foreground text-xs">Remises accordées</dt>
          <dd className="text-sm font-bold tabular-nums">
            {formatEuros(summary.discountCents)}
          </dd>
        </div>
      </dl>

      <p className="text-muted-foreground text-xs">
        {summary.lastDeliveryDate
          ? `Dernier retrait : ${formatDateFr(summary.lastDeliveryDate)}`
          : "Aucune commande"}
      </p>

      <div className="mt-auto border-t pt-3">
        <Link
          href={`/clients/communautes/${community.id}`}
          className={cn(buttonVariants({ variant: "outline" }), "w-full")}
        >
          Voir le détail
          <span className="sr-only"> ({community.name})</span>
          <ArrowRight />
        </Link>
      </div>
    </article>
  );
}
