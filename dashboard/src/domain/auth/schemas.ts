import { z } from "zod";
import { ROLES } from "@/domain/auth/roles";
import { isRecoveryCode } from "@/domain/auth/tokens";
import {
  ACCOUNT_DELETE_CONFIRM_WORD,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  RECOVERY_CODE_LENGTH,
} from "@/domain/auth/types";

/*
 * Schémas zod des ENTRÉES liées aux comptes : connexion, gestion des comptes
 * (/comptes, admin), changement de son propre mot de passe (/profil),
 * récupération par code, invitation, rappel d'adresse et verrouillage. Le mot
 * de passe n'apparaît jamais dans un message d'erreur : zod ne met pas la
 * valeur d'entrée dans ses issues. Zod ne vérifie que les bornes du mot de
 * passe ; la politique complète (password-policy.ts, puis fuites connues) est
 * appliquée par les actions, qui connaissent le nom et l'e-mail du compte.
 */
export { PASSWORD_MIN_LENGTH };

const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
const confirmed = <T extends { newPassword: string; confirmPassword: string }>(
  v: T,
) => v.newPassword === v.confirmPassword;
const CONFIRM_MESSAGE = {
  path: ["confirmPassword"],
  message: "Les deux saisies du nouveau mot de passe diffèrent",
};
/** Prénom (1 caractère au moins) et nom (2 au moins) d'un compte ; le nom seul sert au rappel de l'adresse. */
const firstName = z.string().trim().min(1).max(80);
const lastName = z.string().trim().min(2).max(80);
/** Jeton d'URL (base64url de 32 octets) ; borné, jamais reflété. */
const linkToken = z.string().trim().min(20).max(200);

/* Entrée du formulaire de connexion : validée avant toute recherche de compte. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const userIdSchema = z.string().trim().min(1).max(64);

/* Création par l'administrateur : sans mot de passe, la personne le choisit par le lien d'invitation. L'e-mail ne se modifie plus ensuite. */
export const createUserSchema = z.object({
  email,
  firstName,
  lastName,
  role: z.enum(ROLES),
});

export const updateUserSchema = z.object({
  userId: userIdSchema,
  firstName,
  lastName,
  role: z.enum(ROLES),
});

export const sendPasswordLinkSchema = z.object({ userId: userIdSchema });

/** Annulation d'une invitation : le compte, jamais activé, est supprimé (confirmation à l'écran, sans mot). */
/**
 * Case « Prévenir par mail » des statuts de compte (2026-09-19) : un champ
 * caché « 0 » suivi de la case « 1 » ; Object.fromEntries garde la DERNIÈRE
 * valeur, donc « 1 » si elle est cochée. Absent (ancien formulaire, API
 * interne) = prévenir : un avis n'est coupé que sur demande explicite.
 */
const notifyByMail = z
  .enum(["0", "1"])
  .optional()
  .transform((v) => v !== "0");

export const cancelInvitationSchema = z.object({
  userId: userIdSchema,
  notify: notifyByMail,
});

export const setUserActiveSchema = z.object({
  userId: userIdSchema,
  active: z.enum(["1", "0"]).transform((v) => v === "1"),
  notify: notifyByMail,
});

/** Suppression définitive : le mot SUPPRIMER, en toute casse, tapé par l'administrateur. */
export const deleteUserSchema = z.object({
  userId: userIdSchema,
  notify: notifyByMail,
  confirm: z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.literal(ACCOUNT_DELETE_CONFIRM_WORD)),
});

export const resetPasswordSchema = z.object({
  userId: userIdSchema,
  password,
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(PASSWORD_MAX_LENGTH),
    newPassword: password,
    confirmPassword: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine(confirmed, CONFIRM_MESSAGE)
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'actuel",
  });

/* ---------- Récupération, invitation, rappel, verrouillage (pages publiques) ---------- */

/** Étape 1 de « Mot de passe oublié » : l'adresse du compte. */
export const recoveryRequestSchema = z.object({ email });

/** Étape 2 : le code reçu et le nouveau mot de passe, avec l'adresse rappelée. */
export const recoveryVerifySchema = z
  .object({
    email,
    code: z
      .string()
      .trim()
      .transform((v) => v.replace(/\s+/g, ""))
      .refine(isRecoveryCode, `Code de ${RECOVERY_CODE_LENGTH} chiffres`),
    newPassword: password,
    confirmPassword: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine(confirmed, CONFIRM_MESSAGE);

/** « Adresse e-mail oubliée » : le NOM seul, tel que l'administrateur l'a saisi. */
export const emailReminderSchema = z.object({ lastName });

/** Lien d'invitation : le jeton de l'URL et le mot de passe choisi. */
export const invitationSchema = z
  .object({
    token: linkToken,
    newPassword: password,
    confirmPassword: z.string().max(PASSWORD_MAX_LENGTH),
  })
  .refine(confirmed, CONFIRM_MESSAGE);

/** Lien « Ce n'était pas moi » : le jeton de l'URL, confirmé par un bouton. */
export const lockAccountSchema = z.object({ token: linkToken });
