import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Copy } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StaffForm } from "@/components/staff/staff-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getCurrentUser } from "@/data/session";
import { getStaff } from "@/data/staff";
import { canManageStaff } from "@/domain/auth/roles";
import { staffFullName, staffTemplate } from "@/domain/staff/rules";
import { parseStaffKind, staffIdSchema } from "@/domain/staff/schemas";

/*
 * Création d'une personne : le même formulaire que la fiche, sans personne,
 * avec le métier présélectionné depuis l'onglet d'origine (?type=). Depuis
 * « Dupliquer » (?depuis=id), la fiche d'origine préremplit métier, créneau,
 * disponibilité, jours et présence (staffTemplate) ; l'identité reste à
 * saisir. Le rôle est vérifié ici pour l'affichage, et par l'action.
 */
export const metadata: Metadata = { title: "Nouvelle personne" };

export default async function NouvellePersonnePage({
  searchParams,
}: PageProps<"/personnel/nouveau">) {
  const [raw, user] = await Promise.all([searchParams, getCurrentUser()]);
  const kind = parseStaffKind(raw);
  const back = (
    <Link
      href="/personnel"
      className={buttonVariants({ variant: "outline", size: "sm" })}
    >
      <ArrowLeft />
      Retour au personnel
    </Link>
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

  const sourceId = staffIdSchema.safeParse(raw.depuis);
  const source = sourceId.success ? await getStaff(sourceId.data) : null;

  return (
    <>
      <PageHeader
        title="Nouvelle personne"
        description="Renseignez la fiche ; vous pourrez tout modifier ensuite."
        actions={back}
      />
      {source ? (
        <p
          role="status"
          className="bg-muted/40 flex items-start gap-2 rounded-xl border p-3 text-sm"
        >
          <Copy className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            Duplication de la fiche de {staffFullName(source)} : métier,
            créneau, disponibilité et jours travaillés sont repris. Renseignez
            l&apos;identité, les coordonnées et la date d&apos;entrée.
          </span>
        </p>
      ) : null}
      <Card>
        <CardContent>
          <StaffForm
            defaultKind={kind}
            template={source ? staffTemplate(source) : undefined}
          />
        </CardContent>
      </Card>
    </>
  );
}
