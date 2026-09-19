-- « Désactiver le son » de « Mon profil » (2026-09-18) : coupe le son des
-- alertes en direct pour ce compte, sans toucher aux notifications ni aux
-- compteurs. Rien de destructeur : une colonne avec valeur par défaut.
ALTER TABLE "users" ADD COLUMN "alert_sound_muted" boolean DEFAULT false NOT NULL;