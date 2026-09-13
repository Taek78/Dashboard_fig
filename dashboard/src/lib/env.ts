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

/** `next build` tourne en NODE_ENV=production sans servir personne : pas de gardes. */
const isBuild = () => process.env.NEXT_PHASE === "phase-production-build";

export function getEnv(): Env {
  if (!cached) {
    cached = parseEnv(process.env, {
      enforceProduction: process.env.NODE_ENV === "production" && !isBuild(),
    });
  }
  return cached;
}
