import "server-only";
import { getEnv } from "@/lib/env";

/*
 * URL publique d'un chemin du dashboard, pour les liens envoyés par mail :
 * AUTH_URL (obligatoire en production, l'origine canonique d'Auth.js), sinon
 * le serveur de développement. Jamais l'en-tête Host de la requête, qu'un
 * client peut forger pour faire pointer un lien de mail vers son propre site.
 */
const DEV_ORIGIN = "http://localhost:3000";

export function appUrl(pathname: string): string {
  return new URL(pathname, getEnv().AUTH_URL ?? DEV_ORIGIN).toString();
}
