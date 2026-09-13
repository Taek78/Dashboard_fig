import "server-only";
import { parseEnv, type Env } from "@/lib/env-schema";

/*
 * Accès validé à l'environnement, serveur uniquement (server-only : un import
 * depuis un composant client casse le build). Paresseux et mémorisé : la
 * validation n'a lieu qu'au premier appel, pas à l'import, pour que `next build`
 * puisse charger les modules sans .env.local ; le premier appel réel (une
 * requête, une action) échoue si une variable manque.
 */
let cached: Env | null = null;

export function getEnv(): Env {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}
