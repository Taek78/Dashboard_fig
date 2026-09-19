"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createToken } from "@/data/auth-tokens";
import { sendMailChecked, trySendMail } from "@/data/mail";
import { findPasswordProblem } from "@/data/passwords";
import { logSecurity } from "@/data/security-log";
import { getCurrentUser, reopenSession } from "@/data/session";
import {
  createUser,
  deleteUser,
  getUser,
  listUsers,
  revokeSessions,
  setInvitationMailOutcome,
  setPassword,
  updateUser,
} from "@/data/users";
import {
  accountActivatedMail,
  accountDeactivatedMail,
  accountDeletedMail,
  accountReactivatedMail,
  adminAccountActivatedMail,
  invitationCancelledMail,
  invitationMail,
  type AccountSummary,
} from "@/domain/auth/mails";
import { PASSWORD_PROBLEM_MESSAGES } from "@/domain/auth/password-policy";
import { canManageUsers } from "@/domain/auth/roles";
import {
  activeAdmins,
  isLastActiveAdmin,
  wouldRemoveLastAdmin,
} from "@/domain/auth/rules";
import {
  cancelInvitationSchema,
  createUserSchema,
  deleteUserSchema,
  PASSWORD_MIN_LENGTH,
  resetPasswordSchema,
  sendPasswordLinkSchema,
  setUserActiveSchema,
  updateUserSchema,
} from "@/domain/auth/schemas";
import { AUTH_TOKEN_RULES, tokenExpiresAt } from "@/domain/auth/tokens";
import {
  ACCOUNT_DELETE_CONFIRM_WORD,
  type CurrentUser,
  type ManagedUser,
} from "@/domain/auth/types";
import { mailFailureText } from "@/domain/mail/failure";
import type { MailOutcome } from "@/domain/mail/types";
import type { ActionResult } from "@/lib/action-result";
import { appUrl } from "@/lib/app-url";
import { getEnv } from "@/lib/env";
import { hashPassword } from "@/lib/password";
import { generateLinkToken, hashSecret } from "@/lib/secrets";

/*
 * Server Actions de la gestion des comptes, réservées à
 * l'administrateur. Même discipline : session → rôle → zod → relecture →
 * règles (jamais se désactiver ni se supprimer soi-même, jamais toucher au
 * dernier administrateur actif) → écriture → journal → revalidation. Les mots
 * de passe sont hachés ici et n'apparaissent dans aucun message ni journal.
 *
 * Depuis le 2026-09-17, un compte se crée SANS mot de passe : la personne le
 * choisit par un lien d'invitation (48 h, une seule fois) dont l'envoi est
 * ATTENDU (2026-09-18) — l'écran dit s'il est parti, et sinon pourquoi et quoi
 * faire ; « Envoyer un lien » renvoie ce lien à tout compte actif (compte
 * jamais activé, ou mot de passe à remplacer). Tant que le mot de passe
 * n'existe pas, le compte est EN ATTENTE D'ACTIVATION : « Annuler
 * l'invitation » le supprime (jamais activé, rien à conserver), le lien cesse
 * de fonctionner et la personne en est avertie par mail si son invitation
 * était bien partie. Quand il s'active (lien accepté, ou dépannage ici), la
 * personne et les administrateurs reçoivent un avis d'activation. « Nouveau
 * mot de passe » reste le dépannage quand le mail ne passe pas : il applique
 * la même politique (règles pures puis fuites connues). Désactiver un compte
 * ferme ses sessions sur-le-champ ; changer un mot de passe aussi (le sien
 * est rouvert). Un compte porte un prénom et un nom (le nom seul sert au
 * rappel de l'adresse) ; son e-mail se lit mais ne se modifie pas. Supprimer
 * un compte (mot SUPPRIMER) est définitif : ses jetons partent en cascade, ses
 * sessions tombent à la requête suivante, l'historique des commandes garde le
 * nom écrit. Désactiver ou supprimer un compte envoie un mail à la personne,
 * après la réponse (after) : la date, ce que cela change, et l'ADRESSE de
 * l'administrateur à qui écrire, jamais son nom (demande du 2026-09-18).
 */
const MESSAGES = {
  forbidden: "Seul un administrateur peut gérer les comptes.",
  invalid:
    "Vérifiez la saisie : prénom, nom (2 caractères au moins), e-mail valide, rôle.",
  invalidPassword: `Vérifiez la saisie : mot de passe de ${PASSWORD_MIN_LENGTH} caractères au moins.`,
  confirm: `Tapez ${ACCOUNT_DELETE_CONFIRM_WORD} pour confirmer la suppression.`,
  emailTaken: "Un compte existe déjà avec cet e-mail.",
  nameTaken: "Un compte porte déjà ce prénom et ce nom.",
  notFound: "Ce compte n'existe plus.",
  inactive: "Ce compte est désactivé : réactivez-le avant d'envoyer un lien.",
  activated:
    "Ce compte est déjà activé : pour le retirer, utilisez « Supprimer ce compte ».",
  self: "Vous ne pouvez pas désactiver votre propre compte.",
  selfDelete: "Vous ne pouvez pas supprimer votre propre compte.",
  lastAdmin:
    "Impossible : ce compte est le dernier administrateur actif du back-office.",
  failure: "Impossible d'enregistrer. Réessayez dans un instant.",
} as const;

/** L'administrateur qui agit : seule son adresse paraît dans l'avis à la personne (adminContact). */
function contactOf(
  users: readonly ManagedUser[],
  user: CurrentUser,
): AccountSummary {
  const me = users.find((u) => u.id === user.id);
  return { name: user.name, email: me?.email ?? "" };
}

/**
 * Crée le lien d'invitation, ATTEND son envoi, écrit l'issue sur le compte,
 * journalise.
 *
 * L'attente est délibérée, contrairement aux mails d'information (avis de
 * désactivation, de suppression) qui partent en `after()` : sans ce lien, la
 * personne ne peut pas entrer, donc l'administrateur doit savoir tout de
 * suite si le mail est parti, et pourquoi sinon. Le coût est un aller-retour
 * HTTP vers le fournisseur (10 s au pire, délai du transport) sur une action
 * rare. L'issue est aussi écrite en base : la carte le dit encore après un
 * rechargement.
 */
async function issueInvitation(
  target: ManagedUser,
  by: CurrentUser,
  reason: "creation" | "reset",
): Promise<MailOutcome> {
  const secret = generateLinkToken();
  await createToken({
    kind: "invitation",
    userId: target.id,
    secretHash: hashSecret(secret, getEnv().AUTH_SECRET),
    expiresAt: tokenExpiresAt("invitation", Date.now()),
    requestedIp: null,
  });
  const mail = invitationMail({
    to: { email: target.email, name: target.name },
    url: appUrl(`/connexion/invitation?jeton=${secret}`),
    reason,
  });
  const outcome = await sendMailChecked("invitation", mail);
  await setInvitationMailOutcome(target.id, outcome, new Date());
  logSecurity(
    outcome.sent
      ? { type: "invitation_sent", userId: by.id, targetId: target.id }
      : {
          type: "invitation_mail_failed",
          userId: by.id,
          targetId: target.id,
          reason: outcome.reason,
        },
  );
  return outcome;
}

/**
 * Avis d'activation, après la réponse : à la personne (tout ce qu'il faut
 * pour se connecter) et à chaque administrateur actif (pour information).
 * `by` : l'administrateur qui a attribué le mot de passe (dépannage).
 */
function announceActivation(
  target: ManagedUser,
  users: readonly ManagedUser[],
  at: string,
  by: string,
): void {
  const admins = activeAdmins(users).map((a) => ({
    name: a.name,
    email: a.email,
  }));
  const account = { name: target.name, email: target.email, role: target.role };
  const comptesUrl = appUrl("/comptes");
  const loginUrl = appUrl("/connexion");
  after(async () => {
    await trySendMail(
      "account_activated",
      accountActivatedMail({
        to: { email: target.email, name: target.name },
        at,
        role: target.role,
        loginUrl,
        admins,
        byAdmin: true,
      }),
    );
    await Promise.all(
      admins.map((admin) =>
        trySendMail(
          "admin_account_activated",
          adminAccountActivatedMail({ to: admin, account, at, comptesUrl, by }),
        ),
      ),
    );
  });
}

export async function createAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "createAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };

  try {
    const created = await createUser({
      email: parsed.data.email,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      role: parsed.data.role,
      passwordHash: null,
    });
    if (created === "email_taken") {
      return { status: "error", message: MESSAGES.emailTaken };
    }
    if (created === "name_taken") {
      return { status: "error", message: MESSAGES.nameTaken };
    }
    logSecurity({
      type: "account_created",
      userId: user.id,
      targetId: created.id,
      role: created.role,
    });
    const outcome = await issueInvitation(created, user, "creation");
    revalidatePath("/comptes", "layout");
    if (!outcome.sent) {
      return {
        status: "warning",
        message: `Compte « ${created.name} » créé, mais l'invitation n'est pas partie. ${mailFailureText(outcome.reason)} Sa carte porte « Renvoyer l'invitation ».`,
      };
    }
    return {
      status: "success",
      message: `Compte « ${created.name} » créé, en attente d'activation : un lien pour choisir son mot de passe a bien été envoyé à ${created.email}, valable ${AUTH_TOKEN_RULES.invitation.validity}.`,
    };
  } catch (error) {
    console.error("[createAccount]", { userId: user.id }, error);
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function sendPasswordLink(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "sendPasswordLink",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = sendPasswordLinkSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };

  try {
    const target = await getUser(parsed.data.userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    if (!target.active) return { status: "error", message: MESSAGES.inactive };
    const outcome = await issueInvitation(
      target,
      user,
      target.hasPassword ? "reset" : "creation",
    );
    // La carte affiche la nouvelle validité du lien, et l'issue de l'envoi.
    revalidatePath("/comptes", "layout");
    if (!outcome.sent) {
      return {
        status: "warning",
        message: `Le lien pour « ${target.name} » n'est pas parti. ${mailFailureText(outcome.reason)}`,
      };
    }
    return {
      status: "success",
      message: `Lien bien envoyé à « ${target.name} » (${target.email}), valable ${AUTH_TOKEN_RULES.invitation.validity}.`,
    };
  } catch (error) {
    console.error(
      "[sendPasswordLink]",
      { userId: user.id, targetId: parsed.data.userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function cancelInvitation(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "cancelInvitation",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = cancelInvitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, notify } = parsed.data;

  try {
    const target = await getUser(userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    // Un compte activé a un historique et des sessions : c'est une suppression, avec son mot.
    if (target.hasPassword) {
      return { status: "error", message: MESSAGES.activated };
    }
    const users = await listUsers();
    const deleted = await deleteUser(userId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "invitation_cancelled",
      userId: user.id,
      targetId: userId,
    });
    /*
     * Avis à la personne, après la réponse : elle a peut-être reçu le lien et
     * s'apprêtait à l'utiliser. Seulement si l'invitation était bien PARTIE :
     * quand l'envoi a échoué (adresse fausse, par exemple), écrire à cette
     * adresse n'apprendrait rien à personne et pourrait déranger un inconnu.
     */
    const told = notify && target.invitationMail?.state === "sent";
    if (told) {
      const mail = invitationCancelledMail({
        to: { email: target.email, name: target.name },
        at: new Date().toISOString(),
        admin: contactOf(users, user),
      });
      after(() => trySendMail("invitation_cancelled", mail));
    }
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Invitation de « ${target.name} » annulée : le compte est supprimé et le lien reçu ne fonctionne plus.${
        told
          ? " Un message le lui annonce."
          : notify
            ? " Aucun message envoyé : son invitation n'était jamais partie."
            : " Aucun message envoyé."
      }`,
    };
  } catch (error) {
    console.error(
      "[cancelInvitation]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function updateAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "updateAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = updateUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, firstName, lastName, role } = parsed.data;

  try {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (wouldRemoveLastAdmin(users, userId, { role })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const updated = await updateUser(userId, { firstName, lastName, role });
    if (updated === "name_taken") {
      return { status: "error", message: MESSAGES.nameTaken };
    }
    if (!updated) return { status: "error", message: MESSAGES.notFound };
    logSecurity({
      type: "account_updated",
      userId: user.id,
      targetId: updated.id,
      role: updated.role,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${updated.name} » enregistré.`,
    };
  } catch (error) {
    console.error(
      "[updateAccount]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function setAccountActive(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "setAccountActive",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = setUserActiveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.invalid };
  const { userId, active, notify } = parsed.data;
  if (!active && userId === user.id) {
    return { status: "error", message: MESSAGES.self };
  }

  try {
    const users = await listUsers();
    if (!users.some((u) => u.id === userId)) {
      return { status: "error", message: MESSAGES.notFound };
    }
    if (wouldRemoveLastAdmin(users, userId, { active })) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const updated = await updateUser(userId, { active });
    if (!updated || updated === "name_taken") {
      return { status: "error", message: MESSAGES.notFound };
    }
    const at = new Date();
    if (!active) await revokeSessions(userId, at);
    // Avis à la personne, après la réponse, sauf si « Prévenir par mail » est décochée.
    if (notify) {
      const to = { email: updated.email, name: updated.name };
      const admin = contactOf(users, user);
      const mail = active
        ? accountReactivatedMail({
            to,
            at: at.toISOString(),
            loginUrl: appUrl("/connexion"),
            admin,
          })
        : accountDeactivatedMail({ to, at: at.toISOString(), admin });
      after(() =>
        trySendMail(
          active ? "account_reactivated" : "account_deactivated",
          mail,
        ),
      );
    }
    logSecurity({
      type: active ? "account_reactivated" : "account_deactivated",
      userId: user.id,
      targetId: updated.id,
    });
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${updated.name} » ${active ? "réactivé" : "désactivé"}${
        notify ? " ; un message l'en informe." : " ; aucun message envoyé."
      }`,
    };
  } catch (error) {
    console.error(
      "[setAccountActive]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function deleteAccount(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "deleteAccount",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = deleteUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: MESSAGES.confirm };
  const { userId, notify } = parsed.data;
  if (userId === user.id) {
    return { status: "error", message: MESSAGES.selfDelete };
  }

  try {
    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    if (isLastActiveAdmin(users, userId)) {
      return { status: "error", message: MESSAGES.lastAdmin };
    }
    const deleted = await deleteUser(userId);
    if (!deleted) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "account_deleted", userId: user.id, targetId: userId });
    // À l'ancienne adresse du compte : un nouveau compte peut y être créé, sur invitation.
    if (notify) {
      const mail = accountDeletedMail({
        to: { email: target.email, name: target.name },
        at: new Date().toISOString(),
        admin: contactOf(users, user),
      });
      after(() => trySendMail("account_deleted", mail));
    }
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: `Compte « ${target.name} » supprimé${
        notify
          ? " ; un message l'en informe à son ancienne adresse."
          : " ; aucun message envoyé."
      }`,
    };
  } catch (error) {
    console.error(
      "[deleteAccount]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}

export async function resetAccountPassword(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!canManageUsers(user.role)) {
    logSecurity({
      type: "forbidden",
      userId: user.id,
      action: "resetAccountPassword",
    });
    return { status: "error", message: MESSAGES.forbidden };
  }
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { status: "error", message: MESSAGES.invalidPassword };
  }
  const { userId, password } = parsed.data;

  try {
    const users = await listUsers();
    const target = users.find((u) => u.id === userId);
    if (!target) return { status: "error", message: MESSAGES.notFound };
    const problem = await findPasswordProblem(password, {
      email: target.email,
      name: target.name,
    });
    if (problem) {
      return { status: "error", message: PASSWORD_PROBLEM_MESSAGES[problem] };
    }
    const changedAt = new Date();
    const ok = await setPassword(
      userId,
      await hashPassword(password),
      changedAt,
    );
    if (!ok) return { status: "error", message: MESSAGES.notFound };
    logSecurity({ type: "password_reset", userId: user.id, targetId: userId });
    if (userId === user.id) await reopenSession(target.email, password);
    // Premier mot de passe d'un compte invité : c'est son activation.
    const activated = !target.hasPassword;
    if (activated) {
      announceActivation(target, users, changedAt.toISOString(), user.name);
    }
    revalidatePath("/comptes", "layout");
    return {
      status: "success",
      message: activated
        ? `Compte « ${target.name} » activé avec ce mot de passe ; un message l'en informe, ainsi que les administrateurs. Communiquez-le par un canal sûr : la personne devra le changer à sa première connexion.`
        : `Nouveau mot de passe enregistré pour « ${target.name} » ; ses sessions sont fermées. Communiquez-le par un canal sûr, ou préférez « Envoyer un lien ».`,
    };
  } catch (error) {
    console.error(
      "[resetAccountPassword]",
      { userId: user.id, targetId: userId },
      error,
    );
    return { status: "error", message: MESSAGES.failure };
  }
}
