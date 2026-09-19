import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { AssignmentRole } from "@/domain/orders/assignment";
import { KIND_FOR_ROLE } from "@/domain/staff/rules";
import { cn } from "@/lib/utils";

/*
 * Alerte du tableau de bord (serveur) quand aucun préparateur, ou aucun
 * livreur, n'est présent : rien ne peut être préparé ou livré tant que
 * quelqu'un n'est pas revenu. Rouge (token --destructive), role="alert",
 * placée avant tout le reste de la page. Un lien mène au métier concerné dans
 * la section Personnel, personnes présentes dans l'équipe.
 */
const HEADLINES: Record<AssignmentRole, string> = {
  preparer: "Aucun préparateur disponible",
  driver: "Aucun livreur disponible",
};

const CONSEQUENCES: Record<AssignmentRole, string> = {
  preparer: "aucune préparation de commande n'est possible",
  driver: "aucune livraison n'est possible",
};

export function StaffShortageAlert({
  roles,
  className,
}: {
  /** Rôles sans personne présente (unavailableRoles) ; rien si vide. */
  roles: readonly AssignmentRole[];
  className?: string;
}) {
  if (roles.length === 0) return null;
  const consequences = roles.map((role) => CONSEQUENCES[role]);
  const sentence =
    consequences.length === 1
      ? consequences[0]
      : `${consequences.slice(0, -1).join(", ")} et ${consequences.at(-1)}`;

  return (
    <div
      role="alert"
      className={cn(
        "bg-destructive/10 text-destructive ring-destructive/40 flex flex-col gap-3 rounded-none px-4 py-3 ring-1 @2xl/main:flex-row @2xl/main:items-center @2xl/main:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold">
            {roles.map((role) => HEADLINES[role]).join(" · ")}
          </p>
          <p className="text-sm">
            Aujourd&apos;hui, {sentence} : personne n&apos;est présent pour
            l&apos;affectation. Vérifiez les disponibilités de l&apos;équipe.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {roles.map((role) => (
          <Link
            key={role}
            href={`/personnel?type=${KIND_FOR_ROLE[role]}&presence=actifs`}
            className={cn(
              buttonVariants({ variant: "outline", size: "sm" }),
              "border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive",
            )}
          >
            {role === "preparer"
              ? "Voir les préparateurs"
              : "Voir les livreurs"}
          </Link>
        ))}
      </div>
    </div>
  );
}
