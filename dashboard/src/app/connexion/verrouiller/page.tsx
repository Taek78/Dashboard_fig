import type { Metadata } from "next";
import Link from "next/link";
import { LockAccountForm } from "@/components/auth/lock-account-form";
import { LoginShell } from "@/components/auth/login-shell";
import { findUsableLink } from "@/data/auth-tokens";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";

/*
 * « Ce n'était pas moi » (?jeton=…), page publique : si le lien est valable
 * (24 h, non consommé), un bouton pour verrouiller le compte ; l'ouverture de
 * la page ne fait rien (un robot de messagerie qui suit les liens ne
 * verrouille personne). Sinon un message unique.
 */
export const metadata: Metadata = { title: "Verrouiller mon compte" };

const BACK = (
  <Link
    href="/connexion"
    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
  >
    Retour à la connexion
  </Link>
);

export default async function VerrouillerPage({
  searchParams,
}: PageProps<"/connexion/verrouiller">) {
  const params = await searchParams;
  const secret =
    typeof params.jeton === "string" ? params.jeton.trim().slice(0, 200) : "";
  const token = await findUsableLink("lock_link", secret);

  if (!token) {
    return (
      <LoginShell
        title="Lien expiré"
        subtitle={`Ce lien n'est plus valable (${AUTH_TOKEN_RULES.lock_link.validity}). Si vous pensez que votre compte est en danger, prévenez votre administrateur : il peut le désactiver depuis Comptes.`}
        footer={BACK}
      >
        <p className="sr-only">Aucun formulaire.</p>
      </LoginShell>
    );
  }

  return (
    <LoginShell
      title="Ce n'était pas vous ?"
      subtitle="Vous avez reçu un mail de récupération que vous n'aviez pas demandé. Verrouillez votre compte : il sera désactivé, ses sessions fermées, et votre administrateur prévenu pour vous rendre l'accès après vérification."
      footer={BACK}
    >
      <LockAccountForm token={secret} />
    </LoginShell>
  );
}
