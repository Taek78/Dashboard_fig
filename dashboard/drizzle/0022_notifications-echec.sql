-- Suivi de l'envoi des notifications (2026-09-18) : l'application peut
-- déclarer un échec (failed_at, failure_reason) ; le back-office l'affiche et
-- propose « Réessayer », qui remet la notification dans la file.
-- Aucune donnée touchée : deux colonnes nullables, deux contraintes que les
-- lignes existantes respectent (aucun échec encore). L'index partiel de la
-- file est SUPPRIMÉ puis RECRÉÉ aussitôt pour exclure aussi les échecs
-- (DROP INDEX : la file se lit par un parcours le temps de la migration).
DROP INDEX "customer_notifications_pending_idx";--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD COLUMN "failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD COLUMN "failure_reason" text;--> statement-breakpoint
CREATE INDEX "customer_notifications_pending_idx" ON "customer_notifications" USING btree ("created_at") WHERE "customer_notifications"."sent_at" is null and "customer_notifications"."failed_at" is null;--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_sent_or_failed" CHECK ("customer_notifications"."sent_at" is null or "customer_notifications"."failed_at" is null);--> statement-breakpoint
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_failure_reason" CHECK (("customer_notifications"."failed_at" is not null or "customer_notifications"."failure_reason" is null) and char_length(coalesce("customer_notifications"."failure_reason", '')) <= 200);