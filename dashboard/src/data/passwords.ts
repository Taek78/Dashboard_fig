import "server-only";
import { isPasswordPwned } from "@/data/pwned-passwords";
import {
  firstPasswordProblem,
  type PasswordContext,
  type PasswordProblem,
} from "@/domain/auth/password-policy";

/*
 * Politique de mots de passe côté serveur, appliquée par toute action qui
 * enregistre un mot de passe (invitation, récupération, profil, réinitialisation
 * par l'administrateur) APRÈS zod (bornes) : d'abord les règles pures
 * (longueur, composition, mots courants, nom et e-mail du compte, motifs),
 * puis, seulement si elles passent, la vérification contre les fuites connues.
 * Renvoie le premier problème, ou null si le mot de passe est accepté.
 */
export async function findPasswordProblem(
  password: string,
  context: PasswordContext,
): Promise<PasswordProblem | null> {
  const problem = firstPasswordProblem(password, context);
  if (problem) return problem;
  const pwned = await isPasswordPwned(password);
  if (pwned === null) {
    console.warn(
      "[mots de passe] vérification des fuites indisponible : mot de passe accepté sans elle",
    );
    return null;
  }
  return pwned ? "breached" : null;
}
