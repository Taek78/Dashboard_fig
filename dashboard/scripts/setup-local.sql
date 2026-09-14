-- Création de la base LOCALE de développement (PostgreSQL 18 installé sur le poste).
-- À lancer UNE fois, avec le superutilisateur créé par l'installateur, depuis dashboard/ :
--   & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f scripts/setup-local.sql
-- (le mot de passe demandé est celui choisi à l'installation de PostgreSQL).
-- fig / fig est un secret de développement trivial : base locale uniquement.
CREATE ROLE fig LOGIN PASSWORD 'fig';
CREATE DATABASE fig OWNER fig;
