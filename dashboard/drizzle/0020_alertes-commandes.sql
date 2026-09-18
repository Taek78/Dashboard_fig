-- Alertes en direct (2026-09-18) : chaque onglet ouvert relève toutes les
-- 5 s les commandes créées depuis le relevé précédent (created_at > depuis).
-- Un index sur created_at évite de parcourir tout l'historique. Rien de
-- destructeur : un index ajouté.
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at" DESC NULLS LAST);