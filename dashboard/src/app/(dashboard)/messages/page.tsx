import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, SearchX } from "lucide-react";
import { MessageCards } from "@/components/messages/message-cards";
import { MessagesFilters } from "@/components/messages/messages-filters";
import { OrdersPagination } from "@/components/orders/orders-pagination";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { countMessages, getMessagesPage } from "@/data/messages";
import { getCurrentUser } from "@/data/session";
import { canHandleMessages } from "@/domain/auth/roles";
import {
  hasMessageFilters,
  messageFiltersQuery,
} from "@/domain/messages/rules";
import { parseMessageFilters } from "@/domain/messages/schemas";
import { parsePage } from "@/domain/orders/schemas";

/*
 * Boîte de réception des messages « Nous contacter » de l'application FIG.
 *
 * Composant serveur async : lit l'URL une fois, en tire les filtres validés et
 * la page, puis demande à la façade UNE page (la base filtre, cherche, compte
 * et découpe). Les messages épinglés remontent en tête, puis les plus récents.
 *
 * Le compteur « non traités » est un COUNT à part, sur toute la boîte et non
 * sur la page filtrée : c'est le reste à faire, il ne doit pas changer quand on
 * filtre. Deux états vides distincts : « rien ne correspond aux filtres » et
 * « aucun message » n'appellent pas la même action.
 */
export const metadata: Metadata = { title: "Messages" };

const emptyMedia =
  "bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6";

export default async function MessagesPage({
  searchParams,
}: PageProps<"/messages">) {
  const raw = await searchParams;
  const filters = parseMessageFilters(raw);
  const isFiltered = hasMessageFilters(filters);

  const [page, untreated, user] = await Promise.all([
    getMessagesPage(filters, parsePage(raw)),
    countMessages({ status: "untreated" }),
    getCurrentUser(),
  ]);
  const canHandle = canHandleMessages(user.role);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Les demandes envoyées par les clients depuis « Nous contacter » dans l'application."
      />
      <div className="flex flex-col gap-4">
        <MessagesFilters filters={filters} canReset={isFiltered} />
        <p role="status" className="text-base font-semibold">
          {page.total} message{page.total > 1 ? "s" : ""}
          <span className="text-muted-foreground text-sm font-normal">
            {` · ${untreated} non traité${untreated > 1 ? "s" : ""} en tout`}
            {page.pageCount > 1
              ? `, page ${page.page} sur ${page.pageCount}`
              : ""}
          </span>
        </p>
        {page.total > 0 ? (
          <>
            <MessageCards messages={page.items} canHandle={canHandle} />
            <OrdersPagination
              page={page}
              baseParams={messageFiltersQuery(filters)}
              path="/messages"
            />
          </>
        ) : isFiltered ? (
          <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Aucun message ne correspond</EmptyTitle>
              <EmptyDescription>
                Modifiez les filtres ou réinitialisez-les pour revoir toute la
                boîte de réception.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button variant="outline" render={<Link href="/messages" />}>
                Réinitialiser les filtres
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="bg-card/60 min-h-[50vh] rounded-xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <Inbox />
              </EmptyMedia>
              <EmptyTitle>Aucun message</EmptyTitle>
              <EmptyDescription>
                Les demandes envoyées depuis « Nous contacter » dans
                l&apos;application FIG apparaîtront ici.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </>
  );
}
