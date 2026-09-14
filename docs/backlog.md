# État du projet et reste à faire

Dernière mise à jour : 2026-09-14.

## Livré

- **Écrans** : tableau de bord (période et HT/TTC), commandes (cartes, détail, historique des statuts, annulation avec motif, affectation d'un préparateur et d'un livreur, remises affichées), livraisons (tournée de terrain, livreur affecté), catalogue (grille avec modifier / dupliquer / supprimer, fiche, création, suppression confirmée), articles, clients (particuliers avec série de fidélité, communautés avec remise, fiches, notes), personnel (livreurs, préparateurs, gestionnaires : fiches complètes, disponibilité, historique de traitement), métriques (KPI, tendances, comparaison N-1, usage de l'appli), comptes (admin), profil.
- **Données** : domaine pur par section, façades avec deux implémentations (fixtures en mémoire, PostgreSQL via Drizzle), schéma et migrations possédés par le dashboard, seed, sauvegardes.
- **Sécurité** : Auth.js Credentials, rôles et matrice d'accès en lecture et en écriture, limitation de débit, CSP à nonce, journal de sécurité en base, gardes de production.
- **Qualité** : 429 tests Vitest, 18 parcours Playwright, CI (check, audit, Playwright en mock puis contre PostgreSQL).

## Reste à faire

### Dépend du client

| #   | Sujet                                                                            | Ce qui bloque                              |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------ |
| 1   | Branchement de l'application FIG à la base (question 14)                         | choix API du dashboard ou accès SQL direct |
| 2   | Validation du vocabulaire (statuts, créneaux, catégories) et des rôles (livreur) | questions 5 et 9                           |
| 3   | TVA : base et taux des montants (hypothèse : TTC à 5,5 %)                        | question 10                                |
| 4   | Adresse de livraison complète pour l'itinéraire, instructions d'accès            | question 13                                |
| 5   | Source des statistiques d'usage (stores, support)                                | question 11                                |
| 6   | Hébergement du dashboard et de PostgreSQL, nom de domaine                        | question 8                                 |

### Peut se faire sans le client

- Mise en ligne : rôle PostgreSQL applicatif à privilèges réduits, TLS vers la base, secrets par l'hébergeur, `serverActions.allowedOrigins` derrière un proxy inverse, sauvegardes automatiques, surveillance de `/api/health`.
- Limitation de débit partagée (base ou cache) si plusieurs instances.
- Rotation et révocation de session côté serveur.
- Recherche catalogue et clients en SQL (`pg_trgm`) si les tables grossissent.
- Téléversement d'images produit et article (stockage à définir).
- Export CSV, impression de bons de livraison, notifications.

## Questions à poser au client

1. **SGBD et hébergement de la base** : PostgreSQL chez qui ? Version ?
2. **Accès** : qui administre la base en production ? Sauvegardes ?
3. **Schéma** : la base est créée par le dashboard (`src/db/schema.ts`) ; le client valide-t-il ce modèle ?
4. **Écritures** : l'application FIG écrit-elle directement dans ces tables ou par une API ?
5. **Utilisateurs et rôles** : combien de personnes, quels métiers ? Le rôle « livreur » (tournée et commandes seulement) convient-il ?
6. **Volumes** : commandes par jour, produits, clients, profondeur d'historique ?
7. **Livraisons** : créneaux, zones ; statuts de commande et leur ordre ?
8. **Hébergement du dashboard** : chez le client ou chez nous ? Domaine ?
9. **Vocabulaire** : captures d'écran de l'application, noms des statuts et des créneaux tels que le client les emploie.
10. **TVA** : montants TTC ou HT ? Taux (5,5 %, 20 % sur certains produits) ?
11. **Usage de l'appli** : d'où viennent téléchargements, inscriptions, réclamations, notes ? Export mensuel ou API ?
12. **Articles** : l'application affiche-t-elle déjà des articles ? Format du texte, images, planification ?
13. **Adresse de livraison** : rue, coordonnées GPS, instructions d'accès ?
14. **Branchement de l'application FIG** : API HTTP exposée par le dashboard (recommandé : un seul propriétaire du schéma) ou accès SQL direct avec un rôle dédié ?
15. **Communautés** : l'application crée-t-elle les communautés et l'adhésion des clients (hypothèse actuelle : le dashboard les lit, ne les modifie pas) ? Faut-il pouvoir en créer ou en modifier la remise depuis le back-office ?
16. **Fidélité** : « huit commandes d'affilée » se compte-t-il comme ici (une annulation remet à zéro, la commande remisée repart de zéro, une commande en cours compte) ? La remise fidélité se cumule-t-elle avec celle d'une communauté (hypothèse : non) ?
17. **Personnel** : les gestionnaires du personnel doivent-ils être reliés aux comptes du back-office (même personne, même e-mail) ? Un livreur doit-il ne voir que ses propres livraisons ?

## Décisions prises

- La base n'existe pas chez le client : le dashboard la crée et la possède (2026-09-14).
- Affectation d'un préparateur et d'un livreur sur chaque commande, depuis les cartes et la fiche, par liste déroulante qui écrit aussitôt ; la tournée continue de se piloter par le statut (2026-09-14, remplace la décision du 2026-09-13).
- Les remises (communauté, fidélité) sont décidées et appliquées par l'application FIG ; le dashboard les affiche et signale la fidélité à venir (2026-09-14).
- Les communautés sont en lecture seule dans le dashboard tant que la question 15 est ouverte (2026-09-14).
- Un produit dupliqué naît masqué, nommé « (copie) », pour être relu avant publication (2026-09-14).
- HT par défaut sur toutes les pages qui affichent des montants (2026-09-14).
- Motif d'annulation obligatoire, communiqué au client (2026-09-14).
- Données de démonstration : historique généré sur deux ans (2025 et 2026 jusqu'au 14 septembre), déterministe, hors la fenêtre du scénario (2026-09-14).
- Pas d'écran d'accueil animé ni de splash ; animations légères en CSS, sous `prefers-reduced-motion`.
- Fixtures sans personne réelle ; aucune donnée personnelle sur un poste de développement.

## Points connus, sans action prévue

- `notFound()` sous une frontière `loading.tsx` renvoie la page 404 avec un statut HTTP 200 (le début de la page est déjà envoyé). Sans effet pour un back-office.
- La recherche catalogue et clients se fait en mémoire après chargement : identique au mock, suffisant pour quelques milliers de lignes.
