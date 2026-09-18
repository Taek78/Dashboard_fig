import { z } from "zod";

/*
 * Entrées du suivi d'envoi d'une notification (back-office) : l'identifiant
 * lu dans l'URL de GET /notifications/[id] et dans le formulaire
 * « Réessayer ».
 */
export const notificationIdSchema = z.string().trim().min(1).max(64);

export const requeueNotificationSchema = z.object({
  notificationId: notificationIdSchema,
});
