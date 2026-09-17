import type { Metadata } from "next";
import Link from "next/link";
import { EmailReminderForm } from "@/components/auth/email-reminder-form";
import { LoginShell } from "@/components/auth/login-shell";

/*
 * « Adresse e-mail oubliée », page publique : la personne saisit le nom de son
 * compte (celui que l'administrateur a enregistré, unique) et reçoit un rappel
 * sur l'adresse associée. La réponse ne dit jamais si un nom existe.
 */
export const metadata: Metadata = { title: "Adresse e-mail oubliée" };

export default function AdresseOublieePage() {
  return (
    <LoginShell
      title="Adresse e-mail oubliée"
      subtitle="Saisissez le nom de votre compte, tel que votre administrateur l'a enregistré : un rappel sera envoyé à l'adresse associée."
      footer={
        <Link
          href="/connexion"
          className="text-primary text-sm font-medium underline-offset-4 hover:underline"
        >
          Retour à la connexion
        </Link>
      }
    >
      <EmailReminderForm />
    </LoginShell>
  );
}
