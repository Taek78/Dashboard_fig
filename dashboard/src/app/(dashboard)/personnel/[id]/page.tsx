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
import { getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { STAFF_KIND_LABELS } from "@/domain/staff/kind";
import {
  filterStaffHistory,
  hasStaffHistoryFilters,
  staffFullName,
  staffOrders,
  summarizeStaffWork,
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
 */
export const metadata: Metadata = { title: "Fiche personnel" };

export default async function PersonnePage({
  params,
  searchParams,
}: PageProps<"/personnel/[id]">) {
  const { id } = await params;
  const parsed = staffIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  // Seulement les commandes de la personne (préparateur ou livreur), filtrées par la base.
  const [member, orders, user, raw] = await Promise.all([
    getStaff(parsed.data),
    getOrders({ staffId: parsed.data }),
    getCurrentUser(),
    searchParams,
  ]);
  if (!member) notFound();
  const name = staffFullName(member);
  const filters = parseStaffHistoryFilters(raw);
  const filtered = hasStaffHistoryFilters(filters);
  const total = staffOrders(orders, member.id).length;
  const history = filterStaffHistory(orders, member.id, filters);
  const summary = summarizeStaffWork(orders, member.id);
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
            orders={history}
            totalCount={total}
            summary={summary}
            filtered={filtered}
            filters={
              <StaffHistoryFilters
                staffId={member.id}
                filters={filters}
                canReset={filtered}
              />
            }
          />
        </CardContent>
      </Card>
    </>
  );
}
