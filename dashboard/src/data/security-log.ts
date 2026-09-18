import "server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "@/db/client";
import { securityEvents } from "@/db/schema";
import { securityLogDb } from "@/data/security-log.db";
import type { SecurityLogSource } from "@/domain/security/source";
import { formatSecurityEvent, type SecurityEvent } from "@/lib/security-log";

/*
 * Journal de sécurité côté serveur : chaque événement part sur la
 * sortie standard (ligne JSON, pour l'hébergeur) ET dans la table
 * `security_events` (pour l'analyse d'un incident depuis la base). L'écriture en
 * base ne bloque jamais l'action qui journalise : elle est lancée sans attente
 * et un échec est seulement signalé sur la sortie d'erreur.
 * Silencieux sous Vitest (NODE_ENV=test).
 *
 * La LECTURE (écran Journal, administrateur seul) est l'implémentation
 * security-log.db.ts, réexportée ici : le contrat n'offre aucune écriture,
 * pour qu'aucun écran ne puisse retoucher une preuve.
 */
export function logSecurity(event: SecurityEvent): void {
  if (process.env.NODE_ENV === "test") return;
  const now = new Date();
  console.info(formatSecurityEvent(event, now));

  const { type, ...details } = event;
  void getDb()
    .insert(securityEvents)
    .values({ id: randomUUID(), type, details, at: now })
    .catch((error: unknown) => {
      console.error("[security-log] écriture en base impossible", error);
    });
}

export const {
  getSecurityEventsPage,
  countSecurityEvents,
  oldestSecurityEventAt,
}: SecurityLogSource = securityLogDb;
