import type { Metadata } from "next";
import Link from "next/link";
import { InvitationForm } from "@/components/auth/invitation-form";
import { LoginShell } from "@/components/auth/login-shell";
import { findUsableLink } from "@/data/auth-tokens";
import { findUserById } from "@/data/users";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";

/*
 * Lien d'invitation (?jeton=…), page publique : si le jeton est utilisable
 * (48 h, non consommé, compte actif), le formulaire du mot de passe, avec le
 * prénom de la personne ; sinon un message unique, sans dire pourquoi.
 * L'affichage ne consomme rien : seule l'action le fait.
 */
export const metadata: Metadata = { title: "Choisir mon mot de passe" };

const BACK = (
  <Link
    href="/connexion"
    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
  >
    Retour à la connexion
  </Link>
);

export default async function InvitationPage({
  searchParams,
}: PageProps<"/connexion/invitation">) {
  const params = await searchParams;
  const secret =
    typeof params.jeton === "string" ? params.jeton.trim().slice(0, 200) : "";
  const token = await findUsableLink("invitation", secret);
  const user = token ? await findUserById(token.userId) : null;

  if (!user || !user.active) {
    return (
      <LoginShell
        title="Lien expiré"
        subtitle={`Ce lien n'est plus valable (${AUTH_TOKEN_RULES.invitation.validity}, une seule fois). Demandez un nouveau lien à votre administrateur.`}
        footer={BACK}
      >
        <p className="sr-only">Aucun formulaire.</p>
      </LoginShell>
    );
  }

  return (
    <LoginShell
      title={`Bienvenue, ${user.name}`}
      subtitle={`Choisissez le mot de passe de votre compte ${user.email}. Vous serez connecté aussitôt.`}
      footer={BACK}
    >
      <InvitationForm
        token={secret}
        context={{ email: user.email, name: user.name }}
      />
    </LoginShell>
  );
}
