import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/data/session";
import { canManageStaff } from "@/domain/auth/roles";
import { parseStaffKind } from "@/domain/staff/schemas";

/*
 * Création d'une personne : le même formulaire que la fiche, sans personne,
 * avec le métier présélectionné depuis l'onglet d'origine (?type=). Le rôle
 * est vérifié ici pour l'affichage, et par l'action de toute façon.
 */
export const metadata: Metadata = { title: "Nouvelle personne" };

export default async function NouvellePersonnePage({
  searchParams,
}: PageProps<"/personnel/nouveau">) {
  const [raw, user] = await Promise.all([searchParams, getCurrentUser()]);
  const kind = parseStaffKind(raw);
  const back = (
    <Button variant="outline" size="sm" render={<Link href="/personnel" />}>
      <ArrowLeft />
      Retour au personnel
    </Button>
  );

  if (!canManageStaff(user.role)) {
    return (
      <>
        <PageHeader title="Nouvelle personne" actions={back} />
        <p className="text-muted-foreground text-sm">
          Votre compte ne permet pas de modifier l&apos;équipe.
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Nouvelle personne"
        description="Renseignez la fiche ; vous pourrez tout modifier ensuite."
        actions={back}
      />
      <Card>
        <CardContent>
          <StaffForm defaultKind={kind} />
        </CardContent>
      </Card>
    </>
  );
}
