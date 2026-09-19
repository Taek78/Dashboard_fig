import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { CommunityBanner } from "@/components/customers/community-banner";
import { CommunityDiscountBadges } from "@/components/customers/community-card";
import { CustomerCard } from "@/components/customers/customer-card";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCommunity } from "@/data/communities";
import { getCustomers } from "@/data/customers";
import { getDirectoryStats, getOrdersPage } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canSeeRevenue } from "@/domain/auth/roles";
import { communityDiscountPercent } from "@/domain/communities/discount";
import {
  COMMUNITY_KIND_LABELS,
  COMMUNITY_VISIBILITY_LABELS,
} from "@/domain/communities/kind";
import { summarizeCommunity } from "@/domain/communities/rules";
import { buildCustomerEntries } from "@/domain/customers/directory";
import { customerIdSchema } from "@/domain/customers/schemas";
import { formatDateFr, formatEuros, toTelHref } from "@/lib/format";

/*
 * Fiche d'une communauté (lecture) : bandeau du type et de la visibilité,
 * point de retrait, remise déduite du
 * nombre de membres et livraison offerte, contact, chiffres, ses membres
 * (liste de clients) et ses commandes récentes (croisement par
 * OrderFilters.communityId). Chiffres de la communauté et de ses membres
 * agrégés par la base (getDirectoryStats restreint à la communauté) ; seules
 * les RECENT dernières commandes sont lues.
 */
export const metadata: Metadata = { title: "Fiche communauté" };
const RECENT = 30;
const NO_SUMMARY = summarizeCommunity([]);

export default async function CommunautePage({
  params,
}: PageProps<"/clients/communautes/[id]">) {
  const { id } = await params;
  const parsed = customerIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const community = await getCommunity(parsed.data);
  if (!community) notFound();
  const [members, directory, latest, user] = await Promise.all([
    getCustomers({ communityId: community.id }),
    getDirectoryStats({ communityId: community.id }),
    getOrdersPage({ communityId: community.id }, 1, RECENT),
    getCurrentUser(),
  ]);
  const summary = directory.communities.get(community.id) ?? NO_SUMMARY;
  const recent = latest.items;
  const discountPercent = communityDiscountPercent(members.length);
  const now = new Date().toISOString();
  const showSpending = canSeeRevenue(user.role);

  return (
    <>
      <PageHeader
        title={community.name}
        description={`${COMMUNITY_KIND_LABELS[community.kind]} · ${COMMUNITY_VISIBILITY_LABELS[community.visibility]} · communauté depuis le ${formatDateFr(community.createdAt)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/clients?type=communautes" />}
          >
            <ArrowLeft />
            Retour aux communautés
          </Button>
        }
      />
      <CommunityBanner
        community={community}
        className="ring-community/25 rounded-none ring-1"
      />
      <div className="flex flex-wrap items-center gap-1.5">
        <ClientTypeLabel type="communaute" />
        {!community.active ? (
          <Badge variant="destructive">Inactive</Badge>
        ) : null}
        <CommunityDiscountBadges
          memberCount={members.length}
          discountPercent={discountPercent}
        />
      </div>

      <div className="grid gap-4 @4xl/main:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Point de retrait</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Lieu</dt>
              <dd className="font-medium">{community.pickupPlace}</dd>
              <dt className="text-muted-foreground">Adresse</dt>
              <dd className="font-medium">
                {community.pickupPostalCode} {community.pickupCity}
              </dd>
              <dt className="text-muted-foreground">Horaire</dt>
              <dd className="text-muted-foreground">
                Choisi par chaque membre à la commande, dans l&apos;application
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Contact</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Référent</dt>
              <dd className="font-medium">{community.contactName}</dd>
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">
                <a
                  href={`mailto:${community.contactEmail}`}
                  className="underline-offset-4 hover:underline"
                >
                  {community.contactEmail}
                </a>
              </dd>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd className="font-medium">
                <a
                  href={toTelHref(community.contactPhone)}
                  className="underline-offset-4 hover:underline"
                >
                  {community.contactPhone}
                </a>
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Chiffres clés</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Membres</dt>
              <dd className="font-medium tabular-nums">{members.length}</dd>
              <dt className="text-muted-foreground">Commandes</dt>
              <dd className="font-medium tabular-nums">{summary.orderCount}</dd>
              {/* Montants : jamais pour le livreur (canSeeRevenue). */}
              {showSpending ? (
                <>
                  <dt className="text-muted-foreground">
                    Total (hors annulées)
                  </dt>
                  <dd className="font-medium tabular-nums">
                    {formatEuros(summary.totalCents)}
                  </dd>
                  <dt className="text-muted-foreground">Remises accordées</dt>
                  <dd className="font-medium tabular-nums">
                    {formatEuros(summary.discountCents)}
                  </dd>
                </>
              ) : null}
              <dt className="text-muted-foreground">Dernier retrait</dt>
              <dd className="font-medium">
                {summary.lastDeliveryDate
                  ? formatDateFr(summary.lastDeliveryDate)
                  : "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">Membres</h2>
        {members.length > 0 ? (
          <ul className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {buildCustomerEntries(members, directory, now).map((entry) => (
              <li key={entry.id}>
                <CustomerCard entry={entry} showSpending={showSpending} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucun membre pour l&apos;instant.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Commandes récentes
        </h2>
        {recent.length > 0 ? (
          <>
            <p className="text-muted-foreground text-sm">
              {latest.total > RECENT
                ? `Les ${RECENT} plus récentes sur ${latest.total}.`
                : `${latest.total} commande${latest.total > 1 ? "s" : ""}.`}
            </p>
            <OrdersTable orders={recent} />
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucune commande pour cette communauté.
          </p>
        )}
      </section>
    </>
  );
}
