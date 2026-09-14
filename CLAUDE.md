# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

Dashboard d'administration réalisé pour un **client réel** : l'application **FIG**, un service de livraison de fruits et légumes. Les données du client sont celles de vraies personnes, une erreur en production a un coût pour son équipe, et l'auteur engage sa responsabilité de sous-traitant. Le périmètre reste celui du produit : pas de sur-architecture, chaque séparation doit avoir un pourquoi en une phrase. Projet indépendant de la boutique personnelle FIG de Zaki (`Taek78/FIG_nextJs`) : ne rien en réutiliser.

Décisions client : la base de données n'existait pas, **le dashboard la crée et la possède** (schéma dans `src/db/schema.ts`, migrations dans `drizzle/`). L'application FIG s'y branchera ensuite (question 14 du backlog, ouverte). Utilisateurs : l'équipe du client, quatre rôles (admin, gestionnaire, lecture, livreur).

État : produit complet et vérifié en mode fixtures et en mode PostgreSQL ; reste ce qui dépend du client (`docs/backlog.md`). Toujours : aucune donnée personnelle réelle sur un poste, aucun déploiement sans les gardes de production, jamais de migration ou de seed vers une base qui n'est pas la nôtre sans l'avoir dit.

Documentation : `README.md` (mise en route), `docs/architecture.md` (arborescence, rôle de chaque couche, flux), `docs/base-de-donnees.md`, `docs/backlog.md`, `docs/glossaire.md` (tout terme nouveau employé avec l'auteur doit y être ajouté), `docs/branchements.md`.

## Mode de travail

L'auteur est un développeur junior autodidacte, francophone, qui progresse vite. Claude code lui-même (demande du 2026-09-13), en expliquant le pourquoi de chaque choix en une ou deux phrases, sans analogies, sans questions de compréhension, sans exercices. Il maîtrise App Router, Server Actions, zod, TypeScript strict, Tailwind ; expliquer brièvement la première fois : shadcn base-nova, `server-only`, `useActionState`, Drizzle, Auth.js, Playwright.

- Claude écrit et maintient **tous les tests** (`dashboard/test/` en miroir de `src/`, `dashboard/e2e/`) à chaque fonctionnalité livrée ou corrigée.
- Vérification rituelle avant de considérer une tâche terminée : `npm run check` ; pour ce qui touche aux écrans, `npm run build` puis `npm run test:e2e`. Signaler les erreurs sans les comptabiliser.
- Le fonctionnement sécurisé et visible passe avant le style, sauf demande ponctuelle.
- **Ne jamais commiter ni pousser sans demande explicite.** Commits conventionnels en français (`feat:`, `fix:`, `docs:`, `chore:`), jamais `.env.local` ni un secret.
- Ne pas installer, supprimer ou mettre à jour une dépendance sans accord. Ne jamais modifier un fichier qui n'a pas été lu.

## Équipe d'agents

Quatre sous-agents en lecture seule dans `.claude/agents/`, orchestrés par `/equipe <demande>` : **tech-lead** (cadre, découpe, arbitre : sécurité > fonctionnement > lisibilité > style), **ui-ux-designer** (écrans shadcn et tokens de `globals.css`), **mentor-reviewer** (relecture pédagogique, lance `npm run check`), **security-backend-architect** (Drizzle, Server Actions, RBAC, zod, Auth.js).

## Structure

Une seule app Next.js dans `dashboard/` ; toutes les commandes npm s'y lancent. Détail complet dans `docs/architecture.md`. L'essentiel :

- `src/domain/<domaine>/` : `types.ts`, `status.ts` ou `category.ts` (`as const` + libellés français), `rules.ts` (pur), `schemas.ts` (zod des **entrées** seulement), `fixtures.ts` (déterministes, sans personne réelle ; pour les commandes et les clients, `scenario.ts` écrit à la main autour du 7 septembre 2026 et `orders/history.ts` génère deux ans d'historique réaliste à graine fixe, la fenêtre du 5 au 9 septembre 2026 restant au scénario ; les tests qui raisonnent sur des valeurs précises importent `scenarioOrders` / `scenarioCustomers`), `source.ts` (contrat). Domaines : `orders` (+ `assignment.ts`, `discount.ts`), `deliveries`, `products`, `customers` (+ `loyalty.ts`), `communities` (lecture seule), `staff` (personnel), `articles`, `metrics`, `engagement`, `auth`.
- `src/data/<domaine>.ts` : façade `server-only`, `selectSource(domaine, mock, db)` par `DATA_SOURCE` ; `<domaine>.mock.ts` (Map seedée, `structuredClone`, latence, `resetXxxMock` hors contrat) ; `<domaine>.db.ts` (Drizzle). Transverses : `session.ts`, `credentials.ts`, `login-attempts.ts`, `security-log.ts`.
- `src/db/` : `schema.ts` (n'importe pas le domaine ; `test/db/schema.test.ts` aligne les enums), `client.ts` (`getDb()`, types `Db`, `DbExecutor`), `mappers.ts` (purs, testés en aller-retour).
- `src/app/(dashboard)/<section>/{page,loading,actions}.tsx` ; `src/components/<domaine>/` ; `src/components/ui/` = shadcn ; `src/lib/` = utilitaires purs.
- `src/auth.ts` (Auth.js, config paresseuse), `src/proxy.ts` (accès par rôle, CSP à nonce), `src/instrumentation.ts` (env au démarrage).
- Règles : la source renvoie des types métier, jamais des lignes Drizzle ; seule la façade importe le mock et l'implémentation db ; les tests importent le mock, `src/domain/**` ou `src/lib/**`, jamais une façade (exception : `test/app/**` neutralise `server-only`, `next/cache`, la session et l'env par `vi.mock`) ; `"use client"` seulement là où un hook ou un error boundary l'exige.

`dashboard/CLAUDE.md` importe `AGENTS.md`, regénéré par `next dev` : le commiter avec le travail en cours.

Git : racine du dépôt = ce dossier, branche `main`, remote `origin` = `Taek78/Dashboard_fig`. Le dossier utilisateur est lui aussi un dépôt git : ne jamais lancer `git` hors de ce dossier. CI : `.github/workflows/ci.yml`, Dependabot hebdomadaire.

## Commandes

```bash
cd dashboard
npm run dev           # next dev (Turbopack), http://localhost:3000 ; exige .env.local (copier .env.example)
npm run check         # typecheck (next typegen puis tsc) + lint + format:check + test, dans cet ordre
npm run build && npm run start
npm run test:e2e      # Playwright (Chromium) contre next start -p 3126 avec ses comptes de test ; build préalable
E2E_DATA_SOURCE=db npm run test:e2e   # la même suite contre la base locale (seeder avec les comptes e2e avant, docs/base-de-donnees.md)
npm run db:generate   # schéma → migration SQL dans drizzle/ (à lire et commiter)
npm run db:migrate    # applique à DATABASE_URL
npm run db:seed       # vide et remplit la base locale (fixtures + comptes de .env.local)
npm run db:studio     # explorer les tables
npm run db:backup     # pg_dump dans %LOCALAPPDATA%\fig-backups ; db:restore -- <fichier>
npx vitest run test/domain/orders     # un dossier ou un fichier
grep -rn 'from "\.\.' src             # doit rester vide (imports relatifs interdits)
```

ESLint doit rester en version 9 (la 10 casse le plugin React de `eslint-config-next`). Prettier avec `prettier-plugin-tailwindcss` ; `drizzle/meta/` ignoré.

## Stack

- **Next.js 16 App Router**, React 19, TypeScript strict. Version à changements cassants : avant d'écrire du code framework, lire le guide dans `dashboard/node_modules/next/dist/docs/`. `PageProps<"/route">` et `LayoutProps` sont générés (`npx next typegen`) ; `searchParams` et `params` sont des `Promise` ; `next/form` pour les formulaires GET ; `proxy.ts` exporte une fonction nommée `proxy`.
- **Tailwind v4** via `@tailwindcss/postcss`, thème dans `src/app/globals.css` (`@theme inline`) : trois modes par `data-theme` (light, dark, fig ; **sombre par défaut**, `DEFAULT_THEME`), tokens oklch, `--success`, `--warning`, `--info`, `--fruit`, `--vegetable`, `--halo-1/2`, dégradé de marque ; le variant `dark:` couvre dark et fig. Jamais de couleur en dur. Utilitaires maison : `bg-gradient-brand`, `text-gradient-brand`, `card-lift` (élévation au survol), `glow-brand` (halo de coin), `skeleton-shimmer`, `page-in` (entrée de page dans `(dashboard)/template.tsx`), `float-soft` ; graphiques recharts chargés à la demande (`components/metrics/charts-lazy.tsx`, `next/dynamic` sans SSR) ; bouton `variant="brand"` pour l'action principale d'un écran ; bordure gauche des cartes de commandes colorée par statut (`STATUS_ACCENT`).
- **shadcn/ui** style `base-nova` (primitives `@base-ui/react`, prop `render` ; un lien rendu par `<Button render>` reçoit `role="button"` : utiliser `<a className={buttonVariants(...)}>` pour un vrai lien). Composants copiés dans `src/components/ui/`, modifiés sur place.
- **Drizzle ORM** + `postgres`. Jamais `db:push` ; jamais `sql.raw()` avec une entrée utilisateur. `drizzle.config.ts` et `scripts/seed.ts` lisent `.env.local` par `process.loadEnvFile`.
- **zod v4** pour les entrées (`z.email()`, `z.iso.date()`, `.catch(undefined)` en lecture tolérante, `superRefine` + `transform` en écriture).
- **Auth.js v5** (`next-auth@beta`) : Credentials, JWT 8 h avec le rôle, `trustHost` déduit d'`AUTH_URL` (obligatoire en production). Mots de passe scrypt (`src/lib/password.ts`).
- **recharts** v3 en composants client ; **Playwright** pour les parcours navigateur.
- **Environnement** (`src/lib/env-schema.ts`) : `DATA_SOURCE=mock|db`, `DATABASE_URL` (db), `AUTH_SECRET` ≥ 32, `AUTH_BOOTSTRAP_EMAIL/PASSWORD/NAME`, `AUTH_MANAGER_*` optionnel ; en production : `AUTH_URL`, `ALLOW_MOCK_IN_PRODUCTION=1` et `AUTH_ALLOW_BOOTSTRAP=1` seulement pour une démo assumée. Jamais `process.env` dans un composant client.

## Conventions

- Imports : toujours l'alias `@/` ; jamais d'import relatif ni `next/dist/…` (erreur la plus fréquente de l'auteur, la relever).
- Montants en centimes entiers (suffixe `Cents`), quantités en grammes ou pièces, dates en chaînes ISO, jours `AAAA-MM-JJ`, heures `HH:mm`.
- Server Actions = frontière de confiance : session → rôle → zod → relecture → règle → écriture → journal → revalidation → `ActionResult`. Jamais confiance aux identifiants, rôles, prix, quantités ou statuts reçus du client.
- Logique pure isolée et testée ; les composants ne font que brancher. Un composant client n'importe jamais un module `schemas.ts` (il embarquerait zod dans le navigateur) : les bornes de saisie vivent dans `types.ts`.
- Listes de valeurs : `XXX as const` + `Record<Xxx, string>` de libellés français ; l'enum Postgres reprend les mêmes clés.
- Responsive : mobile d'abord, priorité au desktop ; sous `md` les listes deviennent des cartes, les formulaires passent en colonne ; chaque écran complet à 400 px sans défilement horizontal.
- Suppressions et annulations confirmées côté serveur (mot `SUPPRIMER`, motif d'annulation).
- Listes longues : la liste des commandes est triée des plus récentes aux plus anciennes et paginée (`paginate`, 40 par page, `?page=`).
- Équipe et remises : chaque commande porte `preparer`, `driver` (affectés par `assignOrderStaff`, liste déroulante qui écrit dès le choix), `community` et `discount` (posés par l'application FIG, jamais par le dashboard ; `totalCents` = lignes − remise). Une personne supprimée libère ses commandes (`SET NULL`) ; préférer `active = false`. La fidélité (`loyaltyStatus`, 8 d'affilée → −15 %) se calcule à partir des commandes, rien n'est stocké.
- Sections : `/personnel` (admin, gestionnaire, lecture), `/clients` en onglets `?type=particuliers|communautes`. Un champ répété (cases à cocher `workDays`) se lit avec `formData.getAll` avant zod.

## Déroulement d'une tâche

1. Inspecter l'état Git et les fichiers concernés ; ne jamais inventer l'état d'un fichier, d'une API ou d'une commande non inspectée.
2. Reformuler l'objectif, présenter diagnostic et plan quand plusieurs lectures sont possibles.
3. Appliquer, tests compris.
4. `npm run check`, build et Playwright si l'écran change, vérification en `next start` si le comportement serveur change.
5. Résumer fichiers modifiés, validations, risques ; mettre à jour docs et glossaire.

## Sécurité

- Ne jamais afficher, journaliser, commiter ou copier un secret ou un mot de passe.
- Ne jamais exécuter de migration, de seed ou de restauration sur une base distante sans confirmation ; présenter le SQL généré et signaler les opérations destructrices.
- Toute action d'administration vérifie authentification et autorisation côté serveur.

## Sources de vérité

En cas de conflit : 1. la demande explicite de l'utilisateur ; 2. la sécurité et l'intégrité des données ; 3. le code et la configuration réellement présents ; 4. la documentation locale de la version installée ; 5. ce fichier.
