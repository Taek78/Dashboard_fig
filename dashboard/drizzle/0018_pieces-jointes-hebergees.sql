-- Pièces jointes hébergées par le dashboard (2026-09-18, question 22
-- tranchée) : l'application FIG téléverse le fichier par l'API, les octets
-- vivent dans la base (couverts par la sauvegarde), le back-office les lit.
-- Rien de destructeur : une table neuve, une colonne nullable, `url` devient
-- nullable. Les lignes existantes gardent leur URL (contrainte « une seule
-- source » : upload_id OU url) ; la contrainte https est reposée pour ne
-- s'appliquer qu'à une URL présente.
-- - message_uploads : un fichier reçu, son propriétaire, ses octets (5 Mo au
--   plus, taille annoncée = taille réelle), attached_at une fois rattaché ;
-- - message_attachments.upload_id : le fichier hébergé, unique (un fichier ne
--   sert qu'à une pièce jointe).
CREATE TABLE "message_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"customer_id" text NOT NULL,
	"file_name" text NOT NULL,
	"content_type" "attachment_content_type" NOT NULL,
	"size_bytes" integer NOT NULL,
	"bytes" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attached_at" timestamp with time zone,
	CONSTRAINT "message_uploads_size_range" CHECK ("message_uploads"."size_bytes" > 0 AND "message_uploads"."size_bytes" <= 5000000),
	CONSTRAINT "message_uploads_size_matches" CHECK (octet_length("message_uploads"."bytes") = "message_uploads"."size_bytes")
);
--> statement-breakpoint
ALTER TABLE "message_attachments" DROP CONSTRAINT "message_attachments_url_https";--> statement-breakpoint
ALTER TABLE "message_attachments" ALTER COLUMN "url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD COLUMN "upload_id" text;--> statement-breakpoint
ALTER TABLE "message_uploads" ADD CONSTRAINT "message_uploads_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "message_uploads_customer_idx" ON "message_uploads" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "message_uploads_unattached_idx" ON "message_uploads" USING btree ("created_at") WHERE "message_uploads"."attached_at" IS NULL;--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_upload_id_message_uploads_id_fk" FOREIGN KEY ("upload_id") REFERENCES "public"."message_uploads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "message_attachments_upload_idx" ON "message_attachments" USING btree ("upload_id");--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_one_source" CHECK (("message_attachments"."upload_id" IS NULL) <> ("message_attachments"."url" IS NULL));--> statement-breakpoint
ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_url_https" CHECK ("message_attachments"."url" IS NULL OR "message_attachments"."url" ~ '^https://');