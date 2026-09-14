import type { Metadata } from "next";
import { PasswordForm } from "@/components/accounts/password-form";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/data/session";
import { ROLE_LABELS } from "@/domain/auth/roles";

/* Profil, ouvert à tous les rôles : qui je suis, changer mon mot de passe. */
export const metadata: Metadata = { title: "Profil" };

export default async function ProfilPage() {
  const user = await getCurrentUser();

  return (
    <>
      <PageHeader
        title="Mon profil"
        description="Votre compte et votre mot de passe."
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Compte</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Nom</dt>
              <dd className="font-medium">{user.name}</dd>
              <dt className="text-muted-foreground">Rôle</dt>
              <dd>
                <Badge variant="secondary">{ROLE_LABELS[user.role]}</Badge>
              </dd>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>
              <h2>Changer mon mot de passe</h2>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordForm />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
