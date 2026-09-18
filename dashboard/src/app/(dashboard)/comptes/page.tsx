import { Hourglass, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import { after } from "next/server";
import { AccountCreateForm } from "@/components/accounts/account-create-form";
import { AccountEditor } from "@/components/accounts/account-editor";
import { InvitationMailNotice } from "@/components/accounts/invitation-mail-notice";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { notifyExpiredInvitations } from "@/data/invitation-expiry";
import { getCurrentUser } from "@/data/session";
import { listUsersWithInvitations } from "@/data/users";
import { canManageUsers, ROLE_LABELS } from "@/domain/auth/roles";
import { isLastActiveAdmin } from "@/domain/auth/rules";
import { formatDateFr, formatDateTimeFr } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Gestion des comptes, administrateur seulement : le proxy refuse
 * déjà les autres rôles, la page revérifie. Création en tête (prénom, nom,
 * e-mail, rôle ; sans mot de passe : invitation par e-mail), puis la liste
 * (actifs d'abord) avec, par compte, prénom, nom et rôle modifiables, l'e-mail
 * en lecture seule, activation, lien de mot de passe, dépannage et
 * suppression confirmée. Un compte qui n'a pas encore accepté son invitation
 * est EN ATTENTE D'ACTIVATION : sa carte est translucide, bordée de pointillés
 * (ambre tant que le lien est valable, rouge « Invitation expirée » ensuite),
 * et ses gestes sont « Renvoyer » ou « Annuler l'invitation ». Le compte
 * courant est signalé et ne peut ni se désactiver ni se supprimer ; le
 * dernier administrateur actif non plus (isLastActiveAdmin, règle pure relue
 * ici et par les actions). Après la réponse, la page relance le balayage des
 * invitations expirées (mails à la personne et aux administrateurs), en plus
 * de la minuterie du serveur.
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
  const accounts = await listUsersWithInvitations();
  const activeCount = accounts.filter((a) => a.active).length;
  after(() => notifyExpiredInvitations());

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
            const { invitation } = account;
            return (
              <li key={account.id}>
                <article
                  aria-label={`Compte ${account.name}`}
                  data-invitation={invitation}
                  className={cn(
                    "text-card-foreground flex flex-col gap-4 rounded-2xl p-4 shadow-sm @2xl/main:p-5",
                    invitation === "none" &&
                      "bg-card ring-foreground/10 ring-1",
                    invitation === "pending" &&
                      "bg-card/45 supports-backdrop-filter:bg-card/30 border-warning/60 border border-dashed backdrop-blur-sm",
                    invitation === "expired" &&
                      "bg-card/40 supports-backdrop-filter:bg-card/25 border-destructive/60 border border-dashed backdrop-blur-sm",
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
                    {invitation === "pending" ? (
                      <Badge variant="warning">
                        <Hourglass aria-hidden="true" />
                        En attente d&apos;activation
                      </Badge>
                    ) : null}
                    {invitation === "expired" ? (
                      <Badge variant="destructive">
                        <TimerOff aria-hidden="true" />
                        Invitation expirée
                      </Badge>
                    ) : null}
                    <span className="text-muted-foreground text-sm">
                      créé le {formatDateFr(account.createdAt)}
                    </span>
                  </div>
                  {invitation === "pending" && account.invitationExpiresAt ? (
                    <p className="text-warning -mt-2 text-sm">
                      Lien d&apos;invitation valable jusqu&apos;au{" "}
                      {formatDateTimeFr(account.invitationExpiresAt)} : le
                      compte s&apos;activera quand la personne aura choisi son
                      mot de passe.
                    </p>
                  ) : null}
                  {invitation === "expired" ? (
                    <p className="text-destructive -mt-2 text-sm">
                      {account.invitationExpiresAt
                        ? `Lien d'invitation expiré le ${formatDateTimeFr(account.invitationExpiresAt)} sans avoir été utilisé`
                        : "Aucun lien d'invitation en cours"}{" "}
                      : renvoyez l&apos;invitation ou annulez-la.
                    </p>
                  ) : null}
                  {invitation !== "none" ? (
                    <InvitationMailNotice state={account.invitationMail} />
                  ) : null}
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
