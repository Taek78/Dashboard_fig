import "server-only";
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
