# Architecture du dashboard FIG

Ce document décrit comment le code est organisé, ce que fait chaque partie et comment les parties se parlent. Il s'adresse autant à quelqu'un qui découvre le projet qu'à quelqu'un qui doit y ajouter une fonctionnalité.

## 1. L'idée en une page

Le dashboard est une application Next.js rendue côté serveur. Chaque écran est une **page serveur** qui lit des données par une **façade**, puis les affiche avec des **composants**. Chaque modification passe par une **Server Action**, une fonction qui tourne sur le serveur, vérifie qui demande, valide ce qui est envoyé, applique les règles métier, puis écrit par la même façade.

Derrière la façade, une implémentation : **PostgreSQL** via Drizzle. Il n'y a pas de mode sans base (décision du 2026-09-15) : les données de démonstration sont insérées par le seed, en développement comme en test. Aucun écran ne charge tout l'historique : la base filtre, pagine et agrège.

Les **règles métier** (tri, filtres, calculs, machine d'états) sont des fonctions pures, sans dépendance à Next ni à la base : elles sont testées en quelques millisecondes, mettent en forme les totaux agrégés par la base et servent de référence aux tests des requêtes SQL.

```
navigateur
   │  requête HTTP
   ▼
src/proxy.ts            garde d'accès : anonyme → /connexion, rôle → sections permises, CSP à nonce
   ▼
src/app/**/page.tsx     page serveur : lit l'URL, appelle une façade, rend des composants
   │                    ┌──────────────────────────────────────────────────┐
   ▼                    │  src/app/**/actions.ts   Server Actions (écriture) │
src/data/<domaine>.ts   │  session → rôle → zod → relecture → règle → écriture │
   façade (server-only) └──────────────────────────────────────────────────┘
   │
   └── src/data/<domaine>.db.ts     Drizzle + PostgreSQL, lignes converties par src/db/mappers.ts
                                    (commandes : orders.db.ts et orders-aggregates.db.ts)
   ▲
src/domain/<domaine>/   types, règles pures, schémas zod des entrées, fixtures, contrat de source
```

## 2. Arborescence

```
Dashboard_fig/
├── README.md                    présentation et mise en route
├── CLAUDE.md                    conventions de travail (pour l'assistant et pour l'équipe)
├── docs/                        cette documentation
├── .github/workflows/ci.yml     intégration continue (check et Playwright sur PostgreSQL, audit)
└── dashboard/                   l'application
    ├── src/
    │   ├── app/                 routes Next.js (pages, layouts, actions, états de chargement)
    │   ├── components/          composants React, par domaine ; components/ui/ = shadcn
    │   ├── domain/              métier pur : types, règles, schémas, fixtures, contrats
    │   ├── data/                façades et implémentations PostgreSQL des sources
    │   ├── db/                  schéma Drizzle, client PostgreSQL, mappers
    │   ├── lib/                 utilitaires purs (format, env, mots de passe, CSP…)
    │   ├── hooks/               hooks React (un seul : détection mobile)
    │   ├── auth.ts              configuration Auth.js
    │   ├── proxy.ts             middleware de Next : accès et CSP
    │   └── instrumentation.ts   validation de l'environnement au démarrage
    ├── test/                    tests Vitest, en miroir de src/
    ├── e2e/                     parcours navigateur Playwright
    ├── drizzle/                 migrations SQL générées
    ├── scripts/                 seed, création de la base locale, sauvegarde, restauration, purge RGPD
    ├── compose.yaml             PostgreSQL Docker : développement (db, 5433) et tests (test-db, 5434)
    └── playwright.config.ts     serveur de test, comptes de test
```

## 3. Les couches, du métier à l'écran

### 3.1 `src/domain/<domaine>/` : le métier pur

Un dossier par domaine : `orders` (commandes, avec `assignment.ts` pour l'affectation de l'équipe, `discount.ts` pour les remises et la meilleure remise, `delivery-fee.ts` pour le barème des frais de livraison, `slot.ts` pour le créneau d'une heure entre 10:00 et 20:00), `deliveries` (tournée), `products` (catalogue), `customers` (clients, avec `loyalty.ts` pour le compteur de fidélité, `tier.ts` pour la catégorie basique ou fidèle et son historique, `consents.ts` pour les trois autorisations, `referral.ts` pour le code de parrainage, `client-type.ts` pour particulier ou communauté, `directory.ts` pour la recherche commune et ses tris dans les deux sens), `communities` (groupes de clients livrés à un même point de retrait, `kind.ts` pour les trois types et la visibilité, `discount.ts` pour la remise selon le nombre de membres), `notifications` (file des notifications d'état déposées pour les clients : texte, contrat, fixtures), `staff` (personnel : livreurs, préparateurs, gestionnaires), `articles`, `metrics` (agrégations), `engagement` (usage de l'appli), `auth` (rôles et comptes), `messages` (boîte de réception « Nous contacter » : objets, statut, pièces jointes, aperçu et tri), `privacy` (RGPD : durées de conservation, anonymisation, export des données d'un client ; voir [rgpd.md](rgpd.md)). Chaque dossier suit le même patron :

| Fichier                     | Rôle                                                               | Exemple                                        |
| --------------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `types.ts`                  | les types métier du front, en TypeScript simple                    | `Order`, `OrderEvent`, `StatusChange`          |
| `status.ts` / `category.ts` | listes de valeurs `as const` avec leurs libellés français          | `ORDER_STATUSES`, `PRODUCT_CATEGORIES`         |
| `rules.ts`                  | fonctions pures : filtres, tris, calculs, règles                   | `filterOrders`, `canTransition`, `computeKpis` |
| `schemas.ts`                | schémas zod des **entrées** (formulaires, URL), jamais des entités | `changeStatusSchema`, `parseOrderFilters`      |
| `fixtures.ts`               | données factices déterministes, sans personne réelle               | `ordersFixtures`                               |
| `source.ts`                 | le **contrat** que toute source doit respecter                     | `OrdersSource`                                 |

Règles : aucun import de Next, de React ni de `src/data` ; chaque fonction renvoie une valeur et ne modifie rien ; les montants sont en centimes entiers, les quantités en grammes ou en pièces, les dates en chaînes ISO.

Deux régimes de validation zod : **tolérant** pour la lecture (un paramètre d'URL invalide est ignoré, la page s'affiche) et **strict** pour l'écriture (une saisie invalide fait échouer l'action avec un message).

### 3.2 `src/data/` : les sources de données

Pour chaque domaine, trois fichiers :

- `<domaine>.ts` : la **façade**, seul module que les pages et les actions importent. Elle commence par `import "server-only"` (impossible de l'embarquer dans le navigateur) et réexporte l'implémentation typée par le contrat ; aucun module ne lit l'environnement à son chargement : `next build` importe les pages sans `.env` (`test/app/facades.test.ts`).
- `<domaine>.db.ts` : l'implémentation Drizzle. Les filtres deviennent des `WHERE`, la recherche lit des colonnes calculées par la base et indexées (trigrammes), les tris des `ORDER BY`. Une liste se lit en une requête : les identifiants de la page d'abord (tri + `LIMIT/OFFSET` sur la seule table), puis les jointures et les lignes agrégées en JSON pour ces commandes-là ; le total est compté en parallèle. Les écritures conditionnelles sont des `UPDATE … WHERE id = $1 AND status = $2` (statut) ou `… AND driver_id IS NOT DISTINCT FROM $2` (affectation), les opérations couplées des transactions. Les chiffres (KPI, séries, jours de tournée, produits phares, compteurs du personnel, annuaire) sont agrégés par la base dans `orders-aggregates.db.ts` et mis en forme par les règles pures. Les lignes ne sortent jamais telles quelles : `src/db/mappers.ts` les convertit en types métier.

Fichiers transverses : `session.ts` (utilisateur courant), `credentials.ts` (vérification d'un mot de passe avec limitation de débit), `login-attempts.ts` (état de la limitation, table `login_attempts`, partagée entre instances), `security-log.ts` (journal), `privacy.ts` (export complet et anonymisation d'un client, contrat `PrivacySource`), `notifications.ts` (lectures de la file des notifications ; l'écriture est dans `orders.db.ts`, avec le statut).

### 3.3 `src/db/` : PostgreSQL

- `schema.ts` : les tables, enums et contraintes, source de vérité des migrations. Le schéma n'importe pas le domaine (drizzle-kit doit pouvoir le charger seul) ; un test vérifie que ses enums restent identiques aux constantes du domaine.
- `client.ts` : `getDb()`, client paresseux (aucune connexion avant le premier appel), pool de dix connexions (la page Métriques lance huit agrégats en parallèle).
- `mappers.ts` : fonctions pures ligne → type métier et entrée → colonnes, testées en aller-retour sur toutes les fixtures.
- `privacy.ts` : anonymisation d'un client et purge des données hors durée, en SQL. Sans `server-only`, car le script `npm run rgpd:purge` l'importe hors de Next ; la Server Action y passe par `src/data/privacy.ts`.

Le détail des tables, des migrations, du seed et des sauvegardes est dans [base-de-donnees.md](base-de-donnees.md).

### 3.4 `src/app/` : les routes

Next associe un dossier à une URL. Le groupe `(dashboard)` regroupe toutes les pages protégées sous un même layout (sidebar, bandeau, vérification de session) ; `connexion/` est en dehors, sans sidebar.

| Fichier                           | Rôle                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------- |
| `layout.tsx` (racine)             | `<html>`, polices, script du thème avec le nonce                                       |
| `(dashboard)/layout.tsx`          | vérifie la session, pose la coquille                                                   |
| `<section>/page.tsx`              | page serveur : lit `searchParams` ou `params` (des `Promise`), appelle la façade, rend |
| `<section>/loading.tsx`           | squelette affiché pendant le chargement (même silhouette que la page)                  |
| `<section>/[id]/not-found.tsx`    | affiché par `notFound()`                                                               |
| `commandes/error.tsx`             | frontière d'erreur du segment (composant client, prop `retry`)                         |
| `<section>/actions.ts`            | Server Actions du domaine                                                              |
| `api/health/route.ts`             | `{ ok: true }` ou 503 si la base ne répond pas                                         |
| `clients/[id]/export/route.ts`    | export JSON des données d'un client (RGPD), administrateur seul, `no-store`, journalisé |
| `api/auth/[...nextauth]/route.ts` | points d'entrée d'Auth.js                                                              |

Sections : `/` tableau de bord (alerte de personnel en tête), `/commandes` (liste et tournée : raccourcis des 7 derniers jours ; `/livraisons` y redirige depuis le 2026-09-16), `/catalogue`, `/articles`, `/clients` (recherche commune particuliers et communautés, fiches `/clients/[id]` et `/clients/communautes/[id]`), `/messages` (boîte de réception, fiche `/messages/[id]`), `/personnel` (équipe, fiche `/personnel/[id]`), `/metriques`, `/comptes` (admin), `/profil`.

### 3.5 `src/components/` : les composants

Par domaine, deux natures :

- **serveur** (par défaut) : reçoivent des données déjà chargées et les rendent. Cartes (`order-card`, qui sert aussi sur le terrain : créneau en grand, appel, itinéraire ; `product-card`, `article-card`, `staff-card`, `customer-card`, `community-card` avec son bandeau de type et de visibilité `community-banner`, `message-card`), listes, tableaux (`orders-table`, avec `CustomerNameLink` : le nom d'un client est toujours un lien vers sa fiche), en-têtes, badges, les badges de type de client (`client-type-label` : « Particulier », badge « Communauté » d'un membre, type « Communauté » d'un groupe), la catégorie en étoiles (`tier-badge`) et les autorisations en pastilles (`consent-pills`) d'un client, la commande jointe à un message (`message-order`), la pastille violette des pièces jointes (`message-attachments`), le bloc « Équipe » d'une commande (`order-team`, qui choisit entre lecture et listes déroulantes), les recherches (`orders-filters`, `customers-search` avec son commutateur de type en boutons radio, `products-filters`, `staff-search` pour l'équipe : champs serveur dans un `AutoSubmitForm`), leur barre commune (`search-field`), le panneau des filtres qui les suit (`filter-tray`, surface teintée, « Réinitialiser » dans son en-tête, avec `check-chip` pour une case à cocher en puce), la zone de dates « du / au » en dernière ligne du panneau ou seule sur sa surface (`date-range-fields`, partagée par toutes les recherches par dates) et le bandeau bleu d'une période sans résultat (`period-empty-notice`), les raccourcis des 7 derniers jours (`delivery-day-shortcuts`), la barre d'avancement segmentée par statut du tableau de bord (`tour-progress`), l'alerte quand aucun préparateur ou livreur n'est présent (`staff-shortage-alert`), la recherche dans l'historique d'une personne (`staff-history-filters`), les sections titrées d'une page (`section`, métriques et tableau de bord), la jauge de fidélité. Aucun hook.
- **client** (`"use client"`, seulement quand un hook l'exige) : les formulaires branchés sur une Server Action avec `useActionState` (`order-actions`, `order-status-form`, `staff-assign-field` qui écrit dès le choix dans la liste, `product-form`, `duplicate-product-button`, `staff-form`, `article-form`, `account-editor`…), `auto-submit-form` (recherche GET lancée pendant la saisie, anti-rebond et protection contre les courses), `catalog-settings-form` (case du paramètre « laisser en vente à stock 0 », écrite dès le changement), `date-picker-button`, `login-scene` (parallaxe au pointeur de la page de connexion, les animations restant en CSS) (calendrier maison des champs « du / au » sur tablette et PC, qui écrit le champ natif), `sort-order-toggle` (bouton de sens du tri des clients, flèche qui pivote ; icône serveur `sort-order-icon`), le camembert plein des métriques (`ratio-pie`, étiquette au survol), le sélecteur de thème, le fil d'Ariane, la navigation.

La coquille : le layout `(dashboard)` pose `@container/main` sur le conteneur de page (les composants de page s'adaptent à sa largeur, donc à la sidebar ouverte ou repliée), `app-sidebar` (logo, navigation filtrée par rôle, utilisateur, déconnexion), `site-header` (bouton du menu, marque sur mobile, fil d'Ariane, thème, avatar vers le profil), `page-header` (le seul `h1` de chaque page).

`components/ui/` contient les composants shadcn copiés dans le projet (bouton, carte, tableau, sidebar…). Ils nous appartiennent : on les modifie sur place, on ne les réinstalle pas.

### 3.6 `src/lib/` : utilitaires purs

`format.ts` (euros, dates, créneaux, quantités), `calendar.ts` (grille de six semaines, mois d'ouverture et déplacements au clavier du calendrier), `days.ts` (arithmétique des jours `AAAA-MM-JJ` et règle commune des périodes « du / au », `readDateRange`), `pie.ts` (géométrie du camembert), `search-query.ts` (URL d'une recherche automatique, tri entre nos réponses et une navigation extérieure), `text.ts` (normalisation sans accents, saisie « façon téléphone », initiales), `navigation.ts` (entrées du menu, fil d'Ariane), `theme.ts` (modes light, dark, fig), `env-schema.ts` et `env.ts` (validation de l'environnement), `password.ts` (scrypt), `rate-limit.ts` (verrou progressif), `csp.ts` (Content-Security-Policy), `security-log.ts` (format du journal), `action-result.ts` (le résultat que toute action renvoie), `dal.ts` (session → utilisateur courant), `simulation.ts` (états vide et erreur en développement).

## 4. Deux flux à connaître par cœur

### Lecture : afficher la liste des commandes

1. Le proxy laisse passer la requête (session valide, section permise) et pose un nonce.
2. `commandes/page.tsx` attend `searchParams`, les passe à `parseOrderFilters` (tolérant : recherche, statut, période, préparateur, livreur), et appelle `getOrdersPage(filters, page)` de la façade.
3. La base filtre, cherche (règle `matchesOrderQuery` reproduite sur des colonnes indexées), renvoie les 40 commandes de la page, les plus récentes d'abord, avec leurs lignes, et compte le total dans une seconde requête lancée en même temps.
4. La page rend `OrdersCards`, qui rend une `OrderCard` par commande, avec `OrderActions` si le rôle peut écrire.
5. Pendant l'attente, Next affiche `loading.tsx`.

### Écriture : changer le statut d'une commande

`changeOrderStatus` dans `commandes/[id]/actions.ts`, neuf étapes toujours dans cet ordre :

1. **session** : `getCurrentUser()` ; sans session, redirection ;
2. **rôle** : `canChangeOrderStatus(role)`, sinon refus journalisé ;
3. **validation** : `changeStatusSchema` sur le `FormData` (statut visé, motif si annulation) ;
4. **relecture** : `getOrder(id)`, jamais l'état que le formulaire prétend ;
5. **idempotence** : même statut → succès sans écriture ;
6. **règle** : `canTransition(courant, visé)` (liste blanche) ;
7. **écriture conditionnelle** : `updateOrderStatus(id, { from, to, actor, cancellation })`, qui écrit aussi l'événement d'historique ; `null` si quelqu'un a changé le statut entre-temps ;
8. **journal et revalidation** : `logSecurity`, `revalidatePath` ;
9. **résultat** : `{ status, message }` affiché par le formulaire.

Le formulaire client ne décide de rien : il propose des options calculées par le serveur, et l'action recalcule tout.

## 5. Authentification et autorisation

- **Connexion** : Auth.js v5 avec e-mail et mot de passe, `authorizeCredentials` (limitation de débit par e-mail et par IP, hachage factice pour un e-mail inconnu, journal), session JWT de 8 heures avec le rôle dedans.
- **Comptes** : la table `users`, créée par le seed (comptes de `.env.local`), gérée sur `/comptes`.
- **Lecture** : la matrice `SECTION_ACCESS` (rôle → sections) est appliquée par le proxy (redirection) et par la navigation (entrées masquées).
- **Écriture** : une règle `canXxx(role)` par action métier, vérifiée dans chaque Server Action après relecture de la session.

## 6. Sécurité

| Mesure                                                                                                           | Où                                                 |
| ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Server Actions comme frontière de confiance (session, rôle, zod, relecture)                                      | `src/app/**/actions.ts`                            |
| Limitation de débit progressive sur la connexion, partagée en base, coût constant e-mail inconnu / mot de passe faux | `src/data/credentials.ts`, `src/data/login-attempts.db.ts`, `src/lib/rate-limit.ts` |
| Écritures concurrentes conditionnelles (statut, affectation) : rien n'est écrasé en silence                     | `src/data/orders.db.ts`                            |
| Content-Security-Policy avec nonce par requête, HSTS, X-Frame-Options, nosniff                                   | `src/proxy.ts`, `src/lib/csp.ts`, `next.config.ts` |
| Déconnexion robuste : le cookie de session n'est re-posé ni sur un préchargement ni tant que le jeton est récent | `src/proxy.ts`, `src/lib/session-refresh.ts`       |
| Journal de sécurité (sortie standard et table `security_events`)                                                 | `src/data/security-log.ts`                         |
| Gardes de démarrage : base PostgreSQL et secret obligatoires, `AUTH_URL` obligatoire en production                 | `src/lib/env-schema.ts`, `src/instrumentation.ts`  |
| Mots de passe hachés par scrypt, jamais journalisés                                                              | `src/lib/password.ts`                              |
| Suppressions confirmées côté serveur (mot `SUPPRIMER`, motif d'annulation)                                       | schémas zod des domaines                           |
| RGPD : export et anonymisation d'un client (administrateur, mot `ANONYMISER`, journal sans donnée de la personne), durées de conservation appliquées par un script à aperçu | `src/domain/privacy/`, `src/db/privacy.ts`, `scripts/rgpd-purge.ts`, [rgpd.md](rgpd.md) |

## 7. Tests

- **Vitest** (`test/`, miroir de `src/`), deux projets : `unit` (règles pures, schémas, fixtures, mappers, sans base) et `db` (couche données et Server Actions de bout en bout sur la base de test Docker, migrée et seedée une fois, chaque test dans une transaction annulée ; `server-only`, `next/cache` et la session neutralisés par `vi.mock`). Chaque requête SQL filtrée ou agrégée est comparée à sa règle pure sur toutes les commandes seedées (recherche avec caractères spéciaux comprise). La géométrie des graphiques (`src/lib/chart.ts`) est testée à part.
- **Playwright** (`e2e/`) : parcours réels dans Chromium contre le serveur construit, sur la base de test (migrée et seedée avant la suite, comptes de test) ; rejoués en CI contre un PostgreSQL de service.

## 8. Performances

Mesurées le 2026-09-15 sur la base de démonstration et sur dix fois plus de commandes (36 830) : la base répond en quelques millisecondes, le serveur rend une page en 30 à 110 ms. Les règles qui tiennent ces chiffres quand l'activité grandit :

- **La base travaille, pas le serveur Node** : filtres, recherche, tris, pagination et totaux en SQL. Aucune page ne lit un historique entier (listes paginées, « les N plus proches », agrégats).
- **Recherche indexée** : colonnes `search_text` et `phone_digits` calculées par la base à chaque écriture (fonction `fig_normalize`), index trigramme `pg_trgm` : 465 ms → 1 ms sur 36 830 commandes.
- **Peu d'allers-retours** : une commande et ses lignes en une requête (JSON), page et total en parallèle, session déchiffrée une fois par requête (`cache()` de React).
- **Peu de JavaScript** : graphiques en SVG et HTML sans bibliothèque (plus de recharts, une centaine de Ko compressés en moins sur Métriques), panneau mobile de la sidebar chargé seulement sur petit écran (`next/dynamic`).
- **Rendu du navigateur** : `content-visibility: auto` (`cv-auto`) sur les cartes des longues listes, ignorées tant qu'elles sont hors de l'écran.

Pour vérifier une requête : `EXPLAIN ANALYZE` sur une base de test grossie ; pour le JavaScript : `npx next experimental-analyze`. En production : `log_min_duration_statement` et `pg_stat_statements` (voir `docs/base-de-donnees.md`).

## 9. Ajouter une fonctionnalité : la checklist

1. Types et règles pures dans `src/domain/<domaine>/`, avec leurs tests.
2. Schéma zod de l'entrée (`schemas.ts`), testé.
3. Contrat `source.ts` étendu ; implémentation db (agrégat ou page SQL, jamais un historique entier chargé en mémoire ; testée contre la règle pure) ; mapper si nouvelle table ; migration (`npm run db:generate`) ; seed si nouvelle donnée de démonstration.
4. Façade `src/data/<domaine>.ts` : réexporter la fonction.
5. Server Action dans `src/app/<section>/actions.ts`, dans l'ordre des neuf étapes ; test de bout en bout.
6. Composants : serveur pour l'affichage, client seulement pour le formulaire.
7. Page, `loading.tsx`, navigation et matrice d'accès si nouvelle section.
8. Parcours Playwright si l'écran change ; `npm run check` ; docs et glossaire.
