import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { CurrentUser } from "@/domain/auth/types";

/*
 * DAL (Data Access Layer) de la session : l'unique fonction qui lit la session
 * Auth.js et la traduit en CurrentUser. Sans session valide, redirige vers
 * /connexion (redirect() lève : le code qui suit ne s'exécute jamais, y compris
 * dans une Server Action). Toute page et toute action passent par ici.
 */
export async function verifySession(): Promise<CurrentUser> {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) redirect("/connexion");
  return {
    id: user.id,
    name: user.name ?? user.email ?? "Utilisateur",
    role: user.role,
  };
}
