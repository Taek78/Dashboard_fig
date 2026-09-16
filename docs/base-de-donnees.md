# Base de données FIG : mise en route et fonctionnement (2026-09-14)

Décision client : la base n'existe pas, **le dashboard la crée et la possède**. Le schéma est donc écrit dans le projet (`src/db/schema.ts`), versionné par des migrations SQL (`drizzle/`), et l'application FIG du client s'y branchera ensuite (question à poser : par quelle API, ou lecture directe ?).

## 1. Une seule fois : créer la base locale

PostgreSQL 18 est installé sur le poste (service `postgresql-x64-18`, port 5432). Le mot de passe du superutilisateur `postgres` est celui choisi pendant l'installation ; il ne doit jamais entrer dans le projet.

Depuis `dashboard/`, dans PowerShell :

```powershell
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f scripts/setup-local.sql
```

Le script crée le rôle `fig` (mot de passe `fig`, base locale uniquement) et la base `fig` dont il est propriétaire. Si `psql` répond « role "fig" already exists », c'est déjà fait.

`.env.local` contient déjà la ligne `DATABASE_URL=postgresql://fig:fig@localhost:5432/fig`. Alternative sans installation : `docker compose up -d db` (port **5433** pour ne pas gêner le service installé) et `DATABASE_URL` sur `localhost:5433`.

## 2. À chaque changement de schéma

| Étape     | Commande                  | Ce qu'elle fait                                                                                                                                                          |
| --------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Modifier  | éditer `src/db/schema.ts` | seule source de vérité du schéma                                                                                                                                         |
| Générer   | `npm run db:generate`     | écrit un fichier SQL numéroté dans `drizzle/` (à lire, à commiter)                                                                                                       |
| Appliquer | `npm run db:migrate`      | joue les fichiers SQL pas encore appliqués (table `drizzle.__drizzle_migrations`)                                                                                        |
| Remplir   | `npm run db:seed`         | vide puis réinsère les fixtures (deux ans d'historique : environ 3 700 commandes, 14 000 événements, 120 clients) et les comptes de `.env.local` (base locale seulement) |
| Explorer  | `npm run db:studio`       | interface web sur les tables                                                                                                                                             |

Ne jamais modifier une migration déjà appliquée ailleurs : en écrire une nouvelle. Ne jamais lancer `db:migrate` ou `db:seed` vers une base qui n'est pas la vôtre sans l'avoir dit.

## 3. Base de développement et base de test

Le dashboard fonctionne toujours sur PostgreSQL (plus de mode sans base depuis le 2026-09-15). `npm run dev` lit `DATABASE_URL` ; `/api/health` répond 200 si la base est joignable, 503 sinon.

Les tests n'utilisent jamais la base de travail. `npm run db:test` démarre la base jetable `test-db` de `compose.yaml` (port **5434**, en mémoire, vide à chaque démarrage). Vitest (projet `db`) et Playwright la migrent et la seedent eux-mêmes avant de commencer (`test/support/global-setup.ts`, comptes de test publics de `test/support/config.ts`) ; sous Vitest, chaque test s'exécute dans une transaction annulée à la fin et repart donc des fixtures. Ne pas lancer `npm run check` et `npm run test:e2e` en même temps : ils partagent cette base. `TEST_DATABASE_URL` la remplace si besoin (la CI utilise un PostgreSQL de service).

## 4. Le schéma

| Table                | Contenu                                                                                                                                                                                                | Points d'attention                                                                                                                                                                                                       |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `users`              | comptes du back-office (rôle, hachage scrypt, actif)                                                                                                                                                   | e-mail unique sans casse                                                                                                                                                                                                 |
| `staff`              | l'équipe du client : métier, coordonnées, créneau, disponibilité, jours travaillés (`text[]`)                                                                                                          | e-mail unique sans casse ; une personne partie reste (`active = false`) pour l'historique ; RGPD                                                                                                                         |
| `communities`        | groupes de clients livrés à un point de retrait, avec leur taux de remise ; pas d'heure de retrait (choisie à chaque commande, colonne supprimée en 0003)                                              | créées par l'application FIG, lues par le dashboard                                                                                                                                                                      |
| `customers`          | clients de l'application ; `community_id` pour les membres ; `anonymized_at` (migration 0007)                                                                                                         | e-mail unique sans casse ; RGPD : données personnelles, jamais supprimées (commandes) mais anonymisées (`src/db/privacy.ts`) ; communauté supprimée → `SET NULL`                                                        |
| `customer_notes`     | notes internes de l'équipe                                                                                                                                                                             | supprimées avec le client (`ON DELETE CASCADE`) et à son anonymisation                                                                                                                                                  |
| `products`           | catalogue                                                                                                                                                                                              | contraintes : prix > 0, stock ≥ 0, calibre min et max ensemble ou aucun                                                                                                                                                  |
| `orders`             | commandes : statut, client, créneau, montant dû, motif d'annulation, communauté et remise (`discount_kind`, `discount_percent`, `discount_cents`), préparateur et livreur (`preparer_id`, `driver_id`) | référence unique ; un client avec des commandes ne peut pas être supprimé ; motif présent si et seulement si annulée ; remise cohérente (nature et pourcentage ensemble) ; personne ou communauté supprimée → `SET NULL` |
| `order_lines`        | lignes : **instantané** du nom et du prix au moment de l'achat                                                                                                                                         | pas de clé étrangère vers `products` : supprimer un produit ne touche pas aux commandes                                                                                                                                  |
| `order_events`       | historique des statuts (acteur, instant, motif)                                                                                                                                                        | écrit dans la même transaction que le statut                                                                                                                                                                             |
| `customer_messages`  | demandes « Nous contacter » : objet, corps, commande citée, statut, épingle, « important », qui a traité et quand                                                                                      | écrites par l'application FIG, jamais par le dashboard ; RGPD : texte libre de la personne, exporté puis **supprimé** à son anonymisation ; `search_text` calculée ; `handled_at` et `handled_by_name` ensemble ou aucun |
| `message_attachments`| pièces jointes : nom, format, taille, URL — **métadonnées seulement**, le fichier est chez l'application                                                                                               | dix au plus par message (`position` 0..9 + unique) et formats en liste blanche (enum), gardes tenues par la base ; `url` obligatoirement en https ; supprimées avec leur message (`ON DELETE CASCADE`)                    |
| `articles`           | contenus « à lire »                                                                                                                                                                                    | date de parution, visible/masqué                                                                                                                                                                                         |
| `engagement_monthly` | usage de l'appli par mois                                                                                                                                                                              | `rating` en `numeric(3,2)`, converti en nombre par le mapper                                                                                                                                                             |
| `security_events`    | journal de sécurité (type, instant, détails JSON)                                                                                                                                                      | écrit sans bloquer l'action ; jamais de secret                                                                                                                                                                           |
| `login_attempts`     | limitation de débit de la connexion : une ligne par clé (`email:…`, `ip:…`), nombre d'échecs, dernier échec, fin du verrou                                                                             | partagée par toutes les instances ; mise à jour sous verrou de ligne (`FOR UPDATE`) ; lignes expirées purgées à chaque échec ; contient des e-mails (RGPD), jamais plus de 15 min sans verrou actif                      |

Listes de valeurs : enums Postgres (`order_status`, `cancellation_reason`, `product_category`, `product_unit`, `container`, `article_category`, `user_role`, `staff_kind`, `staff_shift`, `staff_availability`, `community_kind`, `discount_kind`, `message_subject`, `message_status`, `attachment_content_type`), identiques aux constantes du domaine (vérifié par `test/db/schema.test.ts`). Ajouter une valeur = modifier le domaine ET le schéma, puis `db:generate`. La migration 0006 commence par deux instructions écrites à la main que drizzle-kit ne génère pas : `CREATE EXTENSION IF NOT EXISTS pg_trgm` (extension « de confiance » : le rôle qui migre doit seulement avoir le droit CREATE sur la base, à vérifier sur la base du client) et la fonction `fig_normalize`. Retirer une valeur (comme `confirmed` en 0003, puis `pending` en 0005, qui retire aussi le temps de la reprise la contrainte `orders_cancellation_consistent`) exige une migration des données écrite à la main dans le SQL généré, avant la recréation du type.

## 5. Comment le code lit la base

`src/data/<domaine>.db.ts` implémente le contrat du domaine ; `src/data/<domaine>.ts` le réexporte. Les lignes Drizzle ne sortent jamais de `src/data/` : `src/db/mappers.ts` les convertit en types métier (dates ISO, motif d'annulation, lignes triées). Deux choix à connaître :

- la recherche des commandes lit des **colonnes calculées par la base** à chaque écriture (`GENERATED ALWAYS AS … STORED`, migration 0006) : `orders.search_text` (référence, ville, code postal), `customers.search_text` (nom, e-mail), `customers.phone_digits` ; la normalisation est la fonction SQL `fig_normalize`, même règle que `normalize()` de `src/lib/text.ts`. `LIKE '%…%'` est servi par un index trigramme (`pg_trgm`, GIN) et le client par une sous-requête `= ANY(ARRAY(…))` : 465 ms → 1 ms sur 36 830 commandes. Les recherches du catalogue et des clients, petites tables, restent en mémoire avec les règles pures ;
- la liste des commandes est paginée par la base : identifiants de la page d'abord, puis jointures et lignes (JSON) pour ces commandes seulement, total compté en parallèle ; tableau de bord, métriques, personnel, fiches et annuaire lisent des **agrégats** (`count(*) filter (where …)`, `GROUP BY` du premier jour du seau, `min()` d'un tableau pour le nom d'un produit sans tout trier, `cross join lateral` pour compter le travail d'une personne sans jointure OR, `distinct on` pour la dernière remise à zéro de la fidélité) dans `orders-aggregates.db.ts`, sans charger l'historique ;
- `updateOrderStatus` est une mise à jour conditionnelle (`WHERE id = $1 AND status = $2`) dans une transaction avec l'insertion de l'événement : deux personnes ne peuvent pas écraser le même statut ;
- `assignStaff` aussi (`WHERE id = $1 AND status NOT IN ('delivered', 'cancelled') AND driver_id IS NOT DISTINCT FROM $2`) : une commande terminée entre-temps, ou réaffectée par quelqu'un d'autre depuis l'affichage, n'est pas écrasée ;
- la limitation de débit de la connexion vit dans `login_attempts` : l'échec est compté dans une transaction qui verrouille les lignes des clés, deux tentatives simultanées comptent pour deux ;
- `test/data/orders.db.test.ts` compare chaque requête filtrée ou agrégée à sa règle pure (`filterOrders`, `paginate`, `orderStats`, `revenueSeries`, `topProducts`, `summarizeStaffWork`, `directoryStatsFromOrders`) sur toutes les commandes seedées de la base de test ;
- les commandes sont lues avec leur communauté, leur préparateur et leur livreur par `LEFT JOIN` (la table `staff` jointe deux fois sous alias) : la source renvoie des noms, jamais des identifiants à résoudre par l'écran.

## 6. Sauvegarder et restaurer

`npm run db:backup` écrit un fichier `fig-AAAAMMJJ-HHmm.dump` (format custom de `pg_dump`, compressé) dans `%LOCALAPPDATA%\fig-backups`, hors OneDrive et hors dépôt. `npm run db:restore -- <chemin du .dump>` le rejoue dans la base de `DATABASE_URL` (contenu des tables remplacé ; base locale seulement sans `SEED_ALLOW_REMOTE=1`). À faire avant toute migration sur une base qui compte, et à automatiser chez l'hébergeur (une sauvegarde quotidienne conservée trente jours est un bon départ).

Le journal de sécurité (`security_events`) est dans la sauvegarde ; il est en JSON (`details`) pour rester lisible en SQL : `select at, type, details->>'email' from security_events order by at desc limit 50;`.

## 7. Avant une mise en ligne

Rôle applicatif dédié aux droits d'écriture ciblés (pas `fig` propriétaire, jamais `postgres`), TLS vers la base, sauvegardes, `AUTH_URL` et secrets par l'hébergeur, journal de sécurité en base. Voir le backlog, section sécurité.

## 8. RGPD : anonymisation et durées de conservation

Détail et procédures dans [rgpd.md](rgpd.md). Côté base :

- **Client anonymisé** : une transaction (`anonymizeCustomerRows`, `src/db/privacy.ts`).
  - La ligne `customers` n'est réécrite que si `anonymized_at IS NULL` **et** qu'aucune commande n'est `preparing` ou `delivering`. Une annulation en cours laisse voir « en préparation » : l'anonymisation refuse.
  - Nouvelles valeurs : nom « Client anonymisé » ; e-mail `anonyme-<id>@anonyme.invalid`, pour garder l'index unique ; téléphone, ville et code postal vides ; `community_id` à `NULL`.
  - Ses `customer_notes` et ses `customer_messages` sont supprimés (les `message_attachments` suivent par cascade), et `cancellation_detail` est effacé sur ses `orders` et ses `order_events`. Ce nettoyage est rejoué si l'on redemande l'anonymisation d'un client déjà anonymisé. Les fichiers joints eux-mêmes sont chez l'application FIG : à elle de les effacer (question 19).
  - Les colonnes calculées de recherche se recalculent : l'ancien nom ne retrouve plus ses commandes.
- **Note concurrente** : `addNote` lit le client sous verrou partagé (`FOR SHARE`) dans sa transaction. Une note ne peut donc pas être insérée juste après la suppression des notes d'une anonymisation en cours.
- **Purge** : `npm run rgpd:purge` (aperçu, `-- --apply` pour écrire), qui refuse une base distante sans `RGPD_ALLOW_REMOTE=1`.
  - **Journal** : supprime `security_events` au-delà de 12 mois, sauf les preuves `customer_exported` et `customer_anonymized`.
  - **Tentatives de connexion** : supprime `login_attempts` au-delà de 24 h sans verrou actif.
  - **Clients inactifs** : anonymise ceux qui n'ont ni création, ni jour de livraison, ni commande ouverte depuis 3 ans (`findInactiveCustomers`, testé contre `isCustomerInactive`), en journalisant chaque anonymisation (acteur `rgpd-purge`).
- **Restauration** : une sauvegarde antérieure ramène des clients anonymisés depuis. **Avant** un `db:restore`, extraire `select id from customers where anonymized_at is not null`, puis anonymiser à nouveau ces identifiants une fois la sauvegarde restaurée.

## Performances en production

- Mettre l'application et PostgreSQL dans la même région (idéalement le même hébergeur) : chaque page fait deux à huit requêtes, en partie en parallèle.
- Activer `pg_stat_statements` et `log_min_duration_statement = 200` (millisecondes) pour repérer une requête qui ralentit avec le volume réel.
- Le pool de l'application compte dix connexions (`src/db/client.ts`) : prévoir au moins autant de connexions disponibles côté base par instance du dashboard.
- Mesurer une requête avec `EXPLAIN ANALYZE` sur une copie grossie de la base, jamais sur la base de production.
