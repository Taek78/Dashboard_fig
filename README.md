# FIG Back-office

Dashboard d'administration de **FIG**, une application de livraison de fruits et légumes. L'équipe du client y suit les commandes et la tournée du jour, gère le catalogue, les clients, les articles publiés dans l'application et les comptes, et lit ses métriques d'activité.

Stack : Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Auth.js v5, Drizzle ORM sur PostgreSQL, Vitest, Playwright.

- [Architecture complète](docs/architecture.md) : arborescence, rôle de chaque dossier et composant, flux de lecture et d'écriture.
- [Base de données](docs/base-de-donnees.md) : mise en route, migrations, seed, sauvegardes, schéma.
- [État du projet et reste à faire](docs/backlog.md) : ce qui est livré, ce qui attend le client.
- [Glossaire](docs/glossaire.md) : les termes techniques employés, en une phrase chacun.
- [Contrat de données](docs/branchements.md) : ce que le front consomme, fonction par fonction.

## Démarrer en local

Prérequis : Node.js 22, PostgreSQL 16 ou plus (installé sur le poste, ou Docker).

```bash
cd dashboard
npm install
cp .env.example .env.local        # puis remplir AUTH_SECRET (npx auth secret) et le compte d'amorçage
```

Sans base, tout fonctionne sur des données factices :

```bash
# .env.local : DATA_SOURCE=mock
npm run dev                        # http://localhost:3000
```

Avec PostgreSQL (une fois) :

```powershell
# Windows, depuis dashboard/ : crée le rôle fig et la base fig
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f scripts/setup-local.sql
```

```bash
# .env.local : DATA_SOURCE=db et DATABASE_URL=postgresql://fig:fig@localhost:5432/fig
npm run db:migrate                 # crée les tables
npm run db:seed                    # données de démo et comptes de .env.local
npm run dev
```

Connexion avec le compte d'amorçage de `.env.local` (`AUTH_BOOTSTRAP_EMAIL` / `AUTH_BOOTSTRAP_PASSWORD`). L'administrateur crée ensuite les autres comptes depuis la section **Comptes**.

## Commandes

| Commande                                        | Rôle                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                                   | serveur de développement (Turbopack)                                  |
| `npm run check`                                 | typecheck, lint, format, tests unitaires : à lancer avant tout commit |
| `npm run build` puis `npm run start`            | build et serveur de production                                        |
| `npm run test:e2e`                              | parcours navigateur Playwright (après un build)                       |
| `npm run db:generate`                           | génère une migration SQL depuis `src/db/schema.ts`                    |
| `npm run db:migrate`                            | applique les migrations à `DATABASE_URL`                              |
| `npm run db:seed`                               | vide et remplit la base locale avec les données de démo               |
| `npm run db:studio`                             | explore les tables dans le navigateur                                 |
| `npm run db:backup` / `db:restore -- <fichier>` | sauvegarde et restauration (`pg_dump`, base locale)                   |

## Ce que fait le back-office

| Section         | Fonctions                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Tableau de bord | chiffres de la période choisie (aujourd'hui par défaut), montants HT ou TTC, commandes à confirmer                            |
| Commandes       | cartes filtrables et paginées, préparateur et livreur affectés en un choix, remises affichées, détail avec historique         |
| Livraisons      | tournée du jour : ordre de passage, prochaine livraison, appel et itinéraire en un geste, statut en un bouton                 |
| Catalogue       | grille de produits (prix unitaire et au kilo, origine, calibre, saison, bio), fiche complète, création, suppression confirmée |
| Articles        | contenus « à lire » de l'application : rédaction, historique, visibilité, modification, suppression                           |
| Clients         | particuliers (recherche, fiche, fidélité, notes internes) et communautés (point de retrait, remise, membres, commandes)       |
| Personnel       | livreurs, préparateurs de commandes et gestionnaires : fiches complètes, disponibilité, historique de traitement              |
| Métriques       | chiffre d'affaires, panier moyen, annulations, comparaison N-1 ou période précédente, usage de l'application                  |
| Comptes         | gestion des comptes du back-office (administrateur) ; chacun change son mot de passe sur son profil                           |

Quatre rôles : administrateur, gestionnaire, lecture seule, livreur (ne voit que la tournée et les commandes).

## Sécurité, en bref

Authentification par e-mail et mot de passe (scrypt), session JWT de 8 heures, limitation de débit sur la connexion, autorisation vérifiée côté serveur pour chaque écran et chaque écriture, Content-Security-Policy avec nonce, journal de sécurité en base, gardes de démarrage en production. Détail dans [docs/architecture.md](docs/architecture.md#sécurité).

## Vérification

Chaque tâche se termine par `npm run check` (unitaires) et, pour ce qui touche aux écrans, `npm run build && npm run test:e2e`. La CI GitHub Actions rejoue les deux, sur données factices puis contre un PostgreSQL de service.
