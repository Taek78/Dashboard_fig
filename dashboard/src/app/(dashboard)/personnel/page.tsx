import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Plus, SearchX, UserCog, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StaffCard } from "@/components/staff/staff-card";
import { StaffSearch } from "@/components/staff/staff-search";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getStaffWorkSummaries } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import {
  hasStaffSearch,
  searchStaff,
  summarizeStaffWork,
} from "@/domain/staff/rules";
import { parseStaffSearch } from "@/domain/staff/schemas";

/*
 * Section Personnel : l'équipe du client (livreurs, préparateurs de
 * commandes, gestionnaires). Une recherche automatique (nom, prénom, e-mail,
 * téléphone) et cinq filtres (métier ?type=, disponibilité, créneau, jour
 * travaillé, présence), puis les cartes avec les compteurs d'activité agrégés
 * par la base pour toute l'équipe (getStaffWorkSummaries, une requête). Un rôle qui gère le personnel voit le
 * bouton de création ; les autres consultent. ?supprime=1 confirme une
 * suppression.
 */
export const metadata: Metadata = { title: "Personnel" };

const emptyMedia =
  "bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6";

export default async function PersonnelPage({
  searchParams,
}: PageProps<"/personnel">) {
  const raw = await searchParams;
  const search = parseStaffSearch(raw);
  const filtered = hasStaffSearch(search);
  const [everyone, summaries, user] = await Promise.all([
    listStaff(),
    getStaffWorkSummaries(),
    getCurrentUser(),
  ]);
  const canManage = canManageStaff(user.role);
  const members = searchStaff(everyone, search);
  const newHref = search.kind
    ? `/personnel/nouveau?type=${search.kind}`
    : "/personnel/nouveau";
  const plural = (n: number) => (n > 1 ? "s" : "");

  return (
    <>
      <PageHeader
        title="Personnel"
        actions={
          canManage ? (
            <Link
              href={newHref}
              className={buttonVariants({ variant: "brand" })}
            >
              <Plus />
              Nouvelle personne
            </Link>
          ) : undefined
        }
      />
      {raw.supprime === "1" ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Personne supprimée.
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        <StaffSearch search={search} canReset={filtered} />
        {search.kind === "gestionnaire" ? (
          <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-sm">
            <UserCog className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Accès au back-office :{" "}
              <Link
                href="/comptes"
                className="text-foreground font-medium underline-offset-4 hover:underline"
              >
                Comptes
              </Link>
              .
            </span>
          </p>
        ) : null}
        <p role="status" className="text-base font-semibold">
          {filtered
            ? `${members.length} personne${plural(members.length)} sur ${everyone.length}`
            : `${members.length} personne${plural(members.length)} dans l'équipe`}
        </p>
        {members.length > 0 ? (
          <ul className="grid gap-4 @2xl/main:grid-cols-2 @5xl/main:grid-cols-3">
            {members.map((member) => (
              <li key={member.id}>
                <StaffCard
                  member={member}
                  summary={
                    summaries.get(member.id) ??
                    summarizeStaffWork([], member.id)
                  }
                  canManage={canManage}
                />
              </li>
            ))}
          </ul>
        ) : filtered ? (
          <Empty className="bg-card/60 min-h-[40vh] rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <SearchX />
              </EmptyMedia>
              <EmptyTitle>Personne ne correspond</EmptyTitle>
              <EmptyDescription>
                Essayez une partie du nom, de l&apos;e-mail ou du téléphone, ou
                retirez un filtre.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Link
                href="/personnel"
                className={buttonVariants({ variant: "outline" })}
              >
                Voir toute l&apos;équipe
              </Link>
            </EmptyContent>
          </Empty>
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia variant="icon" className={emptyMedia}>
                <Users />
              </EmptyMedia>
              <EmptyTitle>Personne dans l&apos;équipe</EmptyTitle>
              <EmptyDescription>
                Ajoutez une personne pour pouvoir l&apos;affecter aux commandes.
              </EmptyDescription>
            </EmptyHeader>
            {canManage ? (
              <EmptyContent>
                <Link href={newHref} className={buttonVariants()}>
                  <Plus />
                  Nouvelle personne
                </Link>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </div>
    </>
  );
}
