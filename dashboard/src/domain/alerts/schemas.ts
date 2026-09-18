import { z } from "zod";
import { ALERT_MAX_LOOKBACK_MS, ALERT_OVERLAP_MS } from "@/domain/alerts/types";

/*
 * Lecture tolérante du paramètre ?depuis= du flux des alertes (GET /alertes).
 * Absent ou illisible : la dernière minute (ALERT_OVERLAP_MS). Borné : jamais
 * plus de dix minutes en arrière (une valeur forgée ne fait pas relire tout
 * l'historique), jamais dans le futur.
 */
export function alertSince(raw: string | null, now: Date): Date {
  const parsed = z.iso.datetime({ offset: true }).safeParse(raw ?? undefined);
  const wanted = parsed.success
    ? new Date(parsed.data).getTime()
    : now.getTime() - ALERT_OVERLAP_MS;
  const floor = now.getTime() - ALERT_MAX_LOOKBACK_MS;
  return new Date(Math.min(Math.max(wanted, floor), now.getTime()));
}
