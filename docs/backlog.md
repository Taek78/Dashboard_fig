# Backlog du dashboard FIG (version « frontend d'abord », 2026-09-07)

Produit par l'équipe d'agents (tech lead, architecte sécurité backend, designer UI/UX, mentor). Statut : **proposition à valider par Zaki**. Remplace la version précédente orientée « socle base de données ». WIP = 1 sur la piste A ; chaque jalon finit démontrable.

Documents liés : [a1-spec-ui.md](a1-spec-ui.md) (designer), [a1-spec-branchements.md](a1-spec-branchements.md) (architecte), [a1-concepts.md](a1-concepts.md) (mentor). Les anciens `jalon-1-*.md` restent la spécification de la piste B1.

## Cadrage

Construire d'abord tout le back-office FIG (coquille, navigation, quatre domaines, formulaires validés par zod, graphiques) sur des données factices typées, en isolant l'accès aux données derrière une façade que l'on rebranchera sur la base du client sans toucher au front le jour où Zaki aura l'accès et le schéma.

**Règle de sécurité de la piste A, non négociable.** Tant que A7 (auth) n'est pas livré : aucune `DATABASE_URL` réelle sur le poste, aucun déploiement, aucune donnée personnelle réelle dans les fixtures. Le dashboard ne tourne que sur `localhost` avec des données inventées. C'est ce qui rend acceptable de reporter l'authentification : il n'y a rien à protéger avant.

**Décisions tranchées par le tech lead.**
- Types métier dans `src/domain/<domaine>/`, pas dans `src/types/` : tout ce qui concerne « commandes » vit dans un seul dossier.
- Source de données = modules de fonctions async par domaine + contrat de type + façade, sans classes ni injection. Un junior lit « un fichier = un jeu de fonctions » ; les tests importent le mock ou les fonctions pures ; le branchement change une ligne dans la façade.
- Page d'accueil `/` = « Tableau de bord », vide en A1, remplie par les métriques en A6.
- Statuts et créneaux : vocabulaire français provisoire, marqué « à aligner sur le client » dans `docs/branchements.md`. C'est du vocabulaire de front, pas un schéma.
- Pas de tables inventées. Des types métier côté dashboard sont assumés : ils seront mappés sur le schéma du client, jamais migrés vers lui.

## Piste A : frontend, sans base

| # | Jalon | Contenu | Démontrable quand | Bloqué par |
|---|---|---|---|---|
| A1 | **Coquille + liste des commandes** | Nettoyage du template, types `orders`, fixtures déterministes, façade, layout `(dashboard)` avec sidebar shadcn et 5 entrées, pages avec état vide, liste des commandes avec états chargement / vide / erreur, `docs/branchements.md` | Navigation clavier complète, mobile et desktop ; `/commandes` affiche les fixtures ; `?simuler=vide` et `?simuler=erreur` montrent les deux autres états en dev seulement ; `npm run check` vert | rien |
| A2 | Commandes : filtres, détail, changement de statut | `searchParams` validés par zod, page `/commandes/[id]`, machine d'états pure testée (`canTransition`), première Server Action (`"use server"` + zod sur `FormData` + `useActionState`) sur le mock en mémoire | Filtrer par statut via l'URL ; changer un statut depuis le détail, transition interdite refusée avec message FR, le mock reflète le changement | A1 |
| A3 ✅ | Livraisons | Types `deliveries` (livreurs, créneaux, zones), vue « tournée du jour », attribution d'un livreur avec règle pure « pas deux fois le même créneau » | Attribuer une commande ; un conflit est refusé côté serveur | A2 |
| A4 ✅ | Catalogue et stocks | Types `products`, liste, fiche, édition prix (centimes) / disponibilité / stock via Server Actions validées | Prix saisi en euros, stocké en centimes ; saisie invalide refusée côté serveur | A2 |
| A5 ✅ | Clients et support | Types `customers`, recherche nom / email / téléphone, fiche, historique (croisement avec `orders`), notes internes | Retrouver un client factice et voir ses commandes | A2 |
| A6 ✅ | Métriques | Agrégations pures testées (CA, panier moyen, volumes par jour), cartes KPI, recharts en `"use client"`, page d'accueil remplie | Les chiffres affichés égalent ceux calculés dans un test sur les fixtures | A1 |
| A7 ✅ | **Auth du dashboard** | Auth.js v5 Credentials, `src/auth.ts`, `/connexion`, `proxy.ts`, `src/lib/dal.ts` avec `verifySession()` remplaçant le stub `getCurrentUser()`, rôles `admin / gestionnaire / lecture`, compte d'amorçage par env | Non connecté → `/connexion` ; rôle `lecture` refusé sur une action ; toutes les actions A2 à A5 passent par `verifySession()` | réponse Q5 souhaitable |
| | **Démo client = A1 à A6** sur fixtures | | Parcours complet : commandes du jour, statut, attribution, prix, fiche client, graphiques | |

**Pourquoi l'auth est en fin de piste A.** Q4/Q5 sont ouvertes : le client a peut-être déjà une authentification, coder Credentials maintenant risque d'être jeté. Rien de réel n'est exposé avant A7. Le front est construit dès A1 avec un stub `getCurrentUser()` qui **plante hors development/test**, et dès A2 chaque Server Action commence par l'appeler : A7 sera un remplacement d'implémentation, pas une revue de toutes les actions. Auth.js est un gros concept, mieux abordé quand les Server Actions sont acquises.

## Piste B : branchements, préparés pendant A, exécutés à l'accès

| # | Jalon | Contenu | Démontrable quand | Bloqué par |
|---|---|---|---|---|
| B0 | **Contrat de branchement** (fil rouge) | `docs/branchements.md` : pour chaque fonction de `src/data/*.ts` ses entrées/sorties, pour chaque champ des types la colonne client attendue (inconnue pour l'instant), unités, conversions, vocabulaire à aligner | Le document liste toutes les fonctions et tous les champs consommés par le front | rien |
| B1 ✅ | Socle technique (ex-jalon 1, étapes 1.2 à 1.6) | Postgres local Docker, `env-schema.ts` / `env.ts` avec `DATA_SOURCE=mock\|db` en union discriminée, `db/client.ts` paresseux (`getDb()`) avec `server-only`, `/api/health` | `/api/health` 200 base allumée, 503 éteinte ; `DATA_SOURCE` absent → le démarrage échoue | Q1 souhaitable |
| B2 | Introspection du schéma client (ex-jalon 4) | `drizzle-kit pull` sur compte lecture seule, `docs/schema-client.md`, seed ou dump anonymisé dans Docker | `drizzle-kit studio` montre les tables du client en local | **Q1 à Q3** |
| B3 | Mapping et implémentation Drizzle par domaine | `src/data/<domaine>.db.ts` conforme au contrat, mapper `toOrder(row)` en objet littéral avec type de retour explicite, remplissage de `docs/branchements.md` | `npm run typecheck` vert avec les deux implémentations ; écrans A1 à A6 fonctionnent avec `DATA_SOURCE=db` | B1, B2 |
| B4 | Bascule domaine par domaine | Commandes → livraisons → catalogue → clients → métriques ; comparaison écran / requête SQL manuelle | Chaque écran donne le même résultat que le SQL | B3 |
| B5 | Écritures réelles | Server Actions A2 à A5 contre la base client : transactions, mises à jour conditionnelles, respect des triggers | Un changement de statut apparaît dans l'appli FIG du client | B4, **Q4 accord écrit** |
| B6 | Durcissement et mise en ligne (ex-jalon 10) | Journal d'audit, protection de `/api/health`, compte SQL dédié, env de prod | Audit de l'architecte sans point critique ou haut | tout, Q8 |

**Pourquoi Docker et la route de santé passent en B1.** Sans schéma, un Postgres local ne contient rien : la valeur de B1 arrive avec B2. La spécification déjà écrite ([jalon-1-spec-backend.md](jalon-1-spec-backend.md)) reste exacte et attendra.

## Architecture de branchement

```
src/domain/orders/
  types.ts        Order, OrderLine, OrderStatus (vocabulaire du front)
  status.ts       ORDER_STATUSES as const, ORDER_STATUS_LABELS (FR) ; A2 : canTransition()
  rules.ts        logique pure testée : computeOrderTotalCents(lines) ; A2 : filterOrders()
  schemas.ts      zod v4 des ENTRÉES uniquement : orderFiltersSchema, changeStatusSchema (A2)
  source.ts       contrat : type OrdersSource = { getOrders(); getOrder(id) ; A2 : updateOrderStatus(id, from, to) }
  fixtures.ts     ordersFixtures: readonly Order[], déterministes, FIXTURE_TODAY = "2026-09-07"
src/domain/auth/
  roles.ts        ROLES as const, Role, canChangeOrderStatus(role)
  types.ts        CurrentUser
  guards.ts       assertMockSessionAllowed(nodeEnv) pur, testé
src/data/
  orders.mock.ts  export const ordersMock: OrdersSource (fixtures, latence 400 ms, resetOrdersMock hors contrat)
  orders.db.ts    (B3) export const ordersDb: OrdersSource, server-only, mapper toOrder(row)
  orders.ts       import "server-only" ; const source: OrdersSource = ordersMock ; réexporte chaque fonction
  session.ts      import "server-only" ; getCurrentUser() mock, garde en liste blanche dev/test
test/                (miroir de src/, écrit par Claude : décision du 2026-09-08)
  domain/orders/{rules,fixtures}.test.ts
src/lib/
  format.ts       formatEuros(cents), formatDateFr(iso), formatSlot(slot) : purs, testés
  simulation.ts   readSimulationMode(raw, isDev) : pur, testé (6 cas)
  navigation.ts   NAV_ITEMS as const, isNavItemActive(pathname, href) : pur, testé
  action-result.ts (A2) type ActionResult, idleActionResult
```

**Règles du découplage.**
1. La source renvoie toujours des types métier, jamais des lignes Drizzle. Le mapper `toOrder(row)` de B3 est l'unique lieu de conversion d'unités et de noms de colonnes ; il déclare son type de retour et construit un objet littéral, jamais `return row`.
2. `import "server-only"` en ligne 1 de `src/data/orders.ts` et `src/data/session.ts` dès aujourd'hui. Conséquence : les tests importent `orders.mock.ts` ou `src/domain/**`, jamais la façade.
3. Seul `src/data/orders.ts` importe `orders.mock.ts`. Vérif : `grep -rn "orders.mock" src --include=*.tsx` vide.
4. Fixtures déterministes : pas de `Math.random()`, `new Date()`, `Date.now()`. Ids `cmd-0001`. Emails `@example.invalid`, téléphones `06 39 98 00 xx`, adresses = ville + code postal.
5. Mock mutable en mémoire à partir de A2 (`Map` seedée depuis les fixtures, copie renvoyée via `structuredClone`). Repart des fixtures à chaque redémarrage : voulu.
6. Types d'entités en TypeScript simple ; zod uniquement pour ce qui vient de l'extérieur (`FormData`, `searchParams`).
7. `getOrders()` sans paramètre en A1 ; `filters?` arrive en A2 avec `filterOrders` pur. Un paramètre accepté mais ignoré est un mensonge d'API.

**Flux de lecture.** `page.tsx` async → `await searchParams` → `readSimulationMode` → `await getOrders()` depuis `@/data/orders` → rendu. La page ne sait pas si `getOrders` lit une `Map` ou Postgres.

**Flux d'écriture (A2).** `actions.ts` en `"use server"` : `getCurrentUser()` et `canChangeOrderStatus(role)` → `safeParse(Object.fromEntries(formData))` → relecture `getOrder(id)` → `canTransition(current, next)` → `updateOrderStatus(id, from, to)` → `revalidatePath("/commandes", "layout")` → `ActionResult`. L'action relit la commande au lieu de croire le statut envoyé par le formulaire.

## Jalon A1 en détail : « Coquille + liste des commandes »

**Mise à jour du 2026-09-08.** Zaki avance sur les fonctionnalités et n'écrit pas de tests ; Claude écrit et maintient les tests dans `dashboard/test/` (miroir de `src/`) à chaque étape. **Jalon A1 livré le 2026-09-08** : coquille (sidebar, en-tête, cinq pages), liste des commandes avec états chargement / vide / erreur, simulation dev vérifiée inerte en build de production, `docs/branchements.md` créé. **A3 → A7 et B1 livrés le 2026-09-13** par Claude (voir `docs/a3-b1-livraison.md`) : livraisons, catalogue, clients, métriques, Auth.js, socle base (compose, getDb, /api/health, DATA_SOURCE). 289 tests. B2 → B6 restent bloqués par le client (Q1 à Q4). **A2 cadré le 2026-09-08** (consignes `docs/a2-consignes.md`, specs `a2-spec-ui.md`, `a2-spec-branchements.md`), **livré le 2026-09-13** : filtres statut/date par l'URL, détail `/commandes/[id]`, Server Action `changeOrderStatus` avec `useActionState`, mock mutable à écriture conditionnelle ; 165 tests. Changement de mode le 2026-09-13 : Zaki a demandé à Claude de coder l'intégralité du projet (A2.3 → A2.8 codés par Claude). Prochaine étape : cadrage A3.

Ordre : types → fixtures → source → coquille → écran. Toutes les commandes depuis `dashboard/`. Après chaque étape : relecture par `mentor-reviewer` ; pour A1.3 et A1.6 aussi par `security-backend-architect`.

Arbitrages du tech lead entre les trois rapports :
- Template de titre : `"%s · FIG Back-office"` (point médian).
- `computeOrderTotalCents(lines)` = somme des `lineTotalCents`. Pas de règle `prix × quantité` inventée : la tarification dépend du client.
- Garde de session en **liste blanche** (`development` ou `test`, sinon `throw`), version de l'architecte : plus stricte que « si production alors throw ».
- Simulation dans `src/lib/simulation.ts` (emplacement du tech lead), `NODE_ENV` suffit pour A1.
- Le paquet `cn` dans `package.json` est légitime : shadcn v4 base-nova l'installe et `src/lib/utils.ts` le réexporte. On ne le retire pas.
- Installation shadcn minimale du designer (sans `breadcrumb` ni `card` en A1).
- Vider le placeholder `AUTH_SECRET` de `.env.example` (il fait pile 32 caractères) : à faire en A1.0.

| Étape | Quoi | Vérif | Spécialiste |
|---|---|---|---|
| A1.0 | **Nettoyage.** `layout.tsx` : `lang="fr"`, `metadata.title = { default: "FIG Back-office", template: "%s · FIG Back-office" }`, description FR. `page.tsx` déplacé vers `(dashboard)/page.tsx` en A1.4 ; en attendant un `<h1>` « Tableau de bord ». Retirer les svg Vercel/Next de `public/`. `.env.example` : `AUTH_SECRET=` vide + commentaire | `npm run check` vert ; `curl -s localhost:3000 \| grep -c "Tableau de bord"` → `1` | mentor (concept A1.0) |
| A1.1 | **Types métier.** `src/domain/orders/types.ts`, `status.ts`. Dates ISO string, montants `…Cents`, `unit: "piece" \| "g"`, chaque ligne porte `lineTotalCents` ; `customer: { id, fullName, email, phone }`, `deliveryCity` + `deliveryPostalCode` | `npm run typecheck` vert ; `grep -rn "Date\b" src/domain` ne renvoie que des commentaires | mentor (A1.1) |
| A1.2 | **Fixtures + première fonction pure.** `rules.ts` : `computeOrderTotalCents`. `fixtures.ts` : 14 commandes, tous statuts, 3 dates (J-1, J, J+1 autour de `FIXTURE_TODAY`), 2 à 5 lignes, `totalCents` cohérent. `fixtures.test.ts` : ids uniques, chaque statut présent, `totalCents === computeOrderTotalCents(lines)`, emails `@example.invalid`, téléphones `06 39 98`. `rules.test.ts` : vide → 0, deux lignes → somme | `npx vitest run src/domain/orders` vert ; `grep -n "Math.random\|Date.now\|new Date(" src/domain` vide | architecte §5, mentor (A1.2) |
| A1.3 | **Source de données.** `source.ts`, `orders.mock.ts` (latence 400 ms), `orders.ts` (façade, `server-only` ligne 1), `src/domain/auth/{roles,types,guards}.ts` + tests de la garde (5 cas), `src/data/session.ts`, `src/lib/simulation.ts` + test (6 cas dont `("erreur", false) → null`) | `npm run typecheck` vert ; `npx vitest run src/lib src/domain` vert ; `grep -rn "from \"\.\." src` vide ; `head -1 src/data/orders.ts` → `import "server-only";` | **architecte §1 à §3**, mentor (A1.3) |
| A1.4 | **Coquille.** `npx shadcn@latest add sidebar separator skeleton table badge empty` puis `npm run format` ; traduire les libellés sr-only de `sidebar.tsx`. `src/lib/navigation.ts` + test. `app-sidebar.tsx`, `nav-main.tsx` (`"use client"`), `site-header.tsx`, `page-header.tsx`, `coming-soon.tsx`. `(dashboard)/layout.tsx` avec lien d'évitement, pages `(dashboard)/page.tsx`, `commandes/`, `catalogue/`, `clients/`, `metriques/` | `npm run check` vert ; les 5 URLs répondent 200 ; Tab parcourt lien d'évitement → nav → trigger → contenu ; à 375 px la sidebar devient un panneau ; entrée active visible et `aria-current="page"` | **designer partie 1**, mentor (A1.4) |
| A1.5 | **Formatage pur.** `src/lib/format.ts` : `formatEuros`, `formatDateFr`, `formatSlot`. Tests avec normalisation des espaces insécables | `npx vitest run src/lib/format.test.ts` vert | mentor (A1.5) |
| A1.6 | **Liste des commandes + états.** `commandes/page.tsx` async avec `PageProps<"/commandes">`, `await searchParams`, simulation, `getOrders()`. `orders-table.tsx`, `order-status-badge.tsx`, `loading.tsx`, `error.tsx` (`"use client"`, `retry`), état vide `Empty` | `curl -s localhost:3000/commandes \| grep -c "cmd-"` → `14` ; `?simuler=vide` → état vide ; `?simuler=erreur` → message FR + « Réessayer » ; skeleton visible ; **`npm run build && npm run start`** : `?simuler=vide` → `grep -c "Aucune commande"` = `0` | **designer partie 2**, architecte §3, mentor (A1.6) |
| A1.7 | **Contrat de branchement + commit.** `docs/branchements.md` selon le gabarit de l'architecte §6. Commit `feat: coquille du back-office et liste des commandes sur fixtures` | `npm run check` vert ; `git status` propre ; aucun `.env*` dans `git show --stat HEAD` | architecte, mentor (relecture finale) |

## Points de vigilance

- Imports `@/…` partout, y compris depuis les tests et les fichiers copiés par shadcn. `grep -rn "from \"\.\." src` doit rester vide.
- Résultat non stocké : `computeOrderTotalCents(lines);` ne fait rien.
- Gardes : `readSimulationMode` renvoie `null` quand `isDev` est faux, quel que soit `raw` ; la garde de session se lit « autorisé seulement si development ou test ». Vérification finale obligatoire avec `npm run build && npm run start`.
- `"use client"` uniquement dans `nav-main.tsx` et `commandes/error.tsx` (plus les fichiers ui livrés). Ailleurs, c'est un signal à discuter.
- `error.tsx` : prop `retry`, jamais `error.message` à l'écran.
- Next 16 : `searchParams` est une `Promise`. `PageProps` et `LayoutProps` sont globaux, générés par `next dev` ou `npx next typegen`.
- Déplacer `src/app/page.tsx` vers `(dashboard)/page.tsx` : deux fichiers pour la même route font échouer le build.
- `npx shadcn add` peut toucher `globals.css` et créer `src/hooks/use-mobile.ts` : lire le diff. Ne pas réinstaller `button`. Les fichiers du registre arrivent sans point-virgule : `npm run format` juste après.
- Périmètre piste A : aucune `DATABASE_URL` réelle, aucun déploiement, aucun `drizzle-kit generate|migrate|push` avant B1. `.env.local` inutile pendant toute la piste A.
- Jamais `next dev` ailleurs que sur un poste de dev : en mode development tout visiteur est « gestionnaire ».
- Le dépôt est sous OneDrive : tout dump réel posé dans l'arborescence part dans le cloud. Dumps hors OneDrive, `dumps/`, `*.sql`, `*.sql.gz`, `*.dump` dans `.gitignore`.

## Questions à poser au client (à envoyer maintenant)

1. **SGBD** : PostgreSQL confirmé ? Version exacte (`SELECT version();`) ? Hébergé où ?
2. **Accès** : compte SQL lecture seule dédié (`CONNECT`, `USAGE`, `SELECT` uniquement ; ordres `GRANT` prêts dans [jalon-1-spec-backend.md](jalon-1-spec-backend.md)), identifiants par canal sécurisé, IP à autoriser ?
3. **Schéma** : `pg_dump --schema-only` et, si possible, dump anonymisé ou jeu de test ? Documentation, ORM ou migrations côté application ?
4. **Écritures** : quelles modifications le dashboard peut faire (statut, attribution, prix, stock) ? Triggers ou règles côté base ? Accord écrit pour des tables préfixées `dashboard_*` (comptes, audit) ?
5. **Utilisateurs et rôles** : combien de personnes, quels métiers, quels droits ? Une authentification existe-t-elle déjà côté application ?
6. **Volumes** : commandes par jour, produits, clients, livreurs, profondeur d'historique ?
7. **Livraisons** : modélisation actuelle des créneaux, zones, livreurs ; statuts de commande et leur ordre ?
8. **Hébergement du dashboard** : chez le client ou chez nous ? Domaine ?
9. **Vocabulaire** : captures d'écran de l'application FIG, liste des statuts et des créneaux tels que le client les nomme ?

## Parking (ne pas rouvrir avant la fin du jalon en cours)

- Filtres, tri, pagination, page de détail, lien sur les lignes (A2).
- Modes d'affichage livrés le 2026-09-13 : light / dark / fig (`data-theme`, sélecteur dans l'en-tête et sur /connexion, mémorisé en localStorage), fond à deux lueurs, contenu borné à 1400 px, tableaux aérés.
- Passe « micro-animations » à la clôture A2 (demande du 2026-09-13) : niveau 1 en CSS seul via `tw-animate-css` déjà installé (fondu d'entrée des pages, apparition des messages d'action, `transition-colors`), toujours sous `motion-safe:` / `prefers-reduced-motion` ; Motion (`LazyMotion` + `m`, ~6 ko) réservé aux cas que CSS ne couvre pas (réordonnancement de liste, `AnimatePresence`) ; View Transitions de Next 16 exclues tant qu'expérimentales.
- Entrée animée de l'app (demande du 2026-09-13) : pas de splash bloquant sur un outil ouvert plusieurs fois par jour ; à la place, entrée orchestrée de la coquille au premier chargement (< 600 ms, une fois par session via `sessionStorage`, désactivée sous `prefers-reduced-motion`) et animation du logo sur la page de connexion (A7). Décision du 2026-09-13 : pas de splash. Loaders retenus : skeleton embelli (shimmer CSS aux couleurs du thème) pour les pages, barre de progression fine au dégradé de marque en haut pendant les navigations, spinner dans le bouton pour les formulaires, logo animé réservé à la page de connexion (A7).
- Métriques animées (A6) : compteurs qui montent (Motion `animate`), graphiques recharts avec animation d'entrée et de mise à jour au changement de période.
- Menu utilisateur fonctionnel, fil d'Ariane dynamique, lecture du cookie `sidebar_state` dans le layout (A2 ou plus tard).
- Règle ESLint `no-restricted-imports` interdisant `orders.mock` hors façade (modif de config à valider).
- Code HTTP du détail introuvable : `notFound()` sous une frontière `loading.tsx` rend bien `not-found.tsx` mais avec un statut 200 (le shell est déjà envoyé en streaming). Sans effet pour un back-office ; à revoir seulement si un client HTTP dépend du 404.
- Schémas zod des entités pour valider les lignes Drizzle en dev (B3). Test de contrat commun aux implémentations mock et db (B3).
- Variable d'env dédiée à la simulation si un environnement de recette partagé apparaît.
- Tests de composants (Testing Library) : hors stack actuelle.
- Table d'utilisateurs, invitations, réinitialisation de mot de passe (A7+). Journal d'audit (B6).
- Notifications temps réel, impression d'étiquettes et de bons de livraison, export CSV/Excel.
- Mode sombre soigné et identité visuelle FIG. Cartographie des zones et tournées (après A3, si demandé).
- CI GitHub Actions lançant `npm run check`. Alignement version Postgres et éventuel PgBouncer (Q1/Q8).
