# FIG Back-office

Dashboard d'administration de **FIG**, une application de livraison de fruits et légumes. L'équipe du client y suit les commandes et la tournée du jour, gère le catalogue, les clients, les articles publiés dans l'application et les comptes, et lit ses métriques d'activité.

Stack : Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4, shadcn/ui, Auth.js v5, Drizzle ORM sur PostgreSQL, Vitest, Playwright.

- [Architecture complète](docs/architecture.md) : arborescence, rôle de chaque dossier et composant, flux de lecture et d'écriture.
- [Base de données](docs/base-de-donnees.md) : mise en route, migrations, seed, sauvegardes, schéma.
- [État du projet et reste à faire](docs/backlog.md) : ce qui est livré, ce qui attend le client.
- [Glossaire](docs/glossaire.md) : les termes techniques employés, en une phrase chacun.
- [Contrat de données](docs/branchements.md) : ce que le front consomme, fonction par fonction.
- [RGPD](docs/rgpd.md) : données personnelles, durées de conservation, réponse aux demandes, violation de données.

## Démarrer en local

Prérequis : Node.js 22, PostgreSQL 16 ou plus (installé sur le poste, ou Docker), Docker pour la base de test.

```bash
cd dashboard
npm install
cp .env.example .env.local        # puis remplir AUTH_SECRET (npx auth secret) et le compte d'amorçage
```

Le dashboard fonctionne toujours sur PostgreSQL ; les données de démonstration sont insérées par le seed. Créer la base (une fois) :

```powershell
# Windows, depuis dashboard/ : crée le rôle fig et la base fig
& "C:\Program Files\PostgreSQL\18\bin\psql.exe" -U postgres -f scripts/setup-local.sql
```

```bash
# .env.local : DATABASE_URL=postgresql://fig:fig@localhost:5432/fig
# (ou sans installation : docker compose up -d db, port 5433)
npm run db:migrate                 # crée les tables
npm run db:seed                    # données de démo et comptes de .env.local
npm run dev                        # http://localhost:3000
```

Les tests utilisent une base jetable à part (Docker, port 5434), qu'ils migrent et seedent eux-mêmes :

```bash
npm run db:test                    # docker compose up -d --wait test-db
npm run check
npm run build && npm run test:e2e
```

Connexion avec le compte d'amorçage de `.env.local` (`AUTH_BOOTSTRAP_EMAIL` / `AUTH_BOOTSTRAP_PASSWORD`). L'administrateur crée ensuite les autres comptes depuis la section **Comptes**.

## Commandes

| Commande                                        | Rôle                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `npm run dev`                                   | serveur de développement (Turbopack)                                  |
| `npm run check`                                 | typecheck, lint, format, tests (base de test) : avant tout commit     |
| `npm run db:test`                               | démarre la base de test jetable (Docker, port 5434)                   |
| `npm run build` puis `npm run start`            | build et serveur de production                                        |
| `npm run test:e2e`                              | parcours navigateur Playwright (après un build)                       |
| `npm run db:generate`                           | génère une migration SQL depuis `src/db/schema.ts`                    |
| `npm run db:migrate`                            | applique les migrations à `DATABASE_URL`                              |
| `npm run db:seed`                               | vide et remplit la base locale avec les données de démo               |
| `npm run db:studio`                             | explore les tables dans le navigateur                                 |
| `npm run db:backup` / `db:restore -- <fichier>` | sauvegarde et restauration (`pg_dump`, base locale)                   |
| `npm run rgpd:purge` (`-- --apply`)             | durées de conservation RGPD : aperçu, puis application                |

## Ce que fait le back-office

| Section         | Fonctions                                                                                                                                                                                                       |
| --------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tableau de bord | alerte en tête si aucun préparateur ou aucun livreur n'est présent, chiffres de la période choisie (aujourd'hui par défaut), montants HT ou TTC, livraisons du jour, commandes en préparation                    |
| Commandes       | liste et tournée en une seule section : recherche par référence, client ou coordonnées, filtres statut, période (une date = ce jour-là, dates inversées signalées), préparateur et livreur avec gommette de présence, raccourcis des 7 derniers jours, cartes paginées avec créneau en grand, appel, itinéraire, affectation en un choix, remises et frais de livraison, adresse, geste suivant ; détail avec historique et notifications déposées pour le client |
| Catalogue       | grille de produits (prix unitaire et au kilo, origine, calibre, saison, bio, statut de vente sur l'image), paramètre « laisser en vente à stock 0 », fiche complète, création, suppression confirmée                                                                                   |
| Articles        | contenus « à lire » de l'application : rédaction, historique, visibilité, modification, suppression                                                                                                             |
| Clients         | recherche commune particuliers et communautés, commutateur de type coloré, tri par critère avec bouton de sens (A / Z, 1 / 9 ; membres pour les communautés), cartes à fond nuancé selon le type, grandes cartes (adresse, autorisations, catégorie basique ou fidèle en étoiles, fidélité) avec bouton vers la fiche, fiche avec parrainage (code, parrain, filleuls), historique daté des statuts, notes internes, historique par période, export et anonymisation RGPD (administrateur) ; remise de communauté déduite du nombre de membres, livraison offerte ; bandeau du type (voisinage, entreprise, point relais) et de la visibilité (public, privé) sur la carte et la fiche d'une communauté |
| Messages        | boîte de réception des demandes « Nous contacter » : recherche, filtres objet, statut, période et importants, épinglés séparés des autres, cartes avec les deux premières lignes et la commande jointe (livraison, préparateur, livreur), dégradé rouge des importants, fiche complète précédée de la fiche client, pièces jointes (photos et PDF), traité / non traité, épingle et drapeau « important » |
| Personnel       | livreurs, préparateurs et gestionnaires : cartes avec modifier, dupliquer et supprimer, fiche modifiable en haut, historique de traitement filtrable                                                            |
| Métriques       | rangées par thème (ventes, commandes, clients, produits, usage), réclamations reçues par messages, nouveaux clients et parrainages, part des commandes de communauté, camemberts pleins avec étiquette au survol, comparaison N-1 ou période précédente |
| Comptes         | gestion des comptes du back-office (administrateur) ; chacun change son mot de passe sur son profil                                                                                                             |

Quatre rôles : administrateur, gestionnaire, lecture seule, livreur (ne voit que les commandes, qui servent de tournée). Partout, le nom d'un client est un lien vers sa fiche ; une recherche par dates sans résultat le dit dans un bandeau bleu.

## Sécurité, en bref

Authentification par e-mail et mot de passe (scrypt), session JWT de 8 heures, limitation de débit sur la connexion, autorisation vérifiée côté serveur pour chaque écran et chaque écriture, Content-Security-Policy avec nonce, journal de sécurité en base, gardes de démarrage en production. Données personnelles : export et anonymisation d'un client, durées de conservation appliquées par script ([docs/rgpd.md](docs/rgpd.md)). Détail dans [docs/architecture.md](docs/architecture.md#sécurité).

## Vérification

Chaque tâche se termine par `npm run check` (règles pures, puis couche données et Server Actions sur la base de test) et, pour ce qui touche aux écrans, `npm run build && npm run test:e2e`. La CI GitHub Actions rejoue les deux contre un PostgreSQL de service.
