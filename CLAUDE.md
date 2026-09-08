# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte

Dashboard d'administration réalisé pour un **client réel** : l'application **FIG**, un service de livraison de fruits et légumes. Ce n'est pas un projet portfolio : les données du client sont celles de vraies personnes, une erreur en production a un coût pour son équipe, et l'auteur engage sa responsabilité de sous-traitant. Les gardes, fixtures inventées, comptes lecture seule et règles RGPD du backlog en découlent. Le périmètre reste celui des jalons : pas de sur-architecture, chaque séparation doit avoir un pourquoi en une phrase. C'est un projet client indépendant, sans aucun lien technique avec la boutique personnelle FIG de Zaki (`Taek78/FIG_nextJs`, en pause) : ne pas réutiliser son code, ne pas supposer de base partagée, partir du métier réel du client. Les conventions ci-dessous sont les habitudes de travail de l'auteur.

Décisions client connues (2026-09-07) :
- L'application FIG du client **existe déjà avec sa base de données**. Le dashboard s'y connecte directement : le schéma n'est pas à inventer mais à **introspecter** (`npx drizzle-kit pull`) puis à respecter. Aucune migration sur cette base sans accord explicite du client.
- Utilisateurs : l'équipe du client. Périmètre par ordre de priorité : gestion des commandes et livraisons, catalogue et stocks, clients et support, métriques et pilotage.

État actuel : scaffold `create-next-app` outillé (voir Stack), sans schéma ni page métier. Plan de travail dans `docs/backlog.md` : piste A « frontend sur fixtures » d'abord (jalon A1 en cours), piste B « branchements base » ensuite. Tant que A7 (auth) n'est pas livré : aucune `DATABASE_URL` réelle sur le poste, aucun déploiement, aucune donnée personnelle dans les fixtures, jamais `next dev` ailleurs que sur un poste de dev.

Glossaire des termes d'architecture pour l'auteur : `docs/glossaire.md`. Tout terme nouveau employé avec lui doit y être ajouté.

## Mode de travail

L'auteur est un développeur junior en formation : Claude joue le rôle du senior qui forme.

- Donner des consignes directes et détaillées, avec le pourquoi de chaque choix technique en une ou deux phrases. **Ne pas écrire le code à sa place** sauf demande explicite (« applique », « fais-le toi-même », « corrige », « fais les commits »).
- **Calibrage (2026-09-08)** : il maîtrise App Router, Server Actions/FormData, cookies serveur, couche pure + Vitest, zod, TypeScript strict, Tailwind. Ne pas réexpliquer ces bases. Pas d'analogies, pas de questions de compréhension, pas d'exercices : il veut avancer vite. Nouveautés à expliquer brièvement la première fois : shadcn base-nova, `server-only`, `loading`/`error.tsx`, groupes de routes, `useActionState`, `searchParams` en `Promise`, Drizzle, Auth.js.
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
- `src/lib/` : utilitaires purs testés (`format`, `simulation`, `navigation`). `src/components/` : coquille et composants métier ; `src/components/ui/` : shadcn.
- Règles : la source renvoie toujours des types métier, jamais des lignes Drizzle ; seul `src/data/<domaine>.ts` importe le mock ; les tests importent le mock ou `src/domain/**`, jamais une façade `server-only` ; `"use client"` seulement là où un hook ou un error boundary l'exige ; `error.tsx` utilise la prop `retry`.

`dashboard/CLAUDE.md` importe `AGENTS.md`, un bloc regénéré par `next dev` à chaque lancement. Le commiter avec le travail en cours plutôt que d'essayer de le retirer.

Git : la racine du dépôt est ce dossier (`Dashboard_fig/`), branche `main`, remote `origin` = `Taek78/Dashboard_fig`. Attention, le dossier utilisateur est lui aussi un dépôt git : une commande `git` lancée hors de ce dossier peut viser le mauvais dépôt.

## Commandes

```bash
cd dashboard
npm run dev           # next dev (Turbopack) sur http://localhost:3000
npm run build         # next build
npm run start         # sert le build de production
npm run check         # typecheck + lint + format:check + test, dans cet ordre
npm run typecheck     # tsc --noEmit
npm run lint          # eslint 9 (flat config, next core-web-vitals + typescript)
npm run format        # prettier --write . (format:check pour vérifier seulement)
npm run test          # vitest run (test:watch pour le mode interactif)
npx vitest run test/domain/orders  # un dossier ou un fichier de test
grep -rn 'from "\.\.' src            # doit rester vide (imports relatifs interdits)
grep -rn "orders.mock" src --include=*.tsx   # doit rester vide (façade contournée)
```

Vérification rituelle avant de considérer une tâche terminée : `npm run check`. ESLint doit rester en version 9 : la 10 casse le plugin React embarqué par `eslint-config-next`.

Tests : Vitest cherche `test/**/*.test.ts` (fonctions pures et fixtures uniquement, pas de rendu de composants), organisés en miroir de `src/`. L'alias `@/` est redéclaré dans `vitest.config.mts` car Vitest ne lit pas le tsconfig. Un test n'importe jamais un module `server-only` (les façades `src/data/*.ts`) : il importe `src/domain/**`, `src/lib/**` ou le mock.

Formatage : Prettier avec `prettier-plugin-tailwindcss` (tri des classes). VS Code formate à la sauvegarde via `.vscode/settings.json` à la racine du workspace ; `.gitattributes` force les fins de ligne LF.

## Stack

- **Next.js 16.3 App Router**, React 19, TypeScript `strict`. Cette version a des changements cassants par rapport aux versions connues. Avant d'écrire du code framework, lire le guide concerné dans `dashboard/node_modules/next/dist/docs/` et respecter les avertissements de dépréciation.
- **Typage des routes** : les layouts utilisent le helper généré `LayoutProps<"/">` (dans `.next/types`, inclus via `tsconfig.json`). Suivre le même modèle pour les nouveaux layouts et pages.
- **Tailwind CSS v4** via `@tailwindcss/postcss`. Pas de `tailwind.config.*` : le thème est dans `src/app/globals.css` avec `@import "tailwindcss"` et `@theme inline`. Ajouter les tokens comme variables CSS puis les mapper dans `@theme inline`.
- **shadcn/ui** (style `base-nova`, primitives `@base-ui/react`, icônes `lucide-react`). Les composants sont copiés dans `src/components/ui/` via `npx shadcn@latest add <nom>` et t'appartiennent : les modifier sur place, ne pas les réinstaller. Le helper `cn()` est dans `src/lib/utils.ts`. Les tokens de couleur shadcn (`--primary`, `--card`…) sont déclarés dans `globals.css` avec le thème clair/sombre.
- **Drizzle ORM** + driver `postgres` (postgres.js). Schéma attendu dans `src/db/schema.ts`, migrations SQL générées dans `drizzle/` via `npx drizzle-kit generate` puis appliquées avec `npx drizzle-kit migrate` ; `npx drizzle-kit studio` pour explorer les données. La base appartient au client : schéma obtenu par `npx drizzle-kit pull`, jamais de `generate`/`migrate`/`push` vers elle sans accord écrit.
- **zod** v4 pour valider les `FormData` dans les Server Actions avant tout accès à la base.
- **Auth.js v5** (`next-auth@beta`) pour l'authentification. Config attendue dans `src/auth.ts`, secret dans `AUTH_SECRET`.
- **recharts** v3 pour les graphiques de métriques (composants client uniquement : `"use client"`).
- **Variables d'environnement** : copier `.env.example` en `.env.local` (ignoré par git). Ne jamais lire `process.env` dans un composant client.
- **Polices** : Geist et Geist Mono chargées dans `src/app/layout.tsx` via `next/font/google`, exposées en `--font-geist-sans` / `--font-geist-mono` et mappées vers `--font-sans` / `--font-mono` dans `globals.css`.

## Conventions

- **Imports** : toujours l'alias `@/` (→ `dashboard/src/`). Jamais d'import relatif, jamais d'import interne `next/dist/…`. C'est l'erreur la plus fréquente de l'auteur, la relever à chaque fois.
- **Montants** en centimes entiers, suffixe `Cents` ; **quantités** en unité de base (grammes ou pièces), sauf si le schéma existant du client impose autre chose : dans ce cas, convertir à la frontière et documenter.
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

## Sources de vérité

En cas de conflit, suivre cet ordre :

1. La demande explicite de l'utilisateur.
2. Les contraintes de sécurité et d'intégrité des données.
3. Le code et la configuration réellement présents.
4. La documentation locale de la version installée.
5. Ce fichier.

Ne jamais inventer l'état d'un fichier, d'une API ou d'une commande non inspectée.

