import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { securityEvents } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { formatSecurityEvent, type SecurityEvent } from "@/lib/security-log";

/*
 * Journal de sécurité côté serveur (2026-09-14) : chaque événement part sur la
 * sortie standard (ligne JSON, pour l'hébergeur) ET, en mode db, dans la table
 * `security_events` (pour l'analyse d'un incident depuis la base). L'écriture en
 * base ne bloque jamais l'action qui journalise : elle est lancée sans attente
 * et un échec est seulement signalé sur la sortie d'erreur.
 * Silencieux sous Vitest (NODE_ENV=test), comme avant.
 */
export function logSecurity(event: SecurityEvent): void {
  if (process.env.NODE_ENV === "test") return;
  const now = new Date();
  console.info(formatSecurityEvent(event, now));
  if (getEnv().DATA_SOURCE !== "db") return;

  const { type, ...details } = event;
  void getDb()
    .insert(securityEvents)
    .values({ id: randomUUID(), type, details, at: now })
    .catch((error: unknown) => {
      console.error("[security-log] écriture en base impossible", error);
    });
}
