import type { Metadata } from "next";
import { AccountCreateForm } from "@/components/accounts/account-create-form";
import { AccountEditor } from "@/components/accounts/account-editor";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/data/session";
import { listUsers } from "@/data/users";
import { canManageUsers, ROLE_LABELS } from "@/domain/auth/roles";
import { isLastActiveAdmin } from "@/domain/auth/rules";
import { formatDateFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Gestion des comptes, administrateur seulement : le proxy refuse
 * déjà les autres rôles, la page revérifie. Création en tête (prénom, nom,
 * e-mail, rôle ; sans mot de passe : invitation par e-mail), puis la liste
 * (actifs d'abord) avec, par compte, prénom, nom et rôle modifiables, l'e-mail
 * en lecture seule, activation, lien de mot de passe, dépannage et
 * suppression confirmée. Un compte qui n'a pas encore accepté son invitation
 * porte le badge « Invitation en attente ». Le compte courant est signalé et
 * ne peut ni se désactiver ni se supprimer ; le dernier administrateur actif
 * non plus (isLastActiveAdmin, règle pure relue ici et par les actions).
 */
export const metadata: Metadata = { title: "Comptes" };

export default async function ComptesPage() {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    return (
      <>
        <PageHeader title="Comptes" />
        <p className="text-muted-foreground text-sm">
          Seul un administrateur peut gérer les comptes.
        </p>
      </>
    );
  }
  const accounts = await listUsers();
  const activeCount = accounts.filter((a) => a.active).length;

  return (
    <>
      <PageHeader title="Comptes" />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2>Nouveau compte</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AccountCreateForm />
        </CardContent>
      </Card>

      <section className="flex flex-col gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            Comptes existants
          </h2>
          <p role="status" className="text-muted-foreground text-sm">
            {accounts.length} compte{accounts.length > 1 ? "s" : ""},{" "}
            {activeCount} actif{activeCount > 1 ? "s" : ""}.
          </p>
        </div>
        <ul className="flex flex-col gap-4">
          {accounts.map((account) => {
            const isSelf = account.id === user.id;
            const lastAdmin = isLastActiveAdmin(accounts, account.id);
            return (
              <li key={account.id}>
                <article
                  aria-label={`Compte ${account.name}`}
                  className={cn(
                    "bg-card text-card-foreground ring-foreground/10 flex flex-col gap-4 rounded-2xl p-4 shadow-sm ring-1 @2xl/main:p-5",
                    !account.active && "opacity-70",
                  )}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{account.name}</h3>
                    {isSelf ? <Badge variant="outline">vous</Badge> : null}
                    <Badge
                      variant={
                        account.role === "admin" ? "default" : "secondary"
                      }
                    >
                      {ROLE_LABELS[account.role]}
                    </Badge>
                    {account.active ? (
                      <Badge variant="success">Actif</Badge>
                    ) : (
                      <Badge variant="destructive">Désactivé</Badge>
                    )}
                    {!account.hasPassword ? (
                      <Badge variant="warning">Invitation en attente</Badge>
                    ) : null}
                    <span className="text-muted-foreground text-sm">
                      créé le {formatDateFr(account.createdAt)}
                    </span>
                  </div>
                  <AccountEditor
                    account={account}
                    isSelf={isSelf}
                    lastAdmin={lastAdmin}
                  />
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
