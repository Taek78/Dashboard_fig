import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { CurrentUser } from "@/domain/auth/types";

/*
 * DAL (Data Access Layer) de la session : l'unique fonction qui lit la session
 * Auth.js et la traduit en CurrentUser. Sans session valide, redirige vers
 * /connexion (redirect() lève : le code qui suit ne s'exécute jamais, y compris
 * dans une Server Action). Toute page et toute action passent par ici.
 *
 * cache() de React : le layout et la page appellent verifySession pendant le
 * MÊME rendu ; le jeton n'est déchiffré qu'une fois par requête (la mémoire
 * est propre à chaque requête, jamais partagée entre deux personnes).
 */
export const verifySession = cache(async (): Promise<CurrentUser> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.role) redirect("/connexion");
  return {
    id: user.id,
    name: user.name ?? user.email ?? "Utilisateur",
    role: user.role,
  };
});
