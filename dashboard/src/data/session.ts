import "server-only";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import type { CurrentUser } from "@/domain/auth/types";
import { verifySession } from "@/lib/dal";

/*
 * Utilisateur courant pour les pages et les Server Actions : délègue à
 * verifySession() (Auth.js), qui redirige vers /connexion sans session valide.
 * Ce point d'entrée unique permet de changer de mécanisme de session sans
 * toucher aux actions.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return verifySession();
}

/*
 * Rouvre la session de la personne qui vient de changer son propre mot de
 * passe : ce changement ferme toutes ses sessions (isSessionAlive), y compris
 * celle-ci ; on en ouvre une nouvelle sans redirection, avec le nouveau mot
 * de passe, pour qu'elle reste connectée. Un refus d'Auth.js (verrou de
 * connexion en cours) n'est pas une erreur : elle se reconnectera.
 */
export async function reopenSession(
  email: string,
  password: string,
): Promise<void> {
  try {
    await signIn("credentials", { email, password, redirect: false });
  } catch (error) {
    if (!(error instanceof AuthError)) throw error;
  }
}
