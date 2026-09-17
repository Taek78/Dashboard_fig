import "server-only";
import { trySendMail } from "@/data/mail";
import { logSecurity } from "@/data/security-log";
import { expireInvitations, listUsers } from "@/data/users";
import {
  adminInvitationExpiredMail,
  invitationExpiredMail,
} from "@/domain/auth/mails";
import { activeAdmins } from "@/domain/auth/rules";
import { appUrl } from "@/lib/app-url";

/*
 * Invitations expirées (décision du client, 2026-09-17) : un compte créé sans
 * mot de passe reste « en attente d'activation » tant que la personne n'a pas
 * choisi le sien par le lien reçu (48 h). Passé ce délai, la personne ET les
 * administrateurs actifs en sont avertis par mail, une seule fois par lien
 * (expireInvitations marque le compte dans la même écriture conditionnelle).
 *
 * Un mail « au bout du délai » exige quelque chose qui tourne sans clic :
 * instrumentation.ts lance ce balayage au démarrage du serveur puis toutes
 * les quinze minutes (minuterie détachée, unref, pour ne pas retenir l'arrêt
 * du processus) ; la page Comptes le relance aussi après sa réponse (after),
 * pour un hébergement où le processus ne vit pas entre deux requêtes.
 * L'envoi se fait ici directement (pas de after : hors requête), avec
 * trySendMail, qui journalise un échec sans interrompre les autres envois.
 */
const FIRST_RUN_MS = 60_000;
const EVERY_MS = 15 * 60_000;

/**
 * Prévient, une seule fois par lien, la personne et les administrateurs de
 * chaque invitation expirée à `now`. Renvoie le nombre de comptes traités.
 */
export async function notifyExpiredInvitations(
  now: Date = new Date(),
): Promise<number> {
  const expired = await expireInvitations(now);
  if (expired.length === 0) return 0;
  const admins = activeAdmins(await listUsers()).map((admin) => ({
    name: admin.name,
    email: admin.email,
  }));
  const comptesUrl = appUrl("/comptes");
  for (const account of expired) {
    logSecurity({ type: "invitation_expired", targetId: account.id });
    await trySendMail(
      "invitation_expired",
      invitationExpiredMail({
        to: { email: account.email, name: account.name },
        expiresAt: account.expiresAt,
        admins,
      }),
    );
    await Promise.all(
      admins.map((admin) =>
        trySendMail(
          "admin_invitation_expired",
          adminInvitationExpiredMail({
            to: admin,
            account: {
              name: account.name,
              email: account.email,
              role: account.role,
            },
            expiresAt: account.expiresAt,
            comptesUrl,
          }),
        ),
      ),
    );
  }
  return expired.length;
}

let started = false;

/**
 * Balayage périodique, une fois par processus (appelé par instrumentation.ts) :
 * une minute après le démarrage, puis toutes les quinze minutes. `job` n'est
 * remplacé que par le test (les faux timers gèleraient le pilote PostgreSQL).
 */
export function startInvitationExpiryTimer(
  job: () => Promise<unknown> = notifyExpiredInvitations,
): void {
  if (started) return;
  started = true;
  const run = () => {
    job().catch((error: unknown) => {
      console.error("[invitations] balayage des invitations impossible", error);
    });
  };
  setTimeout(run, FIRST_RUN_MS).unref();
  setInterval(run, EVERY_MS).unref();
}
