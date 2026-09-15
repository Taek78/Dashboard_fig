# Base de données FIG : mise en route et fonctionnement (2026-09-14)

Décision client : la base n'existe pas, **le dashboard la crée et la possède**. Le schéma est donc écrit dans le projet (`src/db/schema.ts`), versionné par des migrations SQL (`drizzle/`), et l'application FIG du client s'y branchera ensuite (question à poser : par quelle API, ou lecture directe ?).

## 1. Une seule fois : créer la base locale

PostgreSQL 18 est installé sur le poste (service `postgresql-x64-18`, port 5432). Le mot de passe du superutilisateur `postgres` est celui choisi pendant l'installation ; il ne doit jamais entrer dans le projet.

Depuis `dashboard/`, dans PowerShell :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f scripts/setup-local.sql
```

Le script crée le rôle `fig` (mot de passe `fig`, base locale uniquement) et la base `fig` dont il est propriétaire. Si `psql` répond « role "fig" already exists », c'est déjà fait.

`.env.local` contient déjà la ligne `DATABASE_URL=postgresql://fig:fig@localhost:5432/fig`. Alternative sans installation : `docker compose up -d` (port **5433** pour ne pas gêner le service installé) et `DATABASE_URL` sur `localhost:5433`.

## 2. À chaque changement de schéma

| Étape     | Commande                  | Ce qu'elle fait                                                                                                                                                          |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modifier  | éditer `src/db/schema.ts` | seule source de vérité du schéma                                                                                                                                         |
| Générer   | `npm run db:generate`     | écrit un fichier SQL numéroté dans `drizzle/` (à lire, à commiter)                                                                                                       |
| Appliquer | `npm run db:migrate`      | joue les fichiers SQL pas encore appliqués (table `drizzle.__drizzle_migrations`)                                                                                        |
| Remplir   | `npm run db:seed`         | vide puis réinsère les fixtures (deux ans d'historique : environ 3 700 commandes, 14 000 événements, 120 clients) et les comptes de `.env.local` (base locale seulement) |
| Explorer  | `npm run db:studio`       | interface web sur les tables                                                                                                                                             |

Ne jamais modifier une migration déjà appliquée ailleurs : en écrire une nouvelle. Ne jamais lancer `db:migrate` ou `db:seed` vers une base qui n'est pas la vôtre sans l'avoir dit.

## 3. Basculer l'application sur la base

Dans `.env.local` : `DATA_SOURCE=db`, puis `npm run dev`. `/api/health` répond 200 si la base est joignable, 503 sinon. Revenir aux fixtures : `DATA_SOURCE=mock`. Les écrans sont identiques dans les deux modes : c'est vérifié par les tests d'aller-retour des mappers (`test/db/mappers.test.ts`).

Tests navigateur contre la base : seeder d'abord avec les comptes de test (`AUTH_BOOTSTRAP_EMAIL=e2e-admin@fig-demo.invalid AUTH_BOOTSTRAP_PASSWORD=E2E-FIG-2026-admin AUTH_MANAGER_EMAIL=e2e-gestion@fig-demo.invalid AUTH_MANAGER_PASSWORD=E2E-FIG-2026-gestion npm run db:seed`), lancer `E2E_DATA_SOURCE=db npm run test:e2e`, puis `npm run db:seed` pour revenir aux comptes locaux. La CI reste en mode mock.

Comptes en mode db : `db:seed` crée l'administrateur (`AUTH_BOOTSTRAP_*`) et le gestionnaire (`AUTH_MANAGER_*`) dans la table `users` ; ensuite les comptes vivent en base, l'environnement n'est plus lu pour eux.

## 4. Le schéma

| Table                | Contenu                                                                                                                                                                                                | Points d'attention                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`              | comptes du back-office (rôle, hachage scrypt, actif)                                                                                                                                                   | e-mail unique sans casse                                                                                                                                                                                                 |
| `staff`              | l'équipe du client : métier, coordonnées, créneau, disponibilité, jours travaillés (`text[]`)                                                                                                          | e-mail unique sans casse ; une personne partie reste (`active = false`) pour l'historique ; RGPD                                                                                                                         |
| `communities`        | groupes de clients livrés à un point de retrait, avec leur taux de remise ; pas d'heure de retrait (choisie à chaque commande, colonne supprimée en 0003)                                              | créées par l'application FIG, lues par le dashboard                                                                                                                                                                      |
| `customers`          | clients de l'application ; `community_id` pour les membres                                                                                                                                             | e-mail unique sans casse ; RGPD : données personnelles ; communauté supprimée → `SET NULL`                                                                                                                               |
| `customer_notes`     | notes internes de l'équipe                                                                                                                                                                             | supprimées avec le client (`ON DELETE CASCADE`)                                                                                                                                                                          |
| `products`           | catalogue                                                                                                                                                                                              | contraintes : prix > 0, stock ≥ 0, calibre min et max ensemble ou aucun                                                                                                                                                  |
| `orders`             | commandes : statut, client, créneau, montant dû, motif d'annulation, communauté et remise (`discount_kind`, `discount_percent`, `discount_cents`), préparateur et livreur (`preparer_id`, `driver_id`) | référence unique ; un client avec des commandes ne peut pas être supprimé ; motif présent si et seulement si annulée ; remise cohérente (nature et pourcentage ensemble) ; personne ou communauté supprimée → `SET NULL` |
| `order_lines`        | lignes : **instantané** du nom et du prix au moment de l'achat                                                                                                                                         | pas de clé étrangère vers `products` : supprimer un produit ne touche pas aux commandes                                                                                                                                  |
| `order_events`       | historique des statuts (acteur, instant, motif)                                                                                                                                                        | écrit dans la même transaction que le statut                                                                                                                                                                             |
| `articles`           | contenus « à lire »                                                                                                                                                                                    | date de parution, visible/masqué                                                                                                                                                                                         |
| `engagement_monthly` | usage de l'appli par mois                                                                                                                                                                              | `rating` en `numeric(3,2)`, converti en nombre par le mapper                                                                                                                                                             |
| `security_events`    | journal de sécurité (type, instant, détails JSON)                                                                                                                                                      | écrit sans bloquer l'action ; jamais de secret                                                                                                                                                                           |

Listes de valeurs : enums Postgres (`order_status`, `cancellation_reason`, `product_category`, `product_unit`, `container`, `article_category`, `user_role`, `staff_kind`, `staff_shift`, `staff_availability`, `community_kind`, `discount_kind`), identiques aux constantes du domaine (vérifié par `test/db/schema.test.ts`). Ajouter une valeur = modifier le domaine ET le schéma, puis `db:generate`. Retirer une valeur (comme `confirmed` en 0003) exige une migration des données écrite à la main dans le SQL généré, avant la recréation du type.

## 5. Comment le code lit la base

`src/data/<domaine>.db.ts` implémente le même contrat que le mock ; `src/data/<domaine>.ts` choisit selon `DATA_SOURCE`. Les lignes Drizzle ne sortent jamais de `src/data/` : `src/db/mappers.ts` les convertit en types métier (dates ISO, motif d'annulation, lignes triées). Deux choix à connaître :

- la recherche catalogue et la recherche clients se font **en mémoire** après chargement, avec les règles pures du domaine (mêmes résultats que le mock) ; à passer en SQL (`pg_trgm`) si les tables grossissent ;
- `updateOrderStatus` est une mise à jour conditionnelle (`WHERE id = $1 AND status = $2`) dans une transaction avec l'insertion de l'événement : deux personnes ne peuvent pas écraser le même statut ;
- les commandes sont lues avec leur communauté, leur préparateur et leur livreur par `LEFT JOIN` (la table `staff` jointe deux fois sous alias) : la source renvoie des noms, jamais des identifiants à résoudre par l'écran.

## 6. Sauvegarder et restaurer

`npm run db:backup` écrit un fichier `fig-AAAAMMJJ-HHmm.dump` (format custom de `pg_dump`, compressé) dans `%LOCALAPPDATA%\fig-backups`, hors OneDrive et hors dépôt. `npm run db:restore -- <chemin du .dump>` le rejoue dans la base de `DATABASE_URL` (contenu des tables remplacé ; base locale seulement sans `SEED_ALLOW_REMOTE=1`). À faire avant toute migration sur une base qui compte, et à automatiser chez l'hébergeur (une sauvegarde quotidienne conservée trente jours est un bon départ).

Le journal de sécurité (`security_events`) est dans la sauvegarde ; il est en JSON (`details`) pour rester lisible en SQL : `select at, type, details->>'email' from security_events order by at desc limit 50;`.

## 7. Avant une mise en ligne

Rôle applicatif dédié aux droits d'écriture ciblés (pas `fig` propriétaire, jamais `postgres`), TLS vers la base, sauvegardes, `AUTH_URL` et secrets par l'hébergeur, journal de sécurité en base. Voir le backlog, section sécurité.
