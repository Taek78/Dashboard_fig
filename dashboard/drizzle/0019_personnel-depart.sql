-- Personnel (2026-09-18) : créneau « 24 h/24 » (h24), disponibilité « Arrêt
-- maladie » (arret_maladie) et date de sortie de l'entreprise (left_at).
-- Rien de destructeur : deux valeurs d'enum ajoutées, une colonne nullable.
-- Les personnes déjà parties gardent left_at NULL (date jamais saisie), ce que
-- les deux contraintes acceptent :
-- - staff_left_at_departed : une date de sortie seulement pour une personne
--   partie (active = false) ;
-- - staff_left_at_after_start : jamais avant la date d'entrée.
ALTER TYPE "public"."staff_availability" ADD VALUE 'arret_maladie';--> statement-breakpoint
ALTER TYPE "public"."staff_shift" ADD VALUE 'h24';--> statement-breakpoint
ALTER TABLE "staff" ADD COLUMN "left_at" date;--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_left_at_departed" CHECK ("staff"."left_at" IS NULL OR NOT "staff"."active");--> statement-breakpoint
ALTER TABLE "staff" ADD CONSTRAINT "staff_left_at_after_start" CHECK ("staff"."left_at" IS NULL OR "staff"."left_at" >= "staff"."started_at");