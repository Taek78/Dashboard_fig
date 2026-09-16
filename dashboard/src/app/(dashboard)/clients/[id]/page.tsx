import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Gift, Percent, Sparkles, Star, Users } from "lucide-react";
import { ClientTypeLabel } from "@/components/customers/client-type-label";
import { ConsentPills } from "@/components/customers/consent-pills";
import { CustomerHistoryFilters } from "@/components/customers/customer-history-filters";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { CustomerPrivacyPanel } from "@/components/customers/customer-privacy-panel";
import { LoyaltyGauge } from "@/components/customers/loyalty-badge";
import { TierBadge } from "@/components/customers/tier-badge";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer, getCustomerReferrals } from "@/data/customers";
import {
  getCustomerTierEvents,
  getDirectoryStats,
  getOrdersPage,
} from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { canHandlePrivacyRequest } from "@/domain/auth/roles";
import {
  CONSENT_DESCRIPTIONS,
  CONSENT_KEYS,
  CONSENT_LABELS,
} from "@/domain/customers/consents";
import { buildCustomerEntries } from "@/domain/customers/directory";
import { sortNotesNewestFirst } from "@/domain/customers/rules";
import {
  customerIdSchema,
  parseCustomerHistoryPeriod,
} from "@/domain/customers/schemas";
import { LOYAL_TIER_MONTHS } from "@/domain/customers/tier";
import { orderFiltersQuery } from "@/domain/orders/rules";
import { parsePage } from "@/domain/orders/schemas";
import {
  formatDateFr,
  formatDateTimeFr,
  formatEuros,
  formatPeriodFr,
  toTelHref,
} from "@/lib/format";

/*
 * Fiche client : coordonnées et adresse de livraison (et communauté),
 * chiffres clés, autorisations données dans l'application, parrainage (code,
 * parrain, filleuls : visibles ICI seulement, jamais sur une carte),
 * catégorie et fidélité (compteur cumulé, historique daté des atteintes),
 * historique des commandes (croisement via OrderFilters.customerId), notes
 * internes et formulaire d'ajout.
 * Chiffres, compteur et catégorie agrégés par la base (getDirectoryStats
 * restreint au client, mêmes règles que l'annuaire, toujours sur TOUTES ses
 * commandes) ; l'historique des atteintes vient d'une requête à part
 * (getCustomerTierEvents) ; les commandes sont lues page par page (?page=, les
 * plus récentes d'abord), jamais en entier, et se restreignent à une période
 * de livraison (?du=&au=, filtrée par la base) que la pagination garde.
 * En bas, l'encart « Données personnelles » (export et anonymisation RGPD,
 * administrateur seul). Un client anonymisé n'affiche plus ni coordonnées, ni
 * autorisations, ni parrainage, ni formulaire de note.
 */
export const metadata: Metadata = { title: "Fiche client" };

const plural = (n: number) => (n > 1 ? "s" : "");

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const parsed = customerIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const raw = await searchParams;
  const period = parseCustomerHistoryPeriod(raw);

  const [customer, directory, history, user, referrals, tierEvents] =
    await Promise.all([
      getCustomer(parsed.data),
      getDirectoryStats({ customerId: parsed.data }),
      getOrdersPage({ customerId: parsed.data, ...period }, parsePage(raw)),
      getCurrentUser(),
      getCustomerReferrals(parsed.data),
      getCustomerTierEvents(parsed.data),
    ]);
  if (!customer) notFound();

  const entry = buildCustomerEntries(
    [customer],
    directory,
    new Date().toISOString(),
  )[0]!;
  const { stats, loyalty, tier, nextDiscount, communityDiscountPercent } =
    entry;
  const periodText = formatPeriodFr(period.from, period.to);
  const notes = sortNotesNewestFirst(customer.notes);
  const anonymized = customer.anonymizedAt !== null;
  const reached = tierEvents.toReversed();

  return (
    <>
      <PageHeader
        title={customer.fullName}
        description={`Client depuis le ${formatDateFr(customer.createdAt)}`}
        actions={
          <Button variant="outline" size="sm" render={<Link href="/clients" />}>
            <ArrowLeft />
            Retour aux clients
          </Button>
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <ClientTypeLabel community={customer.community} />
        {anonymized ? null : <TierBadge state={tier} showUntil />}
      </div>
      <div className="grid gap-4 @4xl/main:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Coordonnées</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anonymized ? (
              <p className="text-muted-foreground text-sm">
                Coordonnées effacées le {formatDateFr(customer.anonymizedAt!)}{" "}
                (anonymisation RGPD).
              </p>
            ) : (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">E-mail</dt>
                <dd className="font-medium break-all">
                  <a
                    href={`mailto:${customer.email}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {customer.email}
                  </a>
                </dd>
                <dt className="text-muted-foreground">Téléphone</dt>
                <dd className="font-medium">
                  <a
                    href={toTelHref(customer.phone)}
                    className="underline-offset-4 hover:underline"
                  >
                    {customer.phone}
                  </a>
                </dd>
                <dt className="text-muted-foreground">Adresse de livraison</dt>
                <dd className="font-medium">
                  {customer.addressLine ? (
                    <>
                      {customer.addressLine}
                      <br />
                    </>
                  ) : null}
                  {customer.postalCode} {customer.city}
                  {customer.community ? (
                    <span className="text-muted-foreground block text-xs font-normal">
                      Livraison au point de retrait de sa communauté.
                    </span>
                  ) : null}
                </dd>
                {customer.community ? (
                  <>
                    <dt className="text-muted-foreground">Communauté</dt>
                    <dd className="font-medium">
                      <Link
                        href={`/clients/communautes/${customer.community.id}`}
                        className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                      >
                        <Users className="size-4" aria-hidden="true" />
                        {customer.community.name}
                      </Link>
                    </dd>
                  </>
                ) : null}
              </dl>
            )}
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
              <dt className="text-muted-foreground">Commandes</dt>
              <dd className="font-medium tabular-nums">{stats.orderCount}</dd>
              <dt className="text-muted-foreground">Total (hors annulées)</dt>
              <dd className="font-medium tabular-nums">
                {formatEuros(stats.totalSpentCents)}
              </dd>
              <dt className="text-muted-foreground">Dernière livraison</dt>
              <dd className="font-medium">
                {stats.lastDeliveryDate
                  ? formatDateFr(stats.lastDeliveryDate)
                  : "—"}
              </dd>
            </dl>
          </CardContent>
        </Card>

        <Card className="@4xl/main:row-span-2">
          <CardHeader>
            <CardTitle>
              <h2>Notes internes</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {notes.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                {anonymized
                  ? "Notes supprimées lors de l'anonymisation."
                  : "Aucune note pour l'instant."}
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {notes.map((note) => (
                  <li
                    key={note.id}
                    className="bg-muted/40 rounded-lg border px-3 py-2 text-sm"
                  >
                    <p>{note.text}</p>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {note.authorName} · {formatDateFr(note.createdAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {anonymized ? null : <CustomerNoteForm customerId={customer.id} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Notifications et autorisations</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {anonymized ? (
              <p className="text-muted-foreground">
                Autorisations retirées lors de l&apos;anonymisation.
              </p>
            ) : (
              <>
                <ConsentPills consents={customer.consents} />
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                  {CONSENT_KEYS.map((key) => (
                    <div key={key} className="contents">
                      <dt className="font-medium">
                        {CONSENT_LABELS[key]}
                        <span className="sr-only"> :</span>
                      </dt>
                      <dd className="text-muted-foreground">
                        {customer.consents[key] ? "Autorisé" : "Refusé"} ·{" "}
                        {CONSENT_DESCRIPTIONS[key]}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="text-muted-foreground text-xs">
                  Choix faits dans l&apos;application FIG
                  {customer.consents.updatedAt
                    ? `, le ${formatDateTimeFr(customer.consents.updatedAt)}`
                    : ""}
                  . Le dashboard les lit, il ne les modifie pas.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="text-primary size-5" aria-hidden="true" />
              <h2>Parrainage</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {anonymized ? (
              <p className="text-muted-foreground">
                Code de parrainage effacé lors de l&apos;anonymisation.
              </p>
            ) : (
              <>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
                  <dt className="text-muted-foreground">Code</dt>
                  <dd>
                    {customer.referralCode ? (
                      <code className="bg-muted rounded-md px-2 py-0.5 font-mono text-sm font-semibold">
                        {customer.referralCode}
                      </code>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Parrainé par</dt>
                  <dd className="font-medium">
                    {customer.referredBy ? (
                      <Link
                        href={`/clients/${customer.referredBy.id}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {customer.referredBy.fullName}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground font-normal">
                        Inscription sans code
                      </span>
                    )}
                  </dd>
                </dl>
                <section
                  aria-labelledby="filleuls"
                  className="flex flex-col gap-2 border-t pt-3"
                >
                  <h3 id="filleuls" className="font-semibold">
                    {referrals.length} filleul{plural(referrals.length)}
                  </h3>
                  {referrals.length === 0 ? (
                    <p className="text-muted-foreground">
                      Personne n&apos;a encore saisi son code.
                    </p>
                  ) : (
                    <ol className="flex flex-col gap-1.5">
                      {referrals.map((referral) => (
                        <li
                          key={referral.id}
                          className="flex flex-wrap items-baseline justify-between gap-x-3"
                        >
                          <Link
                            href={`/clients/${referral.id}`}
                            className="font-medium underline-offset-4 hover:underline"
                          >
                            {referral.fullName}
                          </Link>
                          <span className="text-muted-foreground text-xs">
                            inscrit le {formatDateFr(referral.createdAt)}
                          </span>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="@4xl/main:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="text-loyal size-5" aria-hidden="true" />
              <h2>Fidélité</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <TierBadge state={tier} showUntil />
              <span className="text-muted-foreground">
                {tier.tier === "loyal"
                  ? `Fidèle depuis le ${formatDateFr(tier.since!)}, pour ${LOYAL_TIER_MONTHS} mois.`
                  : `Devient fidèle pour ${LOYAL_TIER_MONTHS} mois à la huitième commande cumulée.`}
              </span>
            </div>
            <LoyaltyGauge status={loyalty} />
            {customer.community ? (
              <p className="flex flex-wrap items-center gap-1.5 text-sm">
                {nextDiscount?.kind === "loyalty" ? (
                  <>
                    <Sparkles
                      className="text-success size-4"
                      aria-hidden="true"
                    />
                    Sa remise fidélité −{nextDiscount.percent} % remplace la
                    remise de sa communauté
                    {communityDiscountPercent
                      ? ` (−${communityDiscountPercent} %)`
                      : ""}{" "}
                    sur la prochaine commande.
                  </>
                ) : (
                  <>
                    <Percent
                      className="text-muted-foreground size-4"
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">
                      {communityDiscountPercent
                        ? `Remise de sa communauté −${communityDiscountPercent} % sur chaque commande ; la fidélité, plus forte, la remplacera quand elle sera prête.`
                        : "Sa communauté n'a pas encore de remise ; la fidélité s'appliquera quand elle sera prête."}
                    </span>
                  </>
                )}
              </p>
            ) : null}
            <section
              aria-labelledby="historique-statuts"
              className="border-t pt-3"
            >
              <h3
                id="historique-statuts"
                className="mb-2 text-sm font-semibold"
              >
                Historique des statuts
              </h3>
              {reached.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Jamais encore fidèle : le compteur repart à chaque remise.
                </p>
              ) : (
                <ol className="flex flex-col gap-2 text-sm">
                  {reached.map((event) => (
                    <li
                      key={event.orderId}
                      className="border-loyal/50 flex flex-col gap-0.5 border-l-2 pl-3"
                    >
                      <span className="font-medium">
                        Fidèle le {formatDateFr(event.reachedAt)}
                        <span className="text-muted-foreground font-normal">
                          {" "}
                          jusqu&apos;au {formatDateFr(event.expiresAt)}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        huitième commande :{" "}
                        <Link
                          href={`/commandes/${event.orderId}`}
                          className="font-mono underline-offset-4 hover:underline"
                        >
                          {event.orderReference}
                        </Link>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </CardContent>
        </Card>

        <div
          id="historique"
          className="flex scroll-mt-20 flex-col gap-2 @4xl/main:col-span-3"
        >
          <h2 className="text-lg font-semibold tracking-tight">
            Historique des commandes
          </h2>
          {stats.orderCount > 0 || periodText !== "" ? (
            <>
              <CustomerHistoryFilters
                customerId={customer.id}
                period={period}
              />
              <p role="status" className="text-muted-foreground text-sm">
                {periodText === ""
                  ? `${history.total} commande${plural(history.total)}, les plus récentes d'abord`
                  : `${history.total} commande${plural(history.total)} sur ${stats.orderCount}, livraison ${periodText}`}
                {history.pageCount > 1
                  ? ` · page ${history.page} sur ${history.pageCount}`
                  : ""}
              </p>
              {history.total > 0 ? (
                <>
                  <OrdersTable orders={history.items} />
                  <OrdersPagination
                    page={history}
                    baseParams={orderFiltersQuery(period)}
                    path={`/clients/${customer.id}`}
                    hash="historique"
                  />
                </>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Aucune commande livrée sur cette période : élargissez-la ou
                  affichez toutes les dates.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted-foreground text-sm">
              Aucune commande pour ce client.
            </p>
          )}
        </div>
      </div>

      <CustomerPrivacyPanel
        customer={customer}
        canHandle={canHandlePrivacyRequest(user.role)}
      />
    </>
  );
}
