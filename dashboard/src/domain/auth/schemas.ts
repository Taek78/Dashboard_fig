import { z } from "zod";
import { ROLES } from "@/domain/auth/roles";

/*
 * Schémas zod des ENTRÉES liées aux comptes : connexion, gestion des comptes
 * (/comptes, admin) et changement de son propre mot de passe (/profil). Le mot de passe n'apparaît jamais dans un
 * message d'erreur : zod ne met pas la valeur d'entrée dans ses issues.
 */
export const PASSWORD_MIN_LENGTH = 12;

const email = z
  .email()
  .max(254)
  .transform((v) => v.toLowerCase());
const password = z.string().min(PASSWORD_MIN_LENGTH).max(200);

/* Entrée du formulaire de connexion : validée avant toute recherche de compte. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const userIdSchema = z.string().trim().min(1).max(64);

export const createUserSchema = z.object({
  email,
  name: z.string().trim().min(1).max(80),
  role: z.enum(ROLES),
  password,
});

export const updateUserSchema = z.object({
  userId: userIdSchema,
  name: z.string().trim().min(1).max(80),
  role: z.enum(ROLES),
});

export const setUserActiveSchema = z.object({
  userId: userIdSchema,
  active: z.enum(["1", "0"]).transform((v) => v === "1"),
});

export const resetPasswordSchema = z.object({
  userId: userIdSchema,
  password,
});

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: password,
    confirmPassword: z.string().max(200),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Les deux saisies du nouveau mot de passe diffèrent",
  })
  .refine((v) => v.newPassword !== v.currentPassword, {
    path: ["newPassword"],
    message: "Le nouveau mot de passe doit être différent de l'actuel",
  });
