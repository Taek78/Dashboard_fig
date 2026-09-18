import type { Metadata } from "next";
import { CalendarDays, KeyRound, Mail } from "lucide-react";
import { PasswordForm } from "@/components/accounts/password-form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/data/session";
import { getUser } from "@/data/users";
import { ROLE_LABELS } from "@/domain/auth/roles";
import { formatDateFr } from "@/lib/format";
import { initials } from "@/lib/text";

/*
 * « Mon profil », ouvert à tous les rôles (refonte du 2026-09-18) : deux
 * cartes pleine largeur, l'une au-dessus de l'autre.
 * - L'identité : initiales en grand, nom et rôle ; à droite sur grand écran,
 *   l'adresse de connexion (lecture seule : elle ne se modifie jamais) et la
 *   date de création du compte.
 * - Le changement de mot de passe, ses trois champs sur une ligne alignés
 *   par le haut (PasswordForm).
 * Le compte est relu par la source (getUser, sans le hachage) : le nom et le
 * rôle de la session restent affichés si la lecture échoue.
 */
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await getCurrentUser();
  const account = await getUser(user.id);

  return (
    <>
      <PageHeader title="Mon profil" />
      <div className="flex flex-col gap-4 @4xl/main:gap-6">
        <Card className="glow-brand">
          <CardContent className="flex flex-col gap-5 @2xl/main:flex-row @2xl/main:items-center @2xl/main:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <span
                aria-hidden="true"
                className="bg-primary text-primary-foreground flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-semibold shadow-md @2xl/main:size-20 @2xl/main:text-2xl"
              >
                {initials(user.name)}
              </span>
              <div className="flex min-w-0 flex-col items-start gap-2">
                <h2 className="text-2xl font-semibold tracking-tight wrap-anywhere">
                  {user.name}
                </h2>
                <span className="bg-primary/10 text-primary ring-primary/25 rounded-full px-3 py-1 text-xs font-semibold ring-1">
                  {ROLE_LABELS[user.role]}
                </span>
              </div>
            </div>
            {account ? (
              <dl className="text-muted-foreground grid min-w-0 gap-2 text-sm @2xl/main:justify-items-end">
                <div className="flex min-w-0 items-center gap-2">
                  <dt>
                    <Mail className="size-4 shrink-0" aria-hidden="true" />
                    <span className="sr-only">Adresse de connexion</span>
                  </dt>
                  <dd className="text-foreground truncate">{account.email}</dd>
                </div>
                <div className="flex items-center gap-2">
                  <dt>
                    <CalendarDays
                      className="size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <span className="sr-only">Compte créé le</span>
                  </dt>
                  <dd>Compte créé le {formatDateFr(account.createdAt)}</dd>
                </div>
              </dl>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="text-primary size-5" aria-hidden="true" />
              <h2>Changer mon mot de passe</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm context={{ name: user.name }} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
