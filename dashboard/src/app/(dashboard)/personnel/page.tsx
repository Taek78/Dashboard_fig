import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, Plus, UserCog, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StaffCard } from "@/components/staff/staff-card";
import { StaffTabs } from "@/components/staff/staff-tabs";
import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { listStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { STAFF_KINDS, type StaffKind } from "@/domain/staff/kind";
import { summarizeStaffWork } from "@/domain/staff/rules";
import { parseStaffKind } from "@/domain/staff/schemas";

/*
 * Section Personnel : l'équipe du client (livreurs, préparateurs de
 * commandes, gestionnaires), en onglets par métier (?type=), en cartes avec
 * les compteurs d'activité calculés à partir de toutes les commandes. Un
 * rôle qui gère le personnel voit le bouton de création ; les autres
 * consultent. ?supprime=1 confirme une suppression.
 */
export const metadata: Metadata = { title: "Personnel" };

export default async function PersonnelPage({
  searchParams,
}: PageProps<"/personnel">) {
  const raw = await searchParams;
  const kind = parseStaffKind(raw);
  const [everyone, orders, user] = await Promise.all([
    listStaff(),
    getOrders(),
    getCurrentUser(),
  ]);
  const canManage = canManageStaff(user.role);
  const members = kind ? everyone.filter((m) => m.kind === kind) : everyone;
  const counts = Object.fromEntries([
    ["all", everyone.length],
    ...STAFF_KINDS.map((k) => [k, everyone.filter((m) => m.kind === k).length]),
  ]) as Record<StaffKind | "all", number>;
  const newHref = kind
    ? `/personnel/nouveau?type=${kind}`
    : "/personnel/nouveau";

  return (
    <>
      <PageHeader
        title="Personnel"
        description="L'équipe qui prépare et livre : coordonnées, horaires, disponibilité et historique de chacun."
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
        <StaffTabs current={kind} counts={counts} />
        {kind === "gestionnaire" ? (
          <p className="bg-muted/40 text-muted-foreground flex items-start gap-2 rounded-xl border p-3 text-sm">
            <UserCog className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Les gestionnaires listés ici sont des personnes de l&apos;équipe.
              Leur accès au back-office (compte, mot de passe, rôle) se gère
              dans{" "}
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
        <p role="status" className="text-muted-foreground text-sm">
          {members.length} personne{members.length > 1 ? "s" : ""}
          {kind ? "" : " dans l'équipe"}
        </p>
        {members.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {members.map((member) => (
              <li key={member.id}>
                <StaffCard
                  member={member}
                  summary={summarizeStaffWork(orders, member.id)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <Empty className="bg-card/60 min-h-[40vh] rounded-2xl border border-dashed">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="bg-gradient-brand size-12 rounded-xl text-white shadow-sm [&_svg]:size-6"
              >
                <Users />
              </EmptyMedia>
              <EmptyTitle>Personne dans cette catégorie</EmptyTitle>
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
