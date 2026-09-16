-- Réclamations comptées dans les messages « Nous contacter » (décision du
-- 2026-09-16) : la colonne venue des stores et du support disparaît.
-- DESTRUCTIF : les valeurs de "complaints" sont perdues (données factices
-- seulement sur nos bases locale et de test).
ALTER TABLE "engagement_monthly" DROP COLUMN "complaints";
