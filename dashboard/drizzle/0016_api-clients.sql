-- API pour l'application FIG (décision du 2026-09-17, question 14 : le
-- dashboard reste le seul propriétaire du schéma, l'application passe par son
-- API). Rien de destructeur :
-- - motif d'annulation « customer » (la personne annule elle-même depuis
--   l'application, tant que la commande est en préparation) ;
-- - customer_login_codes : codes de connexion à six chiffres (HMAC seulement),
--   rangés par adresse, sans clé étrangère : l'inscription passe par le même
--   chemin, avant que le client existe ;
-- - customer_sessions : jetons de session des clients (HMAC seulement), 180
--   jours, révocables ; supprimés avec le client ;
-- - api_idempotency_keys : une ligne par (client, clé) pour rejouer à
--   l'identique la réponse d'une création (commande, message) ;
-- - orders.payment_reference : référence du paiement transmise par
--   l'application à la création ;
-- - trois index composites pour les listes « mes commandes », « mes messages »
--   et « mes notifications », paginées par curseur.
ALTER TYPE "public"."cancellation_reason" ADD VALUE 'customer' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "api_idempotency_keys" (
	"customer_id" text NOT NULL,
	"key" text NOT NULL,
	"request_hash" text NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "api_idempotency_keys_customer_id_key_pk" PRIMARY KEY("customer_id","key")
);
--> statement-breakpoint
CREATE TABLE "customer_login_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"requested_ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "payment_reference" text;--> statement-breakpoint
ALTER TABLE "api_idempotency_keys" ADD CONSTRAINT "api_idempotency_keys_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_sessions" ADD CONSTRAINT "customer_sessions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "api_idempotency_keys_expires_idx" ON "api_idempotency_keys" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_login_codes_email_idx" ON "customer_login_codes" USING btree ("email","created_at");--> statement-breakpoint
CREATE INDEX "customer_login_codes_expires_idx" ON "customer_login_codes" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_sessions_token_hash_idx" ON "customer_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "customer_sessions_customer_idx" ON "customer_sessions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "customer_sessions_expires_idx" ON "customer_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "customer_messages_customer_received_idx" ON "customer_messages" USING btree ("customer_id","received_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "customer_notifications_customer_created_idx" ON "customer_notifications" USING btree ("customer_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_customer_created_idx" ON "orders" USING btree ("customer_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);