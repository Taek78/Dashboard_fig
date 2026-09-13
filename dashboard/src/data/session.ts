import "server-only";
import type { CurrentUser } from "@/domain/auth/types";
import { verifySession } from "@/lib/dal";

/*
 * Session du back-office. Depuis A7, getCurrentUser() délègue à verifySession()
 * (Auth.js) : les Server Actions écrites en A2-A5 n'ont pas changé, seul le corps
 * de cette fonction l'a fait. Le stub qui renvoyait « Utilisateur démo » et
 * plantait hors development/test a disparu avec lui.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  return verifySession();
}
