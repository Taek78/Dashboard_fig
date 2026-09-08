import "server-only";
import type { CurrentUser } from "@/domain/auth/types";
import { assertMockSessionAllowed } from "@/domain/auth/guards";
/*
 * Session MOCK du back-office, remplacée en A7 par verifySession() (Auth.js).
 *
 * Pourquoi un stub (stub = fonction qui a la vrai sugnature mais un corps factice) maintenant : chaque Server Action commencera par
 * `await getCurrentUser()` dès A2. Quand l'auth réelle arrive, seul le corps de
 * cette fonction change, pas ses appelants (même type CurrentUser en sortie).
 *
 * Pourquoi il plante hors development/test : un stub silencieux ferait de chaque
 * visiteur anonyme un gestionnaire en production. Une panne visible vaut mieux qu'un
 * back-office ouvert par oubli.
 *
 * À écrire ici :
 *   1. import "server-only";
 *   2. export async function getCurrentUser(): Promise<CurrentUser>
 *      → première ligne : assertMockSessionAllowed(process.env.NODE_ENV)
 *      → puis renvoyer { id: "usr-demo", name: "Utilisateur démo", role: "gestionnaire" }.
 */

//Ici getCurrentUser() renvoie toujours l'utilisateur démo,
//alors que la version finale (A7, Auth.js) lira le cookie de session et la base.
export async function getCurrentUser(): Promise<CurrentUser> {
  assertMockSessionAllowed(process.env.NODE_ENV);
  return { id: "usr-demo", name: "Utilisateur démo", role: "gestionnaire" };
}
