import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DeleteStaffButton } from "@/components/staff/delete-staff-button";
import {
  AvailabilityBadge,
  StaffKindBadge,
} from "@/components/staff/staff-badges";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffHistory } from "@/components/staff/staff-history";
import { StaffHistoryFilters } from "@/components/staff/staff-history-filters";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrdersPage, getStaffWorkSummary } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { parsePage, parsePeriodInput } from "@/domain/orders/schemas";
import { STAFF_KIND_LABELS } from "@/domain/staff/kind";
import {
  hasStaffHistoryFilters,
  staffFullName,
  staffHistoryOrderFilters,
  staffHistoryQuery,
} from "@/domain/staff/rules";
import {
  parseStaffHistoryFilters,
  staffIdSchema,
} from "@/domain/staff/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Fiche d'une personne : identité et badges, puis EN HAUT le formulaire
 * complet (#modifier, cible du bouton « Modifier » des cartes ; lecture seule
 * selon le rôle) et la suppression, ensuite l'historique de traitement
 * (compteurs, recherche ?q=&role=&statut=&du=&au=, commandes). « Dupliquer »
 * ouvre une nouvelle fiche préremplie. ?cree=1 confirme une création.
 * La base fait tout le travail de l'historique : les compteurs de la personne
 * (un agrégat) et UNE page de ses commandes filtrées (?page=), jamais tout
 * son historique.
 */
export const metadata: Metadata = { title: "Fiche personnel" };

export default async function PersonnePage({
  params,
  searchParams,
}: PageProps<"/personnel/[id]">) {
  const { id } = await params;
  const parsed = staffIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const raw = await searchParams;
  const filters = parseStaffHistoryFilters(raw);
  const period = parsePeriodInput(raw);

  const [member, history, summary, user] = await Promise.all([
    getStaff(parsed.data),
    getOrdersPage(
      staffHistoryOrderFilters(parsed.data, filters),
      parsePage(raw),
    ),
    getStaffWorkSummary(parsed.data),
    getCurrentUser(),
  ]);
  if (!member) notFound();
  const name = staffFullName(member);
  const filtered = hasStaffHistoryFilters(filters) || period.error !== null;
  const canManage = canManageStaff(user.role);

  return (
    <>
      <PageHeader
        title={name}
        description={`${STAFF_KIND_LABELS[member.kind]} · dans l'équipe depuis le ${formatDateFr(member.startedAt)}`}
        actions={
          <div className="flex flex-wrap gap-2">
            {canManage ? (
              <Link
                href={`/personnel/nouveau?depuis=${member.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <Copy />
                Dupliquer
              </Link>
            ) : null}
            <Link
              href="/personnel"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ArrowLeft />
              Retour au personnel
            </Link>
          </div>
        }
      />
      {raw.cree === "1" ? (
        <p
          role="status"
          className="text-success flex items-center gap-1.5 text-sm"
        >
          <CircleCheck className="size-4" aria-hidden="true" />
          Personne ajoutée à l&apos;équipe. Elle peut maintenant être affectée
          aux commandes.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-1.5">
        <StaffKindBadge kind={member.kind} />
        <AvailabilityBadge
          availability={member.availability}
          active={member.active}
        />
      </div>

      <Card id="modifier" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>
            <h2>{canManage ? "Modifier la fiche" : "Fiche"}</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-8">
          {canManage ? (
            <>
              <StaffForm key={member.id} member={member} />
              <div className="border-t pt-6">
                <DeleteStaffButton staffId={member.id} name={name} />
              </div>
            </>
          ) : (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">E-mail</dt>
              <dd className="font-medium break-all">{member.email}</dd>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd className="font-medium">{member.phone}</dd>
              <dt className="text-muted-foreground">Notes</dt>
              <dd>{member.notes ?? "—"}</dd>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card id="historique" className="scroll-mt-20">
        <CardHeader>
          <CardTitle>
            <h2>Historique de traitement</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <StaffHistory
            staffId={member.id}
            page={history}
            totalCount={summary.assigned}
            summary={summary}
            filtered={filtered}
            range={period.range}
            baseParams={staffHistoryQuery(filters)}
            filters={
              <StaffHistoryFilters
                staffId={member.id}
                filters={filters}
                period={period}
                canReset={filtered}
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
