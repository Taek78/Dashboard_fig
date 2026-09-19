import { ScrollText, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { PageHeader } from "@/components/page-header";
import { PeriodEmptyNotice } from "@/components/period-empty-notice";
import { SecurityEventRows } from "@/components/security/security-event-rows";
import { SecurityFilters } from "@/components/security/security-filters";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getCurrentUser } from "@/data/session";
import {
  getSecurityEventsPage,
  oldestSecurityEventAt,
} from "@/data/security-log";
import { canReadSecurityLog } from "@/domain/auth/roles";
import { parsePage, parsePeriodInput } from "@/domain/orders/schemas";
import { RETENTION } from "@/domain/privacy/retention";
import {
  hasSecurityFilters,
  securityFiltersQuery,
} from "@/domain/security/rules";
import { parseSecurityFilters } from "@/domain/security/schemas";
import { endSentence, formatDateFr, formatPeriodFr } from "@/lib/format";

/*
 * Journal de sécurité, administrateur seul (le proxy refuse déjà les autres
 * rôles, la page revérifie).
 *
 * Ce que la table `security_events` enregistre depuis la première version
 * n'était lisible qu'en ouvrant la base. Cet écran la rend consultable le jour
 * où l'on en a besoin : connexions refusées, accès interdits, changements de
 * rôle, exports RGPD, appels de l'API. En LECTURE SEULE, sans aucun bouton :
 * un journal que l'on peut corriger ne prouve plus rien.
 *
 * Composant serveur async : il lit l'URL une fois, en tire les filtres validés
 * et la page, puis demande UNE page à la façade (la base filtre, cherche,
 * compte et découpe). Le plus récent en tête.
 */
export const metadata: Metadata = { title: "Journal" };

export default async function JournalPage({
  searchParams,
}: PageProps<"/journal">) {
  const user = await getCurrentUser();
  if (!canReadSecurityLog(user.role)) {
    return (
      <>
        <PageHeader title="Journal de sécurité" />
        <p className="text-muted-foreground text-sm">
          Seul un administrateur peut lire le journal de sécurité.
        </p>
      </>
    );
  }

  const raw = await searchParams;
  const filters = parseSecurityFilters(raw);
  const period = parsePeriodInput(raw);
  const isFiltered = hasSecurityFilters(filters) || period.error !== null;

  const [page, oldest] = await Promise.all([
    getSecurityEventsPage(filters, parsePage(raw)),
    oldestSecurityEventAt(),
  ]);
  const baseParams = securityFiltersQuery(filters);
  const withoutDates = securityFiltersQuery({
    ...filters,
    from: undefined,
    to: undefined,
  });

  return (
    <>
      <PageHeader title="Journal de sécurité" />

      <SecurityFilters
        filters={filters}
        period={period}
        canReset={isFiltered}
      />

      <section className="flex flex-col gap-3">
        <p role="status" className="text-muted-foreground text-sm">
          {page.total} événement{page.total > 1 ? "s" : ""}
          {isFiltered ? " pour cette recherche" : ""}
          {oldest !== null
            ? `, le plus ancien remontant au ${formatDateFr(oldest)}`
            : ""}
          . Conservés {RETENTION.securityEventMonths} mois, puis purgés.
        </p>

        {page.items.length === 0 ? (
          period.range !== null && period.error === null ? (
            <PeriodEmptyNotice
              text={endSentence(
                `Aucun événement enregistré ${formatPeriodFr(period.range.from, period.range.to)}${
                  withoutDates ? " avec ces filtres" : ""
                }`,
              )}
              resetHref={withoutDates ? `/journal?${withoutDates}` : "/journal"}
            />
          ) : (
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  {isFiltered ? <SearchX /> : <ScrollText />}
                </EmptyMedia>
                <EmptyTitle>
                  {isFiltered
                    ? "Aucun événement ne correspond"
                    : "Le journal est vide"}
                </EmptyTitle>
              </EmptyHeader>
            </Empty>
          )
        ) : (
          <SecurityEventRows events={page.items} />
        )}

        <OrdersPagination page={page} baseParams={baseParams} path="/journal" />
      </section>
    </>
  );
}
