import { MailCheck, MailWarning } from "lucide-react";
import { MAIL_FAILURE_FIXES, MAIL_FAILURE_LABELS } from "@/domain/mail/failure";
import type { InvitationMailState } from "@/domain/auth/types";
import { formatDateTimeFr } from "@/lib/format";

/*
 * Ce qu'a donné le dernier envoi d'invitation d'un compte en attente
 * (serveur, aucun état). L'écran affirmait « un lien lui a été envoyé » sans
 * jamais le savoir : il le dit maintenant, et l'écrit sur la carte pour que
 * l'information survive au rechargement.
 *
 * - envoi confirmé : une ligne verte, discrète, avec la date ;
 * - échec : un bloc rouge qui dit CE QUI S'EST PASSÉ puis QUOI FAIRE (règles
 *   pures de domain/mail/failure.ts), et renvoie au bouton « Renvoyer
 *   l'invitation » juste en dessous ;
 * - rien de connu (comptes d'avant la migration 0017, comptes du seed) :
 *   aucune ligne, plutôt qu'une affirmation invérifiable.
 */
export function InvitationMailNotice({
  state,
}: {
  state: InvitationMailState | null;
}) {
  if (state === null) return null;

  if (state.state === "sent") {
    return (
      <p className="text-success -mt-2 flex items-start gap-1.5 text-sm">
        <MailCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Invitation envoyée le {formatDateTimeFr(state.at)} et acceptée par le
          service d&apos;envoi.
        </span>
      </p>
    );
  }

  return (
    <div
      role="alert"
      className="border-destructive/40 bg-destructive/5 -mt-2 flex items-start gap-2 rounded-none border p-3 text-sm"
    >
      <MailWarning
        className="text-destructive mt-0.5 size-4 shrink-0"
        aria-hidden="true"
      />
      <p>
        <strong>L&apos;invitation n&apos;est pas partie</strong>, dernier essai
        le {formatDateTimeFr(state.at)}. {MAIL_FAILURE_LABELS[state.reason]}{" "}
        {MAIL_FAILURE_FIXES[state.reason]}
      </p>
    </div>
  );
}
