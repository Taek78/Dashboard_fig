# Jalons A3 à A7 et B1 : ce qui a été livré et comment (2026-09-13)

Codé par Claude à la demande de Zaki (« à toi de coder l'intégralité du projet »). Ce document sert de guide de lecture, dans le format des consignes : pour chaque jalon, les fichiers, ce que fait chaque pièce et pourquoi. Tout est vérifié : `npm run check` (289 tests), `npm run build`, puis parcours complet en `next start` avec session.

Patron commun à tous les domaines (posé en A1-A2, répété tel quel) :

1. `src/domain/<domaine>/types.ts` : types métier du front. `rules.ts` : fonctions pures testées. `schemas.ts` : zod des ENTRÉES (URL tolérante, formulaire strict). `fixtures.ts` : données factices déterministes, sans personne réelle. `source.ts` : le contrat `XxxSource`.
2. `src/data/<domaine>.mock.ts` : `Map` mutable seedée, clone à l'entrée et à la sortie, latence simulée, `resetXxxMock()` hors contrat. `src/data/<domaine>.ts` : façade `server-only`, seule importée par le front, choisit l'implémentation via `selectSource()` (B1).
3. `src/app/(dashboard)/<section>/…/actions.ts` : Server Action en neuf étapes (session → rôle → zod → relecture → règle → écriture → revalidation → résultat). `src/components/<domaine>/…-form.tsx` : le seul fichier `"use client"` du domaine (`useActionState`).
4. Tests miroir dans `test/` : règles, fixtures, schémas, mock, et l'action de bout en bout (`server-only`, `next/cache`, `@/data/session` et `@/lib/env` neutralisés par `vi.mock`).

---

## A3 : Livraisons (`/livraisons`)

> **Mise à jour du 2026-09-13** : l'attribution de livreur décrite ci-dessous a été retirée à la demande du client. La page présente la tournée en cartes horizontales avec le changement de statut ; seuls `todayInParis`, `deliveryDates`, `summarizeTour` et `parseTourDate` subsistent.

- `domain/deliveries/types.ts` : `Courier { id, name, phone, zone }`, `Assignment { orderId, courierId, date, start, end }`. Le créneau est copié depuis la commande à l'attribution : la règle de conflit se vérifie sur les seules attributions du jour.
- `rules.ts` : `ASSIGNABLE_STATUSES` (confirmée, en préparation, en livraison) et `canBeAssigned(status)` ; `hasSlotConflict(assignments, courierId, slot, orderId)` (même livreur, même jour, même heure, autre commande) ; `buildTour(orders, assignments, couriers)` croise une fois pour la page ; `countUnassigned(tour)` ; `todayInParis(now)` ; `deliveryDates(orders)` pour les raccourcis.
- `schemas.ts` : `assignCourierSchema { orderId, courierId }` strict ; `parseTourDate(raw)` tolérant.
- `source.ts` : `getCouriers()`, `getAssignments(date?)`, `assignOrder(assignment)` (remplace l'attribution de la commande : une commande n'a qu'un livreur).
- `livraisons/actions.ts` : `assignCourier` relit la commande, refuse un statut non attribuable, vérifie que le livreur existe, calcule le conflit sur les attributions du jour **relues**, écrit, revalide `/livraisons` et `/commandes`.
- UI : `components/deliveries/tour-table.tsx` (serveur) et `assign-courier-form.tsx` (client, un par ligne attribuable). Page avec sélecteur de jour (GET), raccourcis « jours avec des commandes », compteur « n commandes, m sans livreur ».
- Nav : entrée « Livraisons » ajoutée dans `lib/navigation.ts`. Rôles : `canAssignCourier`, `canEditProduct`, `canAddCustomerNote` ajoutés dans `domain/auth/roles.ts`.

## A4 : Catalogue et stocks (`/catalogue`, `/catalogue/[id]`)

- `domain/products/category.ts` : `PRODUCT_CATEGORIES as const` + libellés. `types.ts` : `Product { …, unit, priceCents (par kg si g, par pièce sinon), available, stockQuantity, updatedAt }`, `ProductFilters`, `ProductPatch`.
- `rules.ts` : `eurosToCents("12,50") → 1250 | null` (regex stricte, deux décimales, > 0, arrondi entier) ; `centsToEurosInput` ; `filterProducts` (catégorie, recherche sans accents via `lib/text.ts`, disponibilité) ; `sortProductsByName` (ordre français) ; `isLowStock` (< 2 kg ou < 10 pièces).
- `schemas.ts` : `parseProductFilters` (clés d'URL `categorie`, `q`, `dispo`) ; `updateProductSchema` : le prix est validé en euros puis **transformé en centimes par zod** (`ctx.addIssue` + `z.NEVER` si invalide), la case à cocher absente vaut `false`, le stock est un entier positif.
- `catalogue/[id]/actions.ts` : `saveProduct`. Fiche : carte « État actuel » et carte « Modifier » (`product-form.tsx`, client). Liste : filtres GET, badges « Stock bas », « En vente » / « Retiré ».
- Fixtures : les 16 produits des lignes de commande, prix cohérents avec les totaux de ligne (vérifié par test).

## A5 : Clients et support (`/clients`, `/clients/[id]`)

- `domain/customers/types.ts` : `Customer { …, notes: CustomerNote[] }`, `CustomerNote { id, text, authorName, createdAt }`.
- `rules.ts` : `searchCustomers(customers, query)` sur nom, e-mail, téléphone (chiffres seuls, deux chiffres minimum) ; `sortCustomersByName` ; `computeCustomerStats(orders)` (nombre, total hors annulées, dernière livraison) ; `sortNotesNewestFirst`.
- `lib/text.ts` : `normalize` (accents, ligatures œ/æ, casse) et `digitsOnly`, partagés avec le catalogue.
- Croisement avec les commandes : `OrderFilters.customerId` ajouté à `filterOrders`.
- `source.ts` : `getCustomers(query?)`, `getCustomer(id)`, `addNote(customerId, note)` : la date et l'auteur viennent de l'action (session + horloge), jamais du formulaire (testé : un `authorName` forgé est ignoré).
- `clients/[id]/actions.ts` : `addCustomerNote`. Fiche : Coordonnées, Chiffres clés, Notes internes (+ `customer-note-form.tsx`, vidé après succès), historique via `OrdersTable`.

## A6 : Métriques (`/metriques`) et tableau de bord (`/`)

- `domain/metrics/rules.ts` : `METRIC_PERIODS` (7, 30, tout) ; `daysBefore`, `filterByPeriod(orders, period, today)` ; `computeKpis` (CA hors annulées, panier moyen entier, annulées, en attente) ; `revenueByDay` ; `ordersByStatus` (une entrée par statut, même à zéro) ; `topProducts(orders, limit)` (CA décroissant puis nom).
- `schemas.ts` : `parseMetricPeriod` (`?periode=`, 30 par défaut).
- UI : `components/metrics/kpi-card.tsx` (serveur), `revenue-chart.tsx` et `status-chart.tsx` (client, recharts, couleurs par tokens `--chart-1…5`, doublés par un tableau ou une liste `sr-only`). Page d'accueil : KPI du jour, « à confirmer », « sans livreur aujourd'hui », raccourcis, commandes à confirmer.
- Les chiffres affichés sont ceux des tests de `metrics/rules.test.ts` sur les fixtures.

## A7 : Authentification (Auth.js v5)

- `lib/env-schema.ts` (pur) : union discriminée sur `DATA_SOURCE` (`mock` | `db` + `DATABASE_URL`), `AUTH_SECRET` ≥ 32, compte d'amorçage `AUTH_BOOTSTRAP_EMAIL / PASSWORD (≥ 12) / NAME`. `lib/env.ts` (`server-only`) : `getEnv()` paresseux et mémorisé.
- `lib/password.ts` : scrypt de Node (aucune dépendance), sel aléatoire, `timingSafeEqual`.
- `domain/auth` : `UserAccount`, `loginSchema`, `UsersSource`. `data/users.mock.ts` : store **vide** (aucun mot de passe dans le code) ; `data/users.ts` : le seed avec le compte d'amorçage, haché à la volée.
- `src/auth.ts` : `NextAuth(() => config)` (config paresseuse : le build ne réclame pas l'environnement), Credentials avec `authorize` qui renvoie `null` sans distinguer e-mail inconnu et mot de passe faux, session JWT 8 h, rôle copié dans le jeton puis dans `session.user`. Types augmentés dans `src/types/next-auth.d.ts`.
- `src/lib/dal.ts` : `verifySession()` : session → `CurrentUser`, sinon `redirect("/connexion")`. `data/session.ts` : `getCurrentUser()` délègue : **aucune Server Action n'a changé**.
- `src/proxy.ts` (ex-middleware, Node) : délègue à `auth(request, event)` ; `callbacks.authorized` refuse sans utilisateur, Auth.js redirige vers `/connexion?callbackUrl=`. Matcher : tout sauf `api/auth`, `api/health`, `connexion`, assets.
- `/connexion` : page hors coquille + `login-form.tsx` ; `connexion/actions.ts` : `login` (signIn, message unique en cas d'échec), `logout`. Sidebar : nom et rôle de la session, bouton « Se déconnecter » (formulaire, sans JS).
- Layout `(dashboard)` : `verifySession()` en tête. Fiche commande : formulaire masqué pour le rôle lecture (l'action revérifie).
- `.env.local` de développement créé sur ce poste (ignoré par git) avec un secret généré et le compte `admin@fig-demo.invalid` / `Demo-FIG-2026-local`. `.env.example` documente les variables.

## B1 : socle base de données

- `compose.yaml` : Postgres 16 local sur `127.0.0.1:5432`, volume nommé, healthcheck. `docker compose up -d`.
- `src/db/client.ts` (`server-only`) : `getDb()` paresseux, refuse si `DATA_SOURCE ≠ db`, pool `max 5 / idle 20 s / connect 10 s`, mémorisé sur `globalThis` en développement. `src/db/schema.ts` : vide, à remplir par `drizzle-kit pull` (B2).
- `src/app/api/health/route.ts` : `{ ok: true }` en mock ; `select 1` en db → 200 ou 503 `{ ok: false }`, `no-store`, jamais de détail.
- `src/data/select-source.ts` : `selectSource(domaine, mock, db | null)` ; les quatre façades l'utilisent ; `DATA_SOURCE=db` sans implémentation Drizzle lève un message clair (B3).
- `src/instrumentation.ts` : `register()` valide l'environnement au démarrage (vérifié : `DATA_SOURCE=csv` empêche le serveur de répondre).
- `drizzle.config.ts` : erreur explicite si `DATABASE_URL` manque.

## Bloqué par le client (piste B2 à B6)

Sans réponse aux 9 questions du backlog (accès lecture seule, schéma, accord écrit sur les écritures), rien de B2 à B6 ne peut être fait : introspection, mapping `toOrder(row)`, bascule domaine par domaine, écritures réelles, durcissement. Tout le front est prêt à les recevoir : chaque façade attend une implémentation `XxxSource` de plus.
