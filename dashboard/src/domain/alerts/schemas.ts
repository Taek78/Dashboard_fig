import { z } from "zod";
import {
  ALERT_KINDS_READ,
  ALERT_MAX_LOOKBACK_MS,
  ALERT_OVERLAP_MS,
  type AlertPrefs,
} from "@/domain/alerts/types";

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

/** Le fil dont on enregistre la visite (action markSectionSeen). */
export const alertReadKindSchema = z.enum(ALERT_KINDS_READ);

/**
 * Les deux cases de « Mon profil » : une case cochée arrive avec la valeur
 * « on », une case décochée n'est pas envoyée (= désactivée).
 */
const box = z
  .literal("on")
  .optional()
  .transform((value) => value === "on");
export const alertPrefsSchema = z
  .object({ orders: box, messages: box, muted: box })
  .transform((v): AlertPrefs => ({
    orders: v.orders,
    messages: v.messages,
    muted: v.muted,
  }));
