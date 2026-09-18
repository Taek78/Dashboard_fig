-- Personnel (2026-09-18) : le métier « Préparateur-livreur », affectable comme
-- préparateur ET comme livreur d'une commande. Rien de destructeur : une
-- valeur ajoutée à l'enum staff_kind.
ALTER TYPE "public"."staff_kind" ADD VALUE 'preparateur_livreur' BEFORE 'gestionnaire';