-- État d'envoi de l'invitation d'un compte (demande du 2026-09-18). L'écran
-- Comptes affirmait « un lien lui a été envoyé » sans jamais savoir si le mail
-- était parti : l'envoi était programmé après la réponse. Il est désormais
-- attendu, et son issue écrite ici pour survivre au rechargement de la page.
-- Rien de destructeur : un type d'énumération et trois colonnes nullables.
-- - invitation_mail_sent_at : dernier envoi confirmé par le fournisseur ;
-- - invitation_mail_failed_at / invitation_mail_error : dernier échec et sa
--   cause (mêmes clés que domain/mail/failure.ts), remis à null dès qu'un
--   envoi réussit. L'historique reste dans le journal de sécurité.
CREATE TYPE "public"."mail_failure_reason" AS ENUM('adresse_refusee', 'expedition_refusee', 'configuration', 'quota_depasse', 'service_indisponible', 'injoignable', 'autre');--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invitation_mail_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invitation_mail_error" "mail_failure_reason";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "invitation_mail_sent_at" timestamp with time zone;