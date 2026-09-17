-- Invitations expirées (décision du client, 2026-09-17) : un compte reste en
-- attente d'activation tant que la personne n'a pas choisi son mot de passe par
-- le lien reçu (48 h). Passé ce délai, un balayage prévient par mail la
-- personne et les administrateurs, une seule fois par invitation : la colonne
-- garde l'expiration du lien dont l'avis est parti (null tant qu'aucun avis n'a
-- été envoyé ; un jeton plus récent, invitation renvoyée, pourra être notifié à
-- son tour).
ALTER TABLE "users" ADD COLUMN "invitation_expired_at" timestamp with time zone;
