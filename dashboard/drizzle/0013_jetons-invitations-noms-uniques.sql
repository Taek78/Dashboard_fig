-- Récupération de compte et invitations (décision du client, 2026-09-17).
-- - auth_tokens : codes de récupération (6 chiffres, 5 min, 5 essais), liens
--   « Ce n'était pas moi » (24 h) et liens d'invitation (48 h) ; seulement le
--   HMAC du secret, jamais le secret ; consommés une fois ; supprimés avec le
--   compte (cascade).
-- - users.password_hash devient NULLABLE : un compte créé par l'administrateur
--   n'a pas de mot de passe tant que la personne n'a pas accepté l'invitation
--   (il ne peut pas se connecter) ; users.password_changed_at : dernier
--   changement de mot de passe ou verrouillage, toute session ouverte avant est
--   refusée.
-- - Nom de compte UNIQUE sans casse ni accent (fig_normalize) : il sert au
--   rappel de l'adresse e-mail. Échoue si deux comptes portent déjà le même nom
--   (à renommer avant la migration).
-- Non destructif : aucune ligne modifiée ni supprimée.
CREATE TYPE "public"."auth_token_kind" AS ENUM('recovery_code', 'lock_link', 'invitation');--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" "auth_token_kind" NOT NULL,
	"user_id" text NOT NULL,
	"secret_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"consumed_at" timestamp with time zone,
	"requested_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_tokens_user_kind_idx" ON "auth_tokens" USING btree ("user_id","kind");--> statement-breakpoint
CREATE UNIQUE INDEX "auth_tokens_secret_hash_idx" ON "auth_tokens" USING btree ("secret_hash");--> statement-breakpoint
CREATE INDEX "auth_tokens_expires_idx" ON "auth_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "users_name_normalized_idx" ON "users" USING btree (fig_normalize("name"));