import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  Euro,
  Gift,
  Mail,
  MapPin,
  Phone,
  ShoppingBasket,
  Percent,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import { CustomerTypeLabels } from "@/components/customers/client-type-label";
import { CustomerHistoryFilters } from "@/components/customers/customer-history-filters";
import { CustomerNoteForm } from "@/components/customers/customer-note-form";
import { CustomerPrivacyPanel } from "@/components/customers/customer-privacy-panel";
import { LoyaltyGauge } from "@/components/customers/loyalty-badge";
import { TierBadge } from "@/components/customers/tier-badge";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { OrdersTable } from "@/components/orders/orders-table";
import { PageHeader } from "@/components/page-header";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCustomer, getCustomerReferrals } from "@/data/customers";
import {
  getCustomerTierEvents,
  getDirectoryStats,
  getOrdersPage,
} from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import {
  canAddCustomerNote,
  canHandlePrivacyRequest,
  canSeeRevenue,
} from "@/domain/auth/roles";
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
import { cn } from "@/lib/utils";

/*
 * Fiche client, en lignes pleine largeur pour rester lisible malgré tout ce
 * qu'elle porte (demande du client : autorisations et parrainage « à
 * l'horizontale ») :
 *   1. coordonnées et adresse de livraison (et communauté), chiffres clés,
 *      notes internes avec formulaire d'ajout ; sur PC (@4xl), coordonnées
 *      et chiffres en tuiles sur deux colonnes, les notes à droite ; en
 *      dessous, listes libellé / valeur (les tuiles sont en display: contents) ;
 *   2. « Notifications et autorisations » : les trois autorisations données
 *      dans l'application, en trois colonnes ;
 *   3. « Parrainage » : code et parrain à gauche, filleuls à droite (visibles
 *      ICI seulement, jamais sur une carte) ;
 *   4. « Fidélité » : catégorie et compteur cumulé à gauche, historique daté
 *      des atteintes à droite ;
 *   5. historique des commandes (croisement via OrderFilters.customerId).
 * Chiffres, compteur et catégorie agrégés par la base (getDirectoryStats
 * restreint au client, mêmes règles que l'annuaire, toujours sur TOUTES ses
 * commandes) ; l'historique des atteintes vient d'une requête à part
 * (getCustomerTierEvents) ; les commandes sont lues page par page (?page=, les
 * plus récentes d'abord), jamais en entier, et se restreignent à une période
 * de livraison (?du=&au=, filtrée par la base, une date = ce jour-là) que la
 * pagination garde ; une période sans commande est dite par un bandeau bleu.
 * En bas, l'encart « Données personnelles » (export et anonymisation RGPD,
 * administrateur seul). Un client anonymisé n'affiche plus ni coordonnées, ni
 * autorisations, ni parrainage, ni formulaire de note.
 */
export const metadata: Metadata = { title: "Fiche client" };

const plural = (n: number) => (n > 1 ? "s" : "");

/*
 * Tuiles des coordonnées et des chiffres clés, sur PC seulement : en dessous
 * de @4xl, chaque tuile est en display: contents, son libellé et sa valeur
 * redeviennent les deux colonnes de la liste (et l'icône est masquée).
 */
const TILE =
  "contents @4xl/main:flex @4xl/main:min-w-0 @4xl/main:flex-col @4xl/main:gap-1 @4xl/main:rounded-xl @4xl/main:border @4xl/main:bg-muted/30 @4xl/main:p-3";
const TILE_LABEL =
  "text-muted-foreground @4xl/main:flex @4xl/main:items-center @4xl/main:gap-1.5 @4xl/main:text-xs @4xl/main:font-medium";
const TILE_ICON = "hidden size-3.5 @4xl/main:inline";
const STAT_VALUE = "@4xl/main:text-2xl @4xl/main:font-bold";

export default async function ClientPage({
  params,
  searchParams,
}: PageProps<"/clients/[id]">) {
  const { id } = await params;
  const parsed = customerIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const raw = await searchParams;
  const { filters: periodFilters, period } = parseCustomerHistoryPeriod(raw);

  const [customer, directory, history, user, referrals, tierEvents] =
    await Promise.all([
      getCustomer(parsed.data),
      getDirectoryStats({ customerId: parsed.data }),
      getOrdersPage(
        { customerId: parsed.data, ...periodFilters },
        parsePage(raw),
      ),
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
  const range = period.range;
  const periodText = range ? formatPeriodFr(range.from, range.to) : "";
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
        <CustomerTypeLabels community={customer.community} />
        {anonymized ? null : <TierBadge state={tier} showUntil />}
      </div>

      {/* 1. Coordonnées, chiffres, notes */}
      <div className="grid gap-4 @4xl/main:grid-cols-3">
        <Card className="@4xl/main:col-span-2">
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
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm @4xl/main:grid-cols-2 @4xl/main:gap-3">
                <div className={TILE}>
                  <dt className={TILE_LABEL}>
                    <Mail className={TILE_ICON} aria-hidden="true" />
                    E-mail
                  </dt>
                  <dd className="font-medium break-all">
                    <a
                      href={`mailto:${customer.email}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {customer.email}
                    </a>
                  </dd>
                </div>
                <div className={TILE}>
                  <dt className={TILE_LABEL}>
                    <Phone className={TILE_ICON} aria-hidden="true" />
                    Téléphone
                  </dt>
                  <dd className="font-medium">
                    <a
                      href={toTelHref(customer.phone)}
                      className="underline-offset-4 hover:underline"
                    >
                      {customer.phone}
                    </a>
                  </dd>
                </div>
                <div className={TILE}>
                  <dt className={TILE_LABEL}>
                    <MapPin className={TILE_ICON} aria-hidden="true" />
                    Adresse de livraison
                  </dt>
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
                </div>
                {customer.community ? (
                  <div className={TILE}>
                    <dt className={TILE_LABEL}>
                      <Users className={TILE_ICON} aria-hidden="true" />
                      Communauté
                    </dt>
                    <dd className="font-medium">
                      <Link
                        href={`/clients/communautes/${customer.community.id}`}
                        className="inline-flex items-center gap-1.5 underline-offset-4 hover:underline"
                      >
                        <Users
                          className="size-4 @4xl/main:hidden"
                          aria-hidden="true"
                        />
                        {customer.community.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
              </dl>
            )}
          </CardContent>
        </Card>

        <Card className="@4xl/main:col-span-2 @4xl/main:row-start-2">
          <CardHeader>
            <CardTitle>
              <h2>Chiffres clés</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm @4xl/main:grid-cols-3 @4xl/main:gap-3">
              <div className={TILE}>
                <dt className={TILE_LABEL}>
                  <ShoppingBasket className={TILE_ICON} aria-hidden="true" />
                  Commandes
                </dt>
                <dd className={cn("font-medium tabular-nums", STAT_VALUE)}>
                  {stats.orderCount}
                </dd>
              </div>
              {/* Montant dépensé : jamais pour le livreur (canSeeRevenue). */}
              {canSeeRevenue(user.role) ? (
                <div className={TILE}>
                  <dt className={TILE_LABEL}>
                    <Euro className={TILE_ICON} aria-hidden="true" />
                    Total (hors annulées)
                  </dt>
                  <dd className={cn("font-medium tabular-nums", STAT_VALUE)}>
                    {formatEuros(stats.totalSpentCents)}
                  </dd>
                </div>
              ) : null}
              <div className={TILE}>
                <dt className={TILE_LABEL}>
                  <CalendarCheck className={TILE_ICON} aria-hidden="true" />
                  Dernière livraison
                </dt>
                <dd className="font-medium @4xl/main:text-base @4xl/main:font-semibold">
                  {stats.lastDeliveryDate
                    ? formatDateFr(stats.lastDeliveryDate)
                    : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card className="@4xl/main:col-start-3 @4xl/main:row-span-2 @4xl/main:row-start-1">
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
            {anonymized || !canAddCustomerNote(user.role) ? null : (
              <CustomerNoteForm customerId={customer.id} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* 2. Autorisations, à l'horizontale */}
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
              <ul
                aria-label="Autorisations données par le client"
                className="grid gap-3 @2xl/main:grid-cols-3"
              >
                {CONSENT_KEYS.map((key) => {
                  const granted = customer.consents[key];
                  const Mark = granted ? Check : X;
                  return (
                    <li
                      key={key}
                      className={cn(
                        "flex flex-col gap-1 rounded-xl border p-3",
                        granted
                          ? "border-success/40 bg-success/5"
                          : "border-border bg-muted/30",
                      )}
                    >
                      <span
                        className={cn(
                          "flex items-center gap-1.5 font-semibold",
                          granted ? "text-success" : "text-muted-foreground",
                        )}
                      >
                        <Mark className="size-4 shrink-0" aria-hidden="true" />
                        {CONSENT_LABELS[key]}
                        <span className="sr-only">
                          {granted ? " : autorisé" : " : refusé"}
                        </span>
                      </span>
                      <span className="text-muted-foreground text-xs">
                        <span aria-hidden="true">
                          {granted ? "Autorisé" : "Refusé"} ·{" "}
                        </span>
                        {CONSENT_DESCRIPTIONS[key]}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-muted-foreground text-xs">
                {customer.consents.updatedAt
                  ? `Mis à jour le ${formatDateTimeFr(customer.consents.updatedAt)}.`
                  : "Jamais modifiées."}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* 3. Parrainage, à l'horizontale : code et parrain, puis les filleuls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="text-primary size-5" aria-hidden="true" />
            <h2>Parrainage</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {anonymized ? (
            <p className="text-muted-foreground">
              Code de parrainage effacé lors de l&apos;anonymisation.
            </p>
          ) : (
            <div className="grid gap-4 @2xl/main:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2">
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
                className="flex flex-col gap-2 border-t pt-3 @2xl/main:border-t-0 @2xl/main:border-l @2xl/main:pt-0 @2xl/main:pl-4"
              >
                <h3 id="filleuls" className="font-semibold">
                  {referrals.length} filleul{plural(referrals.length)}
                </h3>
                {referrals.length === 0 ? (
                  <p className="text-muted-foreground">
                    Personne n&apos;a encore saisi son code.
                  </p>
                ) : (
                  <ol className="grid gap-x-6 gap-y-1.5 @4xl/main:grid-cols-2">
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. Fidélité : compteur à gauche, historique à droite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="text-loyal size-5" aria-hidden="true" />
            <h2>Fidélité</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 @2xl/main:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <div className="flex flex-col gap-4">
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
            </div>
            <section
              aria-labelledby="historique-statuts"
              className="border-t pt-3 @2xl/main:border-t-0 @2xl/main:border-l @2xl/main:pt-0 @2xl/main:pl-4"
            >
              <h3
                id="historique-statuts"
                className="mb-2 text-sm font-semibold"
              >
                Historique des statuts
              </h3>
              {reached.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Jamais encore fidèle.
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
          </div>
        </CardContent>
      </Card>

      {/* 5. Historique des commandes */}
      <div id="historique" className="flex scroll-mt-20 flex-col gap-2">
        <h2 className="text-lg font-semibold tracking-tight">
          Historique des commandes
        </h2>
        {stats.orderCount > 0 || period.from !== undefined ? (
          <>
            <CustomerHistoryFilters customerId={customer.id} period={period} />
            <p role="status" className="text-muted-foreground text-sm">
              {range
                ? `${history.total} commande${plural(history.total)} sur ${stats.orderCount}, livraison ${periodText}`
                : `${history.total} commande${plural(history.total)}, les plus récentes d'abord`}
              {history.pageCount > 1
                ? ` · page ${history.page} sur ${history.pageCount}`
                : ""}
            </p>
            {history.total > 0 ? (
              <>
                <OrdersTable orders={history.items} />
                <OrdersPagination
                  page={history}
                  baseParams={orderFiltersQuery(periodFilters)}
                  path={`/clients/${customer.id}`}
                  hash="historique"
                />
              </>
            ) : range ? (
              <PeriodEmptyNotice
                text={`Aucune commande livrée ${periodText} pour ce client.`}
                resetHref={`/clients/${customer.id}#historique`}
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Aucune commande pour ce client.
              </p>
            )}
          </>
        ) : (
          <p className="text-muted-foreground text-sm">
            Aucune commande pour ce client.
          </p>
        )}
      </div>

      <CustomerPrivacyPanel
        customer={customer}
        canHandle={canHandlePrivacyRequest(user.role)}
      />
    </>
  );
}
