import Link from "next/link";
import { ArrowRight, Clock, MapPin, Percent, Phone, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { listCommunities } from "@/data/communities";
import { getCustomers } from "@/data/customers";
import { getOrders } from "@/data/orders";
import { COMMUNITY_KIND_LABELS } from "@/domain/communities/kind";
import {
  communityMembers,
  communityOrders,
  summarizeCommunity,
} from "@/domain/communities/rules";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Cartes des communautés (serveur async, dans un <Suspense>) : pour chacune,
 * le type, le point et l'heure de retrait, la remise, le contact, le nombre de
 * membres et les chiffres de ses commandes (règles pures du domaine).
 */
export async function CommunitiesCards() {
  const [communities, members, orders] = await Promise.all([
    listCommunities(),
    getCustomers({ membership: "community" }),
    getOrders(),
  ]);

  if (communities.length === 0) {
    return (
      <Empty className="bg-card/60 min-h-[30vh] rounded-2xl border border-dashed">
        <EmptyHeader>
          <EmptyMedia
            variant="icon"
            className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
          >
            <Users />
          </EmptyMedia>
          <EmptyTitle>Aucune communauté</EmptyTitle>
          <EmptyDescription>
            Les communautés créées dans l&apos;application FIG apparaîtront ici.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        {communities.length} communauté{communities.length > 1 ? "s" : ""} ·{" "}
        {members.length} membre{members.length > 1 ? "s" : ""}
      </p>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {communities.map((community) => {
          const mine = communityMembers(members, community.id);
          const summary = summarizeCommunity(
            communityOrders(orders, community.id),
          );
          return (
            <li key={community.id}>
              <article
                aria-label={`Communauté ${community.name}`}
                className={cn(
                  "bg-card text-card-foreground ring-foreground/10 card-lift flex h-full flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 md:p-5",
                  !community.active && "opacity-70",
                )}
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-gradient-brand flex size-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                  >
                    <Users className="size-5" />
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <h3 className="text-lg leading-tight font-semibold">
                      <Link
                        href={`/clients/communautes/${community.id}`}
                        className="underline-offset-4 hover:underline focus-visible:underline"
                      >
                        {community.name}
                      </Link>
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="secondary">
                        {COMMUNITY_KIND_LABELS[community.kind]}
                      </Badge>
                      <Badge variant="success">
                        <Percent aria-hidden="true" />−
                        {community.discountPercent} % sur chaque commande
                      </Badge>
                      {!community.active ? (
                        <Badge variant="destructive">Inactive</Badge>
                      ) : null}
                    </div>
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
                    <span className="sr-only">Heure de retrait</span>
                  </dt>
                  <dd className="tabular-nums">
                    Retrait à {community.pickupTime}
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
                    <dd className="text-lg font-semibold tabular-nums">
                      {mine.length}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">Commandes</dt>
                    <dd className="text-lg font-semibold tabular-nums">
                      {summary.orderCount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground text-xs">
                      Remises accordées
                    </dt>
                    <dd className="text-sm font-semibold tabular-nums">
                      {formatEuros(summary.discountCents)}
                    </dd>
                  </div>
                </dl>

                <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">
                    {summary.lastDeliveryDate
                      ? `Dernier retrait : ${formatDateFr(summary.lastDeliveryDate)}`
                      : "Aucune commande"}
                  </span>
                  <Link
                    href={`/clients/communautes/${community.id}`}
                    className={cn(
                      buttonVariants({ variant: "ghost", size: "sm" }),
                      "-mr-2",
                    )}
                  >
                    Membres et commandes
                    <ArrowRight />
                  </Link>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Squelette des cartes de communautés. */
export function CommunitiesCardsSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-3">
      <p role="status" className="text-muted-foreground text-sm">
        Chargement des communautés…
      </p>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <li
            key={i}
            className="bg-card ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 ring-1 md:p-5"
          >
            <div className="flex items-center gap-3">
              <Skeleton className="size-11 rounded-xl" />
              <div className="flex flex-col gap-2">
                <Skeleton className="h-5 w-44" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </li>
        ))}
      </ul>
    </div>
  );
}
