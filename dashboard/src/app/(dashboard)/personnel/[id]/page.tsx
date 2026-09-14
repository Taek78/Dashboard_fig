import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CircleCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { DeleteStaffButton } from "@/components/staff/delete-staff-button";
import {
  AvailabilityBadge,
  StaffKindBadge,
} from "@/components/staff/staff-badges";
import { StaffForm } from "@/components/staff/staff-form";
import { StaffHistory } from "@/components/staff/staff-history";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getOrders } from "@/data/orders";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { STAFF_KIND_LABELS } from "@/domain/staff/kind";
import {
  staffFullName,
  staffOrders,
  summarizeStaffWork,
} from "@/domain/staff/rules";
import { staffIdSchema } from "@/domain/staff/schemas";
import { formatDateFr } from "@/lib/format";

/*
 * Fiche d'une personne : identité et badges, formulaire complet (ou lecture
 * seule selon le rôle), historique de traitement (commandes préparées ou
 * livrées, compteurs), suppression. ?cree=1 confirme une création.
 */
export const metadata: Metadata = { title: "Fiche personnel" };

export default async function PersonnePage({
  params,
  searchParams,
}: PageProps<"/personnel/[id]">) {
  const { id } = await params;
  const parsed = staffIdSchema.safeParse(id);
  if (!parsed.success) notFound();

  const [member, orders, user, raw] = await Promise.all([
    getStaff(parsed.data),
    getOrders(),
    getCurrentUser(),
    searchParams,
  ]);
  if (!member) notFound();
  const name = staffFullName(member);
  const history = staffOrders(orders, member.id);
  const summary = summarizeStaffWork(orders, member.id);
  const canManage = canManageStaff(user.role);

  return (
    <>
      <PageHeader
        title={name}
        description={`${STAFF_KIND_LABELS[member.kind]} · dans l'équipe depuis le ${formatDateFr(member.startedAt)}`}
        actions={
          <Button
            variant="outline"
            size="sm"
            render={<Link href="/personnel" />}
          >
            <ArrowLeft />
            Retour au personnel
          </Button>
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

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Historique de traitement</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <StaffHistory
              staffId={member.id}
              orders={history}
              summary={summary}
            />
          </CardContent>
        </Card>

        <Card className="xl:order-first">
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
      </div>
    </>
  );
}
