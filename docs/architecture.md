# Architecture du dashboard FIG

Ce document décrit comment le code est organisé, ce que fait chaque partie et comment les parties se parlent. Il s'adresse autant à quelqu'un qui découvre le projet qu'à quelqu'un qui doit y ajouter une fonctionnalité.

## 1. L'idée en une page

Le dashboard est une application Next.js rendue côté serveur. Chaque écran est une **page serveur** qui lit des données par une **façade**, puis les affiche avec des **composants**. Chaque modification passe par une **Server Action**, une fonction qui tourne sur le serveur, vérifie qui demande, valide ce qui est envoyé, applique les règles métier, puis écrit par la même façade.

Derrière la façade, deux implémentations interchangeables : des **données factices en mémoire** (mode `mock`, pour développer et tester sans base) et **PostgreSQL** via Drizzle (mode `db`). Le choix se fait par une variable d'environnement, `DATA_SOURCE`. Le reste du code ne sait pas laquelle est active.

Les **règles métier** (tri, filtres, calculs, machine d'états) sont des fonctions pures, sans dépendance à Next ni à la base : elles sont testées en quelques millisecondes et utilisées par les deux implémentations.

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
   ├── src/data/<domaine>.mock.ts   Map en mémoire seedée par les fixtures
   └── src/data/<domaine>.db.ts     Drizzle + PostgreSQL, lignes converties par src/db/mappers.ts
   ▲
src/domain/<domaine>/   types, règles pures, schémas zod des entrées, fixtures, contrat de source
```

## 2. Arborescence

```
Dashboard_fig/
├── README.md                    présentation et mise en route
├── CLAUDE.md                    conventions de travail (pour l'assistant et pour l'équipe)
├── docs/                        cette documentation
├── .github/workflows/ci.yml     intégration continue (check, audit, Playwright mock puis Postgres)
└── dashboard/                   l'application
    ├── src/
    │   ├── app/                 routes Next.js (pages, layouts, actions, états de chargement)
    │   ├── components/          composants React, par domaine ; components/ui/ = shadcn
    │   ├── domain/              métier pur : types, règles, schémas, fixtures, contrats
    │   ├── data/                façades et implémentations des sources (mock, db)
    │   ├── db/                  schéma Drizzle, client PostgreSQL, mappers
    │   ├── lib/                 utilitaires purs (format, env, mots de passe, CSP…)
    │   ├── hooks/               hooks React (un seul : détection mobile)
    │   ├── auth.ts              configuration Auth.js
    │   ├── proxy.ts             middleware de Next : accès et CSP
    │   └── instrumentation.ts   validation de l'environnement au démarrage
    ├── test/                    tests Vitest, en miroir de src/
    ├── e2e/                     parcours navigateur Playwright
    ├── drizzle/                 migrations SQL générées
    ├── scripts/                 seed, création de la base locale, sauvegarde, restauration
    ├── compose.yaml             PostgreSQL Docker de secours (port 5433)
    └── playwright.config.ts     serveur de test, comptes de test
```

## 3. Les couches, du métier à l'écran

### 3.1 `src/domain/<domaine>/` : le métier pur

Un dossier par domaine : `orders` (commandes, avec `assignment.ts` pour l'affectation de l'équipe et `discount.ts` pour les remises), `deliveries` (tournée), `products` (catalogue), `customers` (clients, avec `loyalty.ts` pour la série de fidélité, `client-type.ts` pour particulier ou communauté, `directory.ts` pour la recherche commune), `communities` (groupes de clients livrés à un même point de retrait), `staff` (personnel : livreurs, préparateurs, gestionnaires), `articles`, `metrics` (agrégations), `engagement` (usage de l'appli), `auth` (rôles et comptes). Chaque dossier suit le même patron :

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

- `<domaine>.ts` : la **façade**, seul module que les pages et les actions importent. Elle commence par `import "server-only"` (impossible de l'embarquer dans le navigateur) et choisit l'implémentation avec `selectSource()` selon `DATA_SOURCE`, au moment de chaque appel (`source()`) et non au chargement du module : `next build` importe les pages sans environnement (`test/app/facades.test.ts`).
- `<domaine>.mock.ts` : une `Map` en mémoire seedée depuis les fixtures, avec une latence simulée (pour voir les états de chargement) et des copies à l'entrée et à la sortie (rien ne partage d'objet avec le store). Une fonction `resetXxxMock()` hors contrat sert aux tests.
- `<domaine>.db.ts` : la même chose avec Drizzle. Les filtres deviennent des `WHERE`, les tris des `ORDER BY`, les écritures conditionnelles des `UPDATE … WHERE id = $1 AND status = $2` (statut) ou `… AND driver_id IS NOT DISTINCT FROM $2` (affectation), les opérations couplées des transactions. `test/contract/sources.pg.test.ts` vérifie que le mock et la base répondent pareil. Les lignes ne sortent jamais telles quelles : `src/db/mappers.ts` les convertit en types métier.

Fichiers transverses : `session.ts` (utilisateur courant), `credentials.ts` (vérification d'un mot de passe avec limitation de débit), `login-attempts.ts` (état de la limitation : en mémoire en mode mock, table `login_attempts` en mode db, partagée entre instances), `security-log.ts` (journal), `select-source.ts` (le choix mock / db).

### 3.3 `src/db/` : PostgreSQL

- `schema.ts` : les tables, enums et contraintes, source de vérité des migrations. Le schéma n'importe pas le domaine (drizzle-kit doit pouvoir le charger seul) ; un test vérifie que ses enums restent identiques aux constantes du domaine.
- `client.ts` : `getDb()`, client paresseux (aucune connexion avant le premier appel), pool de cinq connexions, refus en mode mock.
- `mappers.ts` : fonctions pures ligne → type métier et entrée → colonnes, testées en aller-retour sur toutes les fixtures : l'écran est identique en mock et en base.

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
| `api/auth/[...nextauth]/route.ts` | points d'entrée d'Auth.js                                                              |

Sections : `/` tableau de bord, `/commandes`, `/livraisons`, `/catalogue`, `/articles`, `/clients` (recherche commune particuliers et communautés, fiches `/clients/[id]` et `/clients/communautes/[id]`), `/personnel` (équipe, fiche `/personnel/[id]`), `/metriques`, `/comptes` (admin), `/profil`.

### 3.5 `src/components/` : les composants

Par domaine, deux natures :

- **serveur** (par défaut) : reçoivent des données déjà chargées et les rendent. Cartes (`order-card`, `delivery-card`, `product-card`, `article-card`, `staff-card`, `customer-card`, `community-card`), listes, tableaux, en-têtes, badges, l'étiquette de type de client (`client-type-label`), le bloc « Équipe » d'une commande (`order-team`, qui choisit entre lecture et listes déroulantes), les recherches (`orders-filters` partagée par les commandes et les livraisons, `customers-search`, `products-filters`, `staff-search` pour l'équipe : champs serveur dans un `AutoSubmitForm`), la tournée groupée par jour (`tour-cards`) et sa barre d'avancement segmentée par statut (`tour-progress`), la recherche dans l'historique d'une personne (`staff-history-filters`), les sections des métriques (`metrics-section`), la jauge de fidélité. Aucun hook.
- **client** (`"use client"`, seulement quand un hook l'exige) : les formulaires branchés sur une Server Action avec `useActionState` (`order-actions`, `order-status-form`, `staff-assign-field` qui écrit dès le choix dans la liste, `product-form`, `duplicate-product-button`, `staff-form`, `article-form`, `account-editor`…), `auto-submit-form` (recherche GET lancée pendant la saisie, anti-rebond et protection contre les courses), le camembert plein des métriques (`ratio-pie`, étiquette au survol), le sélecteur de thème, le fil d'Ariane, la navigation.

La coquille : le layout `(dashboard)` pose `@container/main` sur le conteneur de page (les composants de page s'adaptent à sa largeur, donc à la sidebar ouverte ou repliée), `app-sidebar` (logo, navigation filtrée par rôle, utilisateur, déconnexion), `site-header` (bouton du menu, marque sur mobile, fil d'Ariane, thème, avatar vers le profil), `page-header` (le seul `h1` de chaque page).

`components/ui/` contient les composants shadcn copiés dans le projet (bouton, carte, tableau, sidebar…). Ils nous appartiennent : on les modifie sur place, on ne les réinstalle pas.

### 3.6 `src/lib/` : utilitaires purs

`format.ts` (euros, dates, créneaux, quantités), `days.ts` (arithmétique des jours `AAAA-MM-JJ`, partagée par les métriques et la tournée), `pie.ts` (géométrie du camembert), `search-query.ts` (URL d'une recherche automatique, tri entre nos réponses et une navigation extérieure), `text.ts` (normalisation sans accents, saisie « façon téléphone », initiales), `navigation.ts` (entrées du menu, fil d'Ariane), `theme.ts` (modes light, dark, fig), `env-schema.ts` et `env.ts` (validation de l'environnement), `password.ts` (scrypt), `rate-limit.ts` (verrou progressif), `csp.ts` (Content-Security-Policy), `security-log.ts` (format du journal), `action-result.ts` (le résultat que toute action renvoie), `dal.ts` (session → utilisateur courant), `simulation.ts` (états vide et erreur en développement).

## 4. Deux flux à connaître par cœur

### Lecture : afficher la liste des commandes

1. Le proxy laisse passer la requête (session valide, section permise) et pose un nonce.
2. `commandes/page.tsx` attend `searchParams`, les passe à `parseOrderFilters` (tolérant : recherche, statut, période, préparateur, livreur), et appelle `getOrders(filters)` de la façade.
3. La façade délègue au mock ou à Drizzle ; dans les deux cas, résultat trié par créneau, et la recherche libre passe par la même règle pure (`matchesOrderQuery`).
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
- **Comptes** : en mode mock, le compte d'amorçage et le gestionnaire viennent de `.env.local` ; en mode db, la table `users` (créée par le seed, gérée sur `/comptes`).
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
| Gardes de production : `AUTH_URL` obligatoire, fixtures et amorçage refusés sans dérogation explicite            | `src/lib/env-schema.ts`, `src/instrumentation.ts`  |
| Mots de passe hachés par scrypt, jamais journalisés                                                              | `src/lib/password.ts`                              |
| Suppressions confirmées côté serveur (mot `SUPPRIMER`, motif d'annulation)                                       | schémas zod des domaines                           |

## 7. Tests

- **Vitest** (`test/`, miroir de `src/`) : règles pures, schémas, fixtures, mocks, mappers, et les Server Actions de bout en bout sur le mock (`server-only`, `next/cache`, la session et l'env sont neutralisés par `vi.mock`). Un test n'importe jamais une façade.
- **Playwright** (`e2e/`) : parcours réels dans Chromium contre le serveur construit, avec des comptes de test ; rejoués en CI sur fixtures puis contre PostgreSQL.

## 8. Ajouter une fonctionnalité : la checklist

1. Types et règles pures dans `src/domain/<domaine>/`, avec leurs tests.
2. Schéma zod de l'entrée (`schemas.ts`), testé.
3. Contrat `source.ts` étendu ; implémentations mock **et** db ; mapper si nouvelle table ; migration (`npm run db:generate`).
4. Façade `src/data/<domaine>.ts` : réexporter la fonction.
5. Server Action dans `src/app/<section>/actions.ts`, dans l'ordre des neuf étapes ; test de bout en bout.
6. Composants : serveur pour l'affichage, client seulement pour le formulaire.
7. Page, `loading.tsx`, navigation et matrice d'accès si nouvelle section.
8. Parcours Playwright si l'écran change ; `npm run check` ; docs et glossaire.
