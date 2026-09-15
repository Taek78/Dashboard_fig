-- Recherche des commandes sans parcourir la table. Les deux premières instructions
-- sont écrites à la main (drizzle-kit ne gère ni les extensions ni les fonctions) :
-- - pg_trgm : index trigramme pour « contient » (extension de confiance : le
--   propriétaire de la base peut la créer, sans superutilisateur) ;
-- - fig_normalize : la règle normalize() de src/lib/text.ts en SQL (ligatures œ et
--   æ dépliées, lettres accentuées françaises ramenées à leur base, minuscules).
--   IMMUTABLE : utilisable par une colonne générée ; les deux alphabets de
--   translate ont la même longueur (remplacement caractère pour caractère).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE OR REPLACE FUNCTION fig_normalize(value text) RETURNS text
  LANGUAGE sql IMMUTABLE PARALLEL SAFE RETURNS NULL ON NULL INPUT
  AS $$ SELECT lower(translate(replace(replace(replace(replace(value, 'œ', 'oe'), 'Œ', 'OE'), 'æ', 'ae'), 'Æ', 'AE'), 'ÀÁÂÃÄÅàáâãäåÇçÈÉÊËèéêëÌÍÎÏìíîïÑñÒÓÔÕÖòóôõöÙÚÛÜùúûüÝýÿ', 'AAAAAAaaaaaaCcEEEEeeeeIIIIiiiiNnOOOOOoooooUUUUuuuuYyy')) $$;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "search_text" text GENERATED ALWAYS AS (fig_normalize(full_name) || chr(1) || fig_normalize(email)) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "phone_digits" text GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]', '', 'g')) STORED NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "search_text" text GENERATED ALWAYS AS (fig_normalize(reference) || chr(1) || fig_normalize(delivery_city) || chr(1) || fig_normalize(delivery_postal_code)) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "orders_search_trgm_idx" ON "orders" USING gin ("search_text" gin_trgm_ops);
