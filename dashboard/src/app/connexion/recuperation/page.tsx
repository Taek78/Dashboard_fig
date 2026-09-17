import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { LoginShell } from "@/components/auth/login-shell";
import { RecoveryRequestForm } from "@/components/auth/recovery-request-form";
import { RecoveryVerifyForm } from "@/components/auth/recovery-verify-form";
import { AUTH_TOKEN_RULES } from "@/domain/auth/tokens";
import { RECOVERY_CODE_LENGTH } from "@/domain/auth/types";

/*
 * « Mot de passe oublié », page publique en deux étapes sur la même URL :
 * l'adresse (étape 1), puis ?etape=code&email=… (étape 2 : code reçu et
 * nouveau mot de passe). L'adresse voyage dans l'URL : la personne peut
 * recharger la page ou revenir en arrière sans rien perdre, et rien de secret
 * n'y figure (le code reste dans le mail). Le bandeau bleu de l'étape 2 est
 * le même que l'adresse existe ou non.
 */
export const metadata: Metadata = { title: "Mot de passe oublié" };

const BACK = (
  <Link
    href="/connexion"
    className="text-primary text-sm font-medium underline-offset-4 hover:underline"
  >
    Retour à la connexion
  </Link>
);

export default async function RecuperationPage({
  searchParams,
}: PageProps<"/connexion/recuperation">) {
  const params = await searchParams;
  const email =
    typeof params.email === "string" ? params.email.trim().slice(0, 254) : "";
  const codeStep = params.etape === "code" && email.length > 0;

  if (codeStep) {
    return (
      <LoginShell
        title="Code reçu"
        subtitle={`Saisissez le code envoyé à ${email} et choisissez votre nouveau mot de passe.`}
        footer={
          <>
            <Link
              href={`/connexion/recuperation?email=${encodeURIComponent(email)}`}
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              Renvoyer un code
            </Link>
            {BACK}
          </>
        }
      >
        <p
          role="status"
          className="bg-info/10 text-info ring-info/30 mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium ring-1"
        >
          <MailCheck className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span>
            Si un compte actif correspond à cette adresse, un code vient de lui
            être envoyé. Il est valable{" "}
            {AUTH_TOKEN_RULES.recovery_code.validity}.
          </span>
        </p>
        <RecoveryVerifyForm email={email} />
      </LoginShell>
    );
  }

  return (
    <LoginShell
      title="Mot de passe oublié"
      subtitle={`Saisissez l'adresse de votre compte : vous recevrez un code à ${RECOVERY_CODE_LENGTH} chiffres, valable ${AUTH_TOKEN_RULES.recovery_code.validity}, pour choisir un nouveau mot de passe.`}
      footer={BACK}
    >
      <RecoveryRequestForm defaultEmail={email} />
    </LoginShell>
  );
}
