-- Prénom et nom séparés pour les comptes du back-office (décision du client,
-- 2026-09-17) : le couple reste unique sans casse ni accent (fig_normalize) et
-- le NOM seul sert au rappel de l'adresse e-mail (« Adresse e-mail oubliée »).
-- Reprise des comptes existants : premier mot de `name` = prénom, le reste =
-- nom ; un seul mot = nom seul, prénom vide. La colonne `name` est recopiée
-- avant d'être supprimée : rien n'est perdu.
ALTER TABLE "users" ADD COLUMN "first_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "last_name" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "users" SET
  "first_name" = CASE
    WHEN position(' ' in btrim("name")) > 0 THEN split_part(btrim("name"), ' ', 1)
    ELSE ''
  END,
  "last_name" = CASE
    WHEN position(' ' in btrim("name")) > 0 THEN btrim(substr(btrim("name"), position(' ' in btrim("name")) + 1))
    ELSE btrim("name")
  END;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "first_name" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "last_name" DROP DEFAULT;--> statement-breakpoint
DROP INDEX "users_name_normalized_idx";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "name";--> statement-breakpoint
CREATE UNIQUE INDEX "users_full_name_normalized_idx" ON "users" USING btree (fig_normalize(btrim("first_name" || ' ' || "last_name")));--> statement-breakpoint
CREATE INDEX "users_last_name_normalized_idx" ON "users" USING btree (fig_normalize("last_name"));
