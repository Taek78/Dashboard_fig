# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

Dashboard d'administration réalisé pour un **client réel** : l'application **FIG**, un service de livraison de fruits et légumes. Ce n'est pas un projet portfolio : les données du client sont celles de vraies personnes, une erreur en production a un coût pour son équipe, et l'auteur engage sa responsabilité de sous-traitant. Les gardes, fixtures inventées, comptes lecture seule et règles RGPD du backlog en découlent. Le périmètre reste celui des jalons : pas de sur-architecture, chaque séparation doit avoir un pourquoi en une phrase. C'est un projet client indépendant, sans aucun lien technique avec la boutique personnelle FIG de Zaki (`Taek78/FIG_nextJs`, en pause) : ne pas réutiliser son code, ne pas supposer de base partagée, partir du métier réel du client. Les conventions ci-dessous sont les habitudes de travail de l'auteur.

Décisions client connues (2026-09-07) :

- **Revirement du 2026-09-14** : la base n'existe pas, **le client demande au dashboard de la créer**. Le schéma est conçu ici (`src/db/schema.ts`), versionné par migrations (`drizzle/`), appliqué et rempli en local (`npm run db:migrate`, `npm run db:seed`) ; l'application FIG s'y branchera ensuite (question au client : API ou lecture directe). Guide : `docs/base-de-donnees.md`. Les règles « jamais de migration vers une base qui n'est pas la nôtre sans accord » et « aucune donnée personnelle réelle sur un poste de dev » restent.
- Utilisateurs : l'équipe du client. Périmètre par ordre de priorité : gestion des commandes et livraisons, catalogue et stocks, clients et support, métriques et pilotage.

État actuel (2026-09-14) : **pistes B2 à B4 livrées** : schéma, migration initiale appliquée à la base locale (PostgreSQL 18 du poste, rôle et base `fig`), seed, sources Drizzle pour les six domaines, mappers testés ; tous les écrans et la suite Playwright vérifiés en `DATA_SOURCE=db`. Le `.env.local` du poste est en mode `db` ; `mock` reste disponible. La CI rejoue la suite navigateur en mock puis contre un Postgres de service. Livré aussi le 2026-09-14 : gestion des comptes (`/comptes`, admin) et profil (`/profil`, mot de passe), CSP avec nonce par requête, journal de sécurité en table `security_events`, sauvegarde/restauration (`db:backup`, `db:restore`). Suite : B5 (branchement de l'application FIG, question 14) et B6 (mise en ligne). Avant cela : **piste A livrée en entier (A1 à A7)** et **B1** : commandes, livraisons, catalogue, clients, métriques, tableau de bord, authentification Auth.js (Credentials, compte d'amorçage par env), socle base (compose.yaml, `getDb()`, `/api/health`, `DATA_SOURCE`). Tout tourne sur fixtures (`DATA_SOURCE=mock`). Détail : `docs/a3-b1-livraison.md`. Ajouts du 2026-09-13 : période choisie sur le tableau de bord (défaut aujourd'hui, `PeriodForm` partagé avec les métriques) et section **Articles** (`/articles`, rédaction, historique, modification, visibilité, suppression). **B2 à B6 bloqués** tant que le client n'a pas répondu aux 9 questions du backlog (accès lecture seule, schéma, accord écrit). Toujours : aucune `DATABASE_URL` du client sur un poste, aucun déploiement, aucune donnée personnelle dans les fixtures.

Glossaire des termes d'architecture pour l'auteur : `docs/glossaire.md`. Tout terme nouveau employé avec lui doit y être ajouté.

## Mode de travail

L'auteur est un développeur junior en formation : Claude joue le rôle du senior qui forme.

- Donner des consignes directes et détaillées, avec le pourquoi de chaque choix technique en une ou deux phrases. **Ne pas écrire le code à sa place** sauf demande explicite (« applique », « fais-le toi-même », « corrige », « fais les commits »).
- **Calibrage (2026-09-08)** : il maîtrise App Router, Server Actions/FormData, cookies serveur, couche pure + Vitest, zod, TypeScript strict, Tailwind. Ne pas réexpliquer ces bases. Pas d'analogies, pas de questions de compréhension, pas d'exercices : il veut avancer vite. Nouveautés à expliquer brièvement la première fois : shadcn base-nova, `server-only`, `loading`/`error.tsx`, groupes de routes, `useActionState`, `searchParams` en `Promise`, Drizzle, Auth.js.
- **Mode depuis le 2026-09-13** : à la demande de l'auteur, Claude code lui-même les jalons (A2.3 à A2.8 livrés ainsi). Les consignes restent rédigées pour qu'il puisse suivre et reprendre la main ; tests, vérifications et rapport pédagogique court inchangés.
- **Format des consignes (demande du 2026-09-13)** : chaque étape est une liste numérotée d'instructions d'implémentation (« créer une `Map<string, Order>` », « déclarer `seed(): void` dont le corps fait `store.clear()` puis une boucle… »), chacune suivie d'une phrase sur ce que fait la ligne et pourquoi. Pas de paragraphe de synthèse à traduire soi-même en code. Modèle : `docs/a2-consignes.md` à partir de A2.3.
- Vérifier systématiquement ses corrections avec les commandes ci-dessous et signaler les erreurs sans les comptabiliser.
- **Tests (décision du 2026-09-08)** : l'auteur n'écrit pas de tests pour l'instant, il avance sur les fonctionnalités. Claude écrit et maintient les tests dans `dashboard/test/`, en miroir de `src/` (`test/domain/orders/rules.test.ts` teste `src/domain/orders/rules.ts`), à chaque fonctionnalité livrée ou corrigée.
- Le fonctionnement sécurisé et visible passe avant le style, sauf demande ponctuelle.
- Ne pas commiter ni pousser sans demande explicite.

## Équipe d'agents

Quatre sous-agents projet vivent dans `.claude/agents/`, orchestrés par la commande `/equipe <demande>` (`.claude/skills/equipe/SKILL.md`). Tous sont en lecture seule (Read, Grep, Glob, Bash) : ils cadrent, conçoivent, relisent et expliquent, le développeur code.

- **tech-lead** : le chef. Toujours consulté en premier, il cadre, découpe en étapes vérifiables, désigne les spécialistes et arbitre (sécurité > fonctionnement > lisibilité > style).
- **ui-ux-designer** : spécifications d'écrans à base de shadcn/ui et des tokens de `globals.css`, avec états, responsive, accessibilité et textes français.
- **mentor-reviewer** : relecture et explications pédagogiques pour un débutant, un concept à la fois, toujours avec le pourquoi, jamais de décompte des erreurs. Lance `npm run check` pour s'appuyer sur des faits.
- **security-backend-architect** : modèle de données Drizzle, frontière de confiance des Server Actions, RBAC, zod, Auth.js, audit avec scénario d'attaque et gravité.

Pour une demande qui ne concerne qu'un seul domaine, on peut appeler l'agent directement, mais `/equipe` reste la voie normale.

## Structure

Le workspace `Dashboard_fig/` contient une seule app Next.js dans `dashboard/`. Toutes les commandes npm se lancent depuis `dashboard/`, pas depuis la racine.

Architecture applicative (détail et justifications dans `docs/backlog.md`) :

- `src/domain/<domaine>/` : types métier en TypeScript simple, `XXX_STATUSES as const` dans `status.ts` (clés anglaises, libellés français), règles pures, schémas zod des **entrées** seulement (`FormData`, `searchParams`), contrat `XxxSource`, fixtures déterministes. Tests correspondants dans `test/domain/<domaine>/`.
- `src/data/<domaine>.mock.ts` (implémentation fixtures) et `<domaine>.db.ts` (Drizzle, piste B) satisfont le contrat ; `src/data/<domaine>.ts` est la **façade** (`import "server-only"` ligne 1, `const source: XxxSource = xxxMock`) et le seul module que le front importe. `src/data/session.ts` : `getCurrentUser()` mock qui lève hors `development`/`test`, remplacé par `verifySession()` en A7.
- Annulation (2026-09-14) : motif obligatoire (`src/domain/orders/cancellation.ts` : stock, livraison, autre + précision ≤ 100 caractères), exigé par `changeStatusSchema`, stocké sur la commande et dans l'événement, saisi par `CancellationFields` (cartes `OrderActions`, fiche `OrderStatusForm`). Les listes de commandes (`/commandes`, accueil) sont des cartes `OrderCard` avec les mêmes actions que la tournée ; la fiche client garde le tableau.
- Historique des commandes (2026-09-14) : `OrderEvent` (qui, quand, de quel statut à quel statut) écrit par `updateOrderStatus(id, from, to, actor)` dans la même opération que le statut, relu par `getOrderEvents`, affiché sur la fiche commande. Comptes : admin d'amorçage plus un gestionnaire optionnel (`AUTH_MANAGER_*`).
- Domaines existants : `orders`, `deliveries` (règles pures de tournée : compteurs, prochaine étape `nextDeliveryStep`, prochain arrêt, lien d'itinéraire ; l'attribution de livreur a été retirée le 2026-09-13), `products`, `customers`, `metrics` (agrégations pures : TVA HT/TTC avec **HT par défaut** partout via `DEFAULT_TAX_MODE`, interrupteur `TaxModeSwitch` partagé, périodes, séries, comparaison N-1 ou période précédente), `engagement` (usage de l'appli par mois : téléchargements, inscriptions, réclamations, note), `articles` (contenus « à lire » de l'appli : conseil, recette, science, actualité ; corps en texte brut, parution datée, visible/masqué), `auth` (rôles, `UserAccount`, `loginSchema`). Chaque domaine métier a sa façade `src/data/<domaine>.ts` qui appelle `selectSource(domaine, mock, db | null)` (B1) : `DATA_SOURCE=db` sans implémentation Drizzle lève une erreur explicite.
- `src/db/` : `schema.ts` (tables, enums, contraintes), `mappers.ts` (purs), `client.ts` (`getDb()`, types `Db` et `DbExecutor` pour les transactions). Chaque domaine a son `src/data/<domaine>.db.ts` branché dans la façade par `selectSource`.
- `src/lib/` : utilitaires purs testés (`format`, `simulation`, `navigation`, `text`, `env-schema`, `password`, `action-result`) ; `env.ts` (`getEnv()` paresseux, server-only) ; `dal.ts` (`verifySession()`). `src/components/` : coquille et composants métier par domaine ; `src/components/ui/` : shadcn.
- Auth (A7) : `src/auth.ts` (config Auth.js paresseuse), `src/proxy.ts` (redirige les anonymes vers `/connexion`), `src/app/connexion/`, `src/data/session.ts` → `verifySession()`. Base (B1) : `src/db/client.ts` (`getDb()`), `src/db/schema.ts` (vide jusqu'à `drizzle-kit pull`), `src/app/api/health/route.ts`, `src/instrumentation.ts` (validation de l'env au démarrage), `compose.yaml`.
- Règles : la source renvoie toujours des types métier, jamais des lignes Drizzle ; seul `src/data/<domaine>.ts` importe le mock ; les tests importent le mock ou `src/domain/**`, jamais une façade `server-only` ; `"use client"` seulement là où un hook ou un error boundary l'exige ; `error.tsx` utilise la prop `retry`.

`dashboard/CLAUDE.md` importe `AGENTS.md`, un bloc regénéré par `next dev` à chaque lancement. Le commiter avec le travail en cours plutôt que d'essayer de le retirer.

Git : la racine du dépôt est ce dossier (`Dashboard_fig/`), branche `main`, remote `origin` = `Taek78/Dashboard_fig`. CI : `.github/workflows/ci.yml` lance `npm run check` puis `npm audit --omit=dev` à chaque push et PR ; `.github/dependabot.yml` ouvre les PR de mise à jour hebdomadaires. Attention, le dossier utilisateur est lui aussi un dépôt git : une commande `git` lancée hors de ce dossier peut viser le mauvais dépôt.

## Commandes

```bash
cd dashboard
npm run dev           # next dev (Turbopack) sur http://localhost:3000 ; exige .env.local (copier .env.example)
npm run db:generate   # schéma src/db/schema.ts → migration SQL dans drizzle/ (à lire et commiter)
npm run db:migrate    # applique les migrations à DATABASE_URL (base locale)
npm run db:seed       # vide et remplit la base locale avec les fixtures et les comptes de .env.local
npm run db:studio     # explorer les tables
npm run db:backup     # pg_dump (format custom) dans %LOCALAPPDATA%\fig-backups ; db:restore -- <fichier> pour restaurer (base locale)
docker compose up -d  # Postgres Docker de secours, 127.0.0.1:5433 (PostgreSQL 18 installé occupe 5432)
npm run build         # next build
npm run start         # sert le build de production
npm run check         # typecheck + lint + format:check + test, dans cet ordre
npm run typecheck     # tsc --noEmit
npm run lint          # eslint 9 (flat config, next core-web-vitals + typescript)
npm run format        # prettier --write . (format:check pour vérifier seulement)
npm run test          # vitest run (test:watch pour le mode interactif)
npx vitest run test/domain/orders  # un dossier ou un fichier de test
npm run build && npm run test:e2e  # Playwright (e2e/, Chromium) : démarre next start -p 3126 avec des comptes de test
grep -rn 'from "\.\.' src            # doit rester vide (imports relatifs interdits)
grep -rn "orders.mock" src --include=*.tsx   # doit rester vide (façade contournée)
```

Vérification rituelle avant de considérer une tâche terminée : `npm run check`. ESLint doit rester en version 9 : la 10 casse le plugin React embarqué par `eslint-config-next`.

Tests : Vitest cherche `test/**/*.test.ts` (fonctions pures et fixtures uniquement, pas de rendu de composants), organisés en miroir de `src/`. Les parcours navigateur (connexion, statut, tournée, article) sont dans `e2e/*.spec.ts` (Playwright, `playwright.config.ts` : serveur de production sur 3126 avec ses propres comptes et secret de test, jamais ceux de `.env.local`) ; ils exigent un `npm run build` préalable et tournent dans la CI. L'alias `@/` est redéclaré dans `vitest.config.mts` car Vitest ne lit pas le tsconfig. Un test n'importe jamais un module `server-only` (les façades `src/data/*.ts`) : il importe `src/domain/**`, `src/lib/**` ou le mock. Exception encadrée : `test/app/**` teste les Server Actions de bout en bout en neutralisant `server-only` et `next/cache` avec `vi.mock` en tête de fichier (voir `test/app/commandes/actions.test.ts`).

Formatage : Prettier avec `prettier-plugin-tailwindcss` (tri des classes). VS Code formate à la sauvegarde via `.vscode/settings.json` à la racine du workspace ; `.gitattributes` force les fins de ligne LF.

## Stack

- **Next.js 16.3 App Router**, React 19, TypeScript `strict`. Cette version a des changements cassants par rapport aux versions connues. Avant d'écrire du code framework, lire le guide concerné dans `dashboard/node_modules/next/dist/docs/` et respecter les avertissements de dépréciation.
- **Typage des routes** : les layouts utilisent le helper généré `LayoutProps<"/">` (dans `.next/types`, inclus via `tsconfig.json`). Suivre le même modèle pour les nouveaux layouts et pages.
- **Tailwind CSS v4** via `@tailwindcss/postcss`. Pas de `tailwind.config.*` : le thème est dans `src/app/globals.css` avec `@import "tailwindcss"` et `@theme inline`. Ajouter les tokens comme variables CSS puis les mapper dans `@theme inline`.
- **shadcn/ui** (style `base-nova`, primitives `@base-ui/react`, icônes `lucide-react`). Les composants sont copiés dans `src/components/ui/` via `npx shadcn@latest add <nom>` et t'appartiennent : les modifier sur place, ne pas les réinstaller. Le helper `cn()` est dans `src/lib/utils.ts`. Les tokens de couleur shadcn (`--primary`, `--card`…) sont déclarés dans `globals.css` avec le thème clair/sombre.
- **Drizzle ORM** + driver `postgres` (postgres.js). Schéma dans `src/db/schema.ts` (enums Postgres identiques aux constantes du domaine, vérifié par `test/db/schema.test.ts` ; le schéma n'importe pas le domaine pour rester chargeable par drizzle-kit), migrations SQL dans `drizzle/`, mappers purs dans `src/db/mappers.ts` (seul lieu de conversion lignes → types métier, testés en aller-retour sur les fixtures), implémentations `src/data/<domaine>.db.ts` (`server-only`, `getDb()`), seed `scripts/seed.ts` (tsx, base locale seulement). `drizzle.config.ts` et le seed lisent `.env.local` via `process.loadEnvFile`. Jamais `db:push` ; jamais `sql.raw()` avec une entrée utilisateur.
- **zod** v4 pour valider les `FormData` dans les Server Actions avant tout accès à la base.
- **Auth.js v5** (`next-auth@beta`) : `src/auth.ts` (Credentials, JWT 8 h, rôle dans le jeton, `callbacks.authorized` pour le proxy), `src/proxy.ts` (fonction `proxy` nommée : `auth` est asynchrone avec une config paresseuse, `auth(fn)` ne convient pas), `src/lib/dal.ts`. Mots de passe hachés par scrypt (`src/lib/password.ts`), aucun compte en dur : compte d'amorçage par env, comptes en base en piste B.
- **recharts** v3 pour les graphiques de métriques (composants client uniquement : `"use client"`).
- **Variables d'environnement** : copier `.env.example` en `.env.local` (ignoré par git) : `DATA_SOURCE=mock|db`, `AUTH_SECRET` (≥ 32, `npx auth secret`), `AUTH_BOOTSTRAP_EMAIL/PASSWORD/NAME` (compte admin d'amorçage), `DATABASE_URL` en mode db. Validées par `src/lib/env-schema.ts` (pur, testé) via `getEnv()` ; une variable manquante fait échouer le démarrage (`instrumentation.ts`). Ne jamais lire `process.env` dans un composant client.
- **Polices** : Plus Jakarta Sans (texte et titres) et Geist Mono chargées dans `src/app/layout.tsx` via `next/font/google`, exposées en `--font-plus-jakarta` / `--font-geist-mono` et mappées vers `--font-sans` / `--font-mono` dans `globals.css`.
- **Thème** : trois modes par `data-theme` sur `<html>` (`light`, `dark`, `fig` : aubergine, rose figue, vert feuille), tokens oklch uniquement dans `globals.css`, plus `--success`, `--warning`, `--info` (neutre, bleu), `--halo-1/2` (lueurs du fond) et le dégradé de marque `--brand-from` / `--brand-to` (`bg-gradient-brand`, `text-gradient-brand`). Le variant `dark:` s'applique en dark et en fig. Choix mémorisé dans localStorage (`src/lib/theme.ts`, script inline anti-flash dans `layout.tsx`, sélecteur `src/components/theme-toggle.tsx`). Jamais de couleur en dur dans un composant. Sidebar en `variant="inset"`, contenu borné à 1400 px avec marges généreuses.
- **Coquille et responsive (2026-09-13)** : `site-header.tsx` reçoit l'utilisateur de la session (marque sur mobile, fil d'Ariane `site-breadcrumb.tsx` alimenté par `breadcrumbFor()` pur, sélecteur de mode, initiales via `initials()`). Points de rupture : sous `md` (768 px) les listes (`OrdersTable`, `CustomersTable`) rendent une pile de cartes et le tableau est masqué, les formulaires passent en colonne avec boutons pleine largeur ; `lg` (1024 px) rend les colonnes secondaires des tableaux ; les squelettes `loading.tsx` reproduisent les deux rendus. Priorité au desktop, mais chaque écran doit rester complet à 400 px sans défilement horizontal.

## Conventions

- **Imports** : toujours l'alias `@/` (→ `dashboard/src/`). Jamais d'import relatif, jamais d'import interne `next/dist/…`. C'est l'erreur la plus fréquente de l'auteur, la relever à chaque fois.
- **Montants** en centimes entiers, suffixe `Cents` ; **quantités** en unité de base (grammes ou pièces), sauf si le schéma existant du client impose autre chose : dans ce cas, convertir à la frontière et documenter.
- **Catalogue** : `Product` complet (variété, contenant, origine, calibre, bio, saison, visible, disponible, illustration emoji ou `imageUrl` https) ; le prix au kilo d'une pièce se déduit de `unitWeightGrams`, jamais stocké en double. Suppression = mot `SUPPRIMER` exigé par zod côté serveur. Couleurs de catégorie par tokens `--fruit` / `--vegetable`, drapeau France par l'utilitaire `flag-fr`.
- **Server Actions** = frontière de confiance : toute validation métier se fait côté serveur, jamais uniquement dans le composant.
- **Logique pure** isolée dans des fonctions testables, sans dépendance à Next ; les composants ne font que brancher.
- **Commits** conventionnels en français (`feat:`, `fix:`, `docs:`, `chore:`…).
- Pièges déjà rencontrés à surveiller : résultat d'une fonction pure non stocké, gardes inversées.

## Déroulement d'une tâche

Sauf demande explicite d'application immédiate :

1. Inspecter l'état Git et les fichiers concernés.
2. Reformuler brièvement l'objectif.
3. Présenter le diagnostic et le plan.
4. Attendre la validation.
5. Appliquer uniquement les changements validés.
6. Exécuter `npm run check`.
7. Résumer les fichiers modifiés, les validations et les éventuels risques.

Ne jamais modifier un fichier qui n'a pas été lu.
Ne pas étendre le périmètre pour effectuer du refactoring opportuniste.
Ne pas installer, supprimer ou mettre à jour une dépendance sans accord.

## Sécurité

- Ne jamais afficher, journaliser, commiter ou copier les secrets.
- Ne jamais exécuter de migration sur une base distante sans confirmation.
- Avant une migration, présenter le SQL généré et signaler les opérations
  destructrices ou irréversibles.
- Toute action d'administration doit vérifier l'authentification et
  l'autorisation côté serveur.
- Ne jamais faire confiance aux identifiants, rôles, prix ou quantités reçus
  depuis le client.
- **Comptes (2026-09-14)** : `UsersSource` complet (liste, création, nom/rôle, activation, mot de passe), règles pures `wouldRemoveLastAdmin` (jamais retirer le dernier admin actif) et refus de se désactiver soi-même, droit `canManageUsers` (admin), sections `/comptes` (admin) et `/profil` (tous). Mots de passe hachés par l'action, jamais journalisés.
- **Audit du 2026-09-14, en place** : limitation de débit sur la connexion (`src/lib/rate-limit.ts` pur, état dans `src/data/login-attempts.ts`, par e-mail et par IP, verrou progressif), coût constant e-mail inconnu / mot de passe faux (`dummyPasswordHash`), journal de sécurité JSON sur la sortie standard et, en mode db, en table `security_events` (`src/data/security-log.ts` écrit, `src/lib/security-log.ts` formate ; connexions, verrous, refus, changements de statut, suppressions, comptes ; jamais de secret), en-têtes HTTP dans `next.config.ts` et CSP à nonce par requête posée par `src/proxy.ts` (`src/lib/csp.ts` : `script-src 'nonce-…' 'strict-dynamic'`, sans `'unsafe-inline'` ; le nonce est lu par le layout racine via l'en-tête `x-nonce`), matrice de lecture par rôle (`SECTION_ACCESS`, `canViewSection`) appliquée par `src/proxy.ts` et par la navigation, gardes de production dans `env-schema.ts` (`AUTH_URL` obligatoire, `ALLOW_MOCK_IN_PRODUCTION`, `AUTH_ALLOW_BOOTSTRAP`). Quatre rôles : admin, gestionnaire, lecture, livreur (provisoire, Q5).
- Avec Drizzle (piste B) : toujours le constructeur de requêtes, jamais `sql.raw()` avec une entrée utilisateur ; utilisateur de base à privilèges réduits et TLS vers Postgres.

## Sources de vérité

En cas de conflit, suivre cet ordre :

1. La demande explicite de l'utilisateur.
2. Les contraintes de sécurité et d'intégrité des données.
3. Le code et la configuration réellement présents.
4. La documentation locale de la version installée.
5. Ce fichier.

Ne jamais inventer l'état d'un fichier, d'une API ou d'une commande non inspectée.
