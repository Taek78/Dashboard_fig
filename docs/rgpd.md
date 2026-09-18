# RGPD : données personnelles du back-office FIG (2026-09-15)

Ce document dit quelles données personnelles la base contient, pourquoi, combien de temps, et comment répondre à une demande d'une personne. Il sert aussi de brouillon pour les pièces que le client doit valider : registre des traitements, durées de conservation, contrat de sous-traitance. Tout ce qui est marqué **hypothèse** reste à confirmer par le client. Ce n'est pas un avis juridique : à faire relire par le conseil ou le DPO du client avant la mise en ligne.

## 1. Qui est responsable de quoi

- **Responsable du traitement** : le client, FIG. Il décide des finalités et des durées, informe les personnes (mentions dans l'application) et reçoit leurs demandes.
- **Sous-traitant** (article 28) : l'auteur du dashboard. Il traite les données pour le compte de FIG, seulement sur ses instructions documentées (article 28.3.a) :
  - il aide FIG à répondre aux demandes des personnes (article 28.3.e) ;
  - il prévient FIG d'une violation dans les meilleurs délais (article 33.2) ;
  - il tient le registre des traitements faits pour son compte (article 30.2).
- **Sous-traitant ultérieur** : Brevo, pour l'envoi des mails du back-office (invitations, codes de récupération, alertes, avis d'activation, d'expiration d'invitation, de désactivation ou de suppression d'un compte ; question 26) et des codes de connexion des clients de l'application (API, `docs/api.md`), et le futur hébergeur de l'application et de PostgreSQL (question 8). Il faut :
  - l'autorisation écrite préalable de FIG (article 28.2) ;
  - de préférence un hébergement dans l'Union européenne ;
  - un contrat de sous-traitance qui reprend les mêmes obligations (article 28.4).

## 2. Inventaire des données personnelles

| Table ou lieu            | Personnes                                                                                  | Données                                                                                                                                                                                                                                                                                                                                                                                                                                            | Remarque                                                                                                                    |
| ------------------------ | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `customers`              | clients de l'application                                                                   | nom, e-mail, téléphone, rue, ville, code postal, communauté, date de création ; autorisations (offres, état de commande, marketing) et date du choix ; code de parrainage (contient le nom) et parrain                                                                                                                                                                                                                                             | anonymisables (`anonymized_at`, migration 0007) : rue, code, parrain et autorisations effacés aussi (migration 0009)        |
| `customer_notes`         | clients, parfois des tiers                                                                 | texte libre écrit par l'équipe, nom de l'auteur                                                                                                                                                                                                                                                                                                                                                                                                    | supprimées à l'anonymisation ; consigne de minimisation sous le champ                                                       |
| `orders`                 | clients                                                                                    | produits, montants, frais de livraison, créneau, rue, ville et code postal de livraison, précision libre d'une annulation                                                                                                                                                                                                                                                                                                                          | conservées après anonymisation (voir 3) ; rue et précisions effacées                                                        |
| `order_events`           | clients, équipe                                                                            | changements de statut, nom de la personne de l'équipe, précision d'annulation                                                                                                                                                                                                                                                                                                                                                                      | précisions effacées à l'anonymisation du client                                                                             |
| `customer_notifications` | clients                                                                                    | notifications d'état déposées pour la personne : commande, statut, texte (jamais son nom), dépôt et envoi                                                                                                                                                                                                                                                                                                                                          | seulement si elle a autorisé les notifications d'état ; exportées, puis **supprimées** à l'anonymisation                    |
| `customer_messages`      | clients, parfois des tiers                                                                 | objet, texte libre écrit par la personne, commande citée, date ; qui l'a traité et quand                                                                                                                                                                                                                                                                                                                                                           | exportés (droit d'accès) puis **supprimés** à l'anonymisation                                                               |
| `message_attachments`    | clients, parfois des tiers                                                                 | nom de fichier, format, taille, et le fichier hébergé (`upload_id`) ou, pour une ligne antérieure, son URL                                                                                                                                                                                                                                                                                                                                         | supprimées avec leur message                                                                                                |
| `message_uploads`        | clients, parfois des tiers (une photo peut montrer une personne, une adresse, un document) | les FICHIERS joints eux-mêmes (photos, PDF, 5 Mo au plus), leur nom et le client qui les a envoyés                                                                                                                                                                                                                                                                                                                                                 | avec leur message ; supprimés à l'anonymisation du client, joints ou non ; jamais joints : 24 heures (`npm run rgpd:purge`) |
| `communities`            | référents des communautés                                                                  | nom, e-mail, téléphone du contact                                                                                                                                                                                                                                                                                                                                                                                                                  | lecture seule dans le dashboard (question 15)                                                                               |
| `staff`                  | équipe du client                                                                           | nom, e-mail, téléphone, métier, créneau, jours travaillés, disponibilité (dont « arrêt maladie », sans motif ni pièce médicale), date d'entrée et de sortie, notes                                                                                                                                                                                                                                                                                                                                                                    | consigne de minimisation sous les notes ; durée à fixer (question 20)                                                       |
| `users`                  | utilisateurs du dashboard                                                                  | prénom, nom, e-mail, rôle, hachage scrypt du mot de passe, expiration de l'invitation notifiée                                                                                                                                                                                                                                                                                                                                                     | jamais le mot de passe                                                                                                      |
| `security_events`        | utilisateurs, visiteurs                                                                    | e-mail saisi, adresse IP, identifiants, action                                                                                                                                                                                                                                                                                                                                                                                                     | 12 mois (hypothèse), sauf preuves des demandes RGPD                                                                         |
| `login_attempts`         | visiteurs                                                                                  | e-mail saisi, adresse IP, nombre d'échecs ; quotas de récupération (e-mail ou nom saisi, adresse IP)                                                                                                                                                                                                                                                                                                                                               | 24 h sans verrou actif (choix technique), purgé aussi à chaque échec                                                        |
| `auth_tokens`            | utilisateurs du dashboard                                                                  | HMAC d'un code de récupération ou d'un lien (jamais le secret), adresse IP de la demande, dates                                                                                                                                                                                                                                                                                                                                                    | supprimés avec le compte ; purgés un jour après expiration, à chaque émission                                               |
| `customer_login_codes`   | clients de l'application                                                                   | adresse e-mail saisie, HMAC du code (jamais le code), adresse IP de la demande, dates                                                                                                                                                                                                                                                                                                                                                              | API (`docs/api.md`) ; purgés un jour après expiration ; effacés à l'anonymisation                                           |
| `customer_sessions`      | clients de l'application                                                                   | HMAC du jeton (jamais le jeton), dates d'ouverture, de dernier accès, d'expiration et de révocation                                                                                                                                                                                                                                                                                                                                                | API ; 180 jours ; supprimées à l'anonymisation, purgées trente jours après expiration ou révocation ; dans l'export         |
| `api_idempotency_keys`   | clients de l'application                                                                   | clé choisie par l'application, hachage du corps, copie de la réponse (commande ou message de la personne)                                                                                                                                                                                                                                                                                                                                          | API ; 24 h ; supprimées à l'anonymisation                                                                                   |
| mails (Brevo)            | utilisateurs du dashboard, clients de l'application                                        | nom, e-mail, et dans les alertes l'adresse IP d'une demande ; code ou lien à usage unique ; avis d'activation (adresse de connexion, identifiant, rôle), d'expiration de l'invitation, de désactivation ou de suppression du compte (date, administrateur à contacter avec son adresse) ; aux administrateurs, nom, e-mail et rôle du compte concerné ; aux clients de l'application, leur code de connexion (six chiffres, dix minutes, sans nom) | sous-traitant Brevo (UE) ; conservation des journaux d'envoi à régler chez Brevo (question 26)                              |
| Have I Been Pwned        | utilisateurs du dashboard                                                                  | cinq caractères du SHA-1 d'un mot de passe candidat, sans identité                                                                                                                                                                                                                                                                                                                                                                                 | aucune donnée personnelle transmise (k-anonymity) ; appel coupé par `PASSWORD_BREACH_CHECK=0`                               |
| sortie standard          | utilisateurs                                                                               | mêmes lignes que `security_events`                                                                                                                                                                                                                                                                                                                                                                                                                 | conservation fixée chez l'hébergeur                                                                                         |
| sauvegardes              | tous                                                                                       | copie complète de la base (`npm run db:backup`)                                                                                                                                                                                                                                                                                                                                                                                                    | rotation à définir (question 18) ; voir 4.3                                                                                 |

Ce que la base ne contient pas, volontairement :

- ni coordonnées GPS, ni instructions d'accès (question 13) : la rue seule, telle que l'application la transmet ;
- ni moyen de paiement, ni date de naissance, ni donnée de santé.

**Consentements.** Les trois autorisations (`notify_offers`, `notify_order_status`, `marketing_consent`) sont recueillies par l'application FIG, qui date le dernier choix (`consents_updated_at`, preuve exigée par l'article 7.1). Le dashboard ne les modifie jamais depuis ses écrans ; depuis le 2026-09-17, son API les enregistre et les date pour la personne (inscription et profil de l'application) ; il n'envoie rien lui-même : il **dépose** une notification d'état de commande dans une file quand la personne l'a autorisé, et l'application l'envoie (question 23).

Aucune donnée réelle ne se trouve sur un poste de développement : les fixtures sont inventées et les adresses utilisent le domaine `.invalid`.

## 3. Registre des traitements (brouillon)

| Traitement                                    | Finalité                                                                               | Base légale (hypothèse)                                                                          | Personnes               | Durée de conservation (hypothèse)                                                                                                                                |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Commandes et livraisons                       | préparer, livrer, suivre les commandes, servir le client                               | exécution du contrat (article 6.1.b)                                                             | clients, référents      | tant que la relation dure, puis 3 ans sans activité avant anonymisation                                                                                          |
| Commandes conservées après anonymisation      | justifier la comptabilité                                                              | obligation légale (article 6.1.c), exception au droit à l'effacement (article 17.3.b)            | anciens clients         | 10 ans (article L123-22 du Code de commerce), **si** le comptable confirme que ces commandes sont des pièces justificatives ; accès restreint à l'équipe         |
| Notes internes sur les clients                | qualité du service (accès, préférences de livraison)                                   | intérêt légitime (article 6.1.f)                                                                 | clients                 | comme le client ; supprimées à l'anonymisation                                                                                                                   |
| Messages « Nous contacter » et pièces jointes | traiter les réclamations et les questions des clients                                  | exécution du contrat (article 6.1.b)                                                             | clients                 | comme le client ; supprimés à l'anonymisation. Durée propre à fixer (question 22) : une réclamation traitée n'a pas à être gardée aussi longtemps qu'une facture |
| Notifications d'état de commande              | prévenir la personne de l'avancement de sa commande                                    | consentement (article 6.1.a), recueilli par l'application                                        | clients                 | comme le client ; supprimées à l'anonymisation. Durée propre à fixer (question 23) : une notification envoyée n'a plus d'utilité                                 |
| Parrainage                                    | rattacher un nouveau client à celui dont il a saisi le code                            | exécution du contrat (article 6.1.b) ; les conditions du parrainage sont celles de l'application | clients                 | comme le client ; code et parrain effacés à l'anonymisation ; les filleuls restent rattachés à la ligne pseudonyme                                               |
| Organisation de l'équipe                      | affecter préparateurs et livreurs, plannings                                           | exécution du contrat de travail (article 6.1.b)                                                  | équipe                  | à définir avec le client (question 20)                                                                                                                           |
| Comptes et sécurité du back-office            | authentifier, limiter les accès, détecter et analyser un incident                      | intérêt légitime (article 6.1.f), au service de l'obligation de sécurité (article 32)            | utilisateurs, visiteurs | journal de sécurité 12 mois, tentatives de connexion 24 h                                                                                                        |
| Preuves des demandes RGPD traitées            | démontrer le respect des droits (article 5.2)                                          | obligation légale (article 6.1.c)                                                                | clients                 | à fixer (question 18) ; identifiant et date seulement                                                                                                            |
| Accès des clients à l'application (API)       | authentifier la personne (code par mail, session) et rejouer une création sans doublon | exécution du contrat (article 6.1.b)                                                             | clients                 | codes : un jour après expiration ; sessions : 180 jours puis trente jours ; clés d'idempotence : 24 h                                                            |

Destinataires : l'équipe de FIG selon son rôle (matrice de `src/domain/auth/roles.ts` ; depuis le 2026-09-18, à la demande de l'auteur, le LIVREUR lit aussi les fiches des clients (coordonnées, adresse, autorisations, notes internes), sans aucun montant dépensé : à faire valider par le client au titre de la minimisation, question 5), l'auteur du dashboard pour la maintenance, l'hébergeur. Aucun transfert hors de l'Union européenne prévu.

**Anonymisation ou pseudonymisation.** L'écran parle d'« anonymiser » un client : son identité est effacée sans copie. Les commandes gardées restent pourtant rattachées à un identifiant technique, qui existe aussi dans l'application FIG et dans les sauvegardes. Au sens strict du RGPD (considérant 26), elles sont **pseudonymes**, donc toujours des données personnelles : d'où leur ligne au registre, leur base légale et leur durée.

## 4. Répondre à une demande

La demande arrive chez FIG. Le délai de réponse est d'un mois, prolongeable de deux mois si la demande est complexe ou si elles sont nombreuses, à condition de prévenir la personne dans le premier mois (article 12.3). Les gestes ci-dessous sont réservés à l'**administrateur** et laissent une trace dans `security_events` avec le seul identifiant du client. L'écriture du journal ne bloque pas l'action : si la base du journal est indisponible, la ligne n'est que sur la sortie standard (point à renforcer, section 7).

### 4.1 Droit d'accès et portabilité (articles 15 et 20)

Fiche client → encart « Données personnelles (RGPD) » → **Exporter les données**. Le fichier JSON `fig-client-<id>-<jour>.json` contient :

- la fiche du client, avec sa rue, ses trois autorisations et la date de son dernier choix, son code de parrainage, le fait qu'elle ait été parrainée et le nombre de ses filleuls ;
- sa catégorie (basique ou fidèle) à l'instant de l'export et l'historique daté de ses atteintes ;
- les notes internes (la personne a le droit d'en avoir connaissance) ;
- toutes les commandes, avec leurs lignes, remises, frais de livraison, rue de livraison, annulations et l'historique de leurs statuts ;
- tous ses messages « Nous contacter », avec l'objet en clair, le texte, la commande qu'elle avait jointe, la liste de ses pièces jointes (nom, format, taille, identifiant du fichier hébergé) et le fait que la demande ait été traitée. Les fichiers eux-mêmes ne sont pas dans le JSON : l'administrateur les remet à part, ouverts depuis la fiche du message (format `fig-donnees-client/4`) ;
- toutes les notifications d'état déposées pour elle, avec leur date de dépôt et d'envoi.
- ses sessions dans l'application (dates d'ouverture, de dernier accès, d'expiration et de révocation ; jamais le jeton).

Il ne contient pas les noms des membres de l'équipe, qui sont les données d'autres personnes (article 15.4) — y compris le nom de la personne qui a traité un message. Ni le nom de son parrain, ni ceux de ses filleuls, pour la même raison : seulement « parrainée : oui/non » et un nombre. Il ne contient pas non plus les marques d'organisation interne de la boîte de réception (épingle, « important ») : elles disent comment l'équipe range son travail, pas ce qu'elle sait de la personne.

**Relire avant envoi.** Les notes et les précisions d'annulation sont du texte libre : elles peuvent nommer un tiers ou un membre de l'équipe. Il faut masquer ces passages avant de transmettre le fichier.

Transmettre le fichier par un canal sûr, puis le supprimer du poste.

- Journal : `customer_exported`.
- Route : `GET /clients/[id]/export`, sans mise en cache, refusée si la navigation vient d'un autre site.

### 4.2 Rectification (article 16)

Les coordonnées d'un client viennent de l'application FIG, qui en est la source : on les corrige dans l'application. Le dashboard ne modifie pas un client. Il n'existe pas encore d'outil pour corriger ou supprimer **une seule** note interne à la demande de la personne : aujourd'hui, seule l'anonymisation complète le permet (à outiller si le cas se présente).

### 4.3 Effacement (article 17)

Fiche client → **Anonymiser ce client** → taper `ANONYMISER`. L'opération est irréversible et se fait en une transaction (`src/db/privacy.ts`).

- **Refus si commande ouverte** : l'anonymisation est **refusée tant qu'une commande est en préparation ou expédiée**. La livraison a besoin des coordonnées, et une annulation postérieure pourrait réécrire un texte nominatif. Il faut attendre la livraison ou l'annulation.
- **Effacé** : nom, e-mail, téléphone, rue, ville et code postal, adhésion à une communauté, code de parrainage et parrain, les trois autorisations et leur date, notes internes, la rue de livraison et les précisions libres des annulations de ses commandes, **tous ses messages « Nous contacter »** avec leurs pièces jointes (un message est du texte écrit par la personne, souvent nominatif : le garder viderait l'anonymisation de son sens) et **toutes les notifications déposées pour elle**. Les fichiers joints, eux, sont hébergés par l'application FIG : à elle de les effacer (question 19).
- **Conservé** : les commandes, leurs produits, montants, frais, créneaux, ville et code postal de livraison, leur historique, l'identifiant technique (voir section 3), et le rattachement de ses filleuls à cette ligne pseudonyme (leur fiche affiche « Client anonymisé » comme parrain).
- **Rejouer la demande** sur un client déjà anonymisé refait le nettoyage des textes libres.
- **API de l'application** : ses sessions sont supprimées (le jeton ne sert plus : `401`), ses codes de connexion et les réponses mémorisées de ses clés d'idempotence aussi ; un compte anonymisé ne peut plus ouvrir de session (`account_closed`).
- **Journal** : `customer_anonymized`, jamais supprimé par la purge.

Ensuite :

- **Application FIG** : elle doit effacer ou anonymiser sa propre copie, et ne pas recréer le client (question 19). Sinon l'effacement n'est pas complet.
- **Sauvegardes** : les sauvegardes antérieures contiennent encore la personne. L'effacement s'y applique à leur expiration, d'où la rotation à définir.
- **Restauration d'une sauvegarde** : elle ramène les clients anonymisés depuis. Procédure :
  1. **avant** de restaurer, extraire de la base courante la liste `select id from customers where anonymized_at is not null` ;
  2. après la restauration, anonymiser à nouveau ces identifiants ;
  3. à défaut de liste, la reconstituer depuis les lignes `customer_anonymized` de `security_events` (hors de la sauvegarde restaurée, par exemple dans les journaux de l'hébergeur).

### 4.4 Autres droits

Opposition et limitation : à traiter par FIG. Pour l'équipe et les comptes du back-office, il n'existe pas d'écran d'export : une demande se traite par une requête SQL sur `staff` ou `users`, à outiller si elle devient fréquente.

## 5. Durées de conservation et purge

Les durées sont des hypothèses (question 18), définies dans `src/domain/privacy/retention.ts` :

| Donnée                                                      | Durée                                                   | Effet         | Source                                             |
| ----------------------------------------------------------- | ------------------------------------------------------- | ------------- | -------------------------------------------------- |
| client sans création, livraison ni commande ouverte récente | 3 ans après la dernière activité                        | anonymisation | référentiel « gestion commerciale » de la CNIL     |
| journal de sécurité                                         | 12 mois, sauf preuves des demandes RGPD                 | suppression   | la CNIL recommande 6 mois à 1 an pour les journaux |
| tentative de connexion                                      | 24 h, sauf verrou encore actif                          | suppression   | choix technique                                    |
| code de connexion de l'application                          | 24 h après expiration                                   | suppression   | choix technique                                    |
| session de l'application                                    | 180 jours, puis 30 jours après expiration ou révocation | suppression   | choix technique                                    |
| clé d'idempotence de l'API                                  | 24 h                                                    | suppression   | choix technique                                    |

```bash
cd dashboard
npm run rgpd:purge              # aperçu : ce qui serait supprimé ou anonymisé, rien n'est écrit
npm run rgpd:purge -- --apply   # applique, irréversible ; chaque anonymisation est journalisée (acteur rgpd-purge)
```

Le script refuse une base non locale sans `RGPD_ALLOW_REMOTE=1`. Attention : `localhost` peut être un tunnel vers la production, il faut lire l'hôte affiché avant `--apply`. Le script n'affiche que des nombres et des identifiants techniques, avec l'avancement. Un arrêt en cours de route se relance sans risque : tout est conditionnel.

**Ne pas planifier `--apply` avant les réponses aux questions 14, 18 et 19.**

- Le dashboard ne voit pas l'activité d'un client dans l'application : il peut se connecter sans commander.
- Anonymiser remplace son e-mail et lui ferait perdre son compte si l'application partage la table.

Une fois ces points validés, le lancer chaque mois par une tâche planifiée chez l'hébergeur, en gardant la sortie comme preuve.

## 6. Minimisation

- Sous chaque note libre (client, équipe), une consigne rappelle la règle :
  - seulement ce qui sert au service ;
  - jamais de santé, d'opinions, de religion, de sanction ni de jugement ;
  - la personne peut demander à lire ces notes.
- Un export ou un dump ne reste pas sur un poste. Un dump de production ne sort jamais sans avoir été anonymisé.
- Nouveau champ ou nouvelle table : l'ajouter à l'inventaire (section 2) avec sa durée, ou renoncer à la donnée.

## 7. Sécurité (article 32), en bref

- Rôles vérifiés côté serveur à chaque écran et chaque écriture.
- Mots de passe hachés (scrypt), limitation de débit de la connexion.
- CSP à nonce, journal de sécurité, gardes de production.
- Base de test jetable, aucune donnée réelle en développement.

Voir `docs/architecture.md` (section 6).

Restent à régler avant la mise en ligne :

- TLS vers la base ;
- chiffrement des disques et des sauvegardes chez l'hébergeur ;
- rôle PostgreSQL à privilèges réduits ;
- rotation des sauvegardes ;
- **révocation immédiate des droits** : le rôle vit dans le jeton de session (8 h), donc un administrateur rétrogradé garde l'export et l'anonymisation jusqu'à l'expiration (backlog) ;
- écriture attendue (et non lancée sans attente) des deux événements RGPD du journal.

## 8. Violation de données (articles 33 et 34)

1. **Contenir** : couper l'accès en cause (désactiver un compte, changer `AUTH_SECRET`, isoler la base).
2. **Qualifier** : quelles données, combien de personnes, depuis quand. S'appuyer sur `security_events` et les journaux de l'hébergeur.
3. **Prévenir FIG dans les meilleurs délais** (article 33.2).
4. **Notifier la CNIL (FIG)** : si possible dans les 72 heures, sauf si la violation n'est pas susceptible d'engendrer un risque pour les personnes (article 33.1).
5. **Informer les personnes (FIG)** : obligatoire si le risque est élevé, sauf exceptions de l'article 34.3 (données chiffrées, mesures qui suppriment le risque…).
6. **Documenter toute violation**, même non notifiée (article 33.5) : nature, catégories et nombre approximatif de personnes, conséquences probables, mesures prises.

## 9. À décider avec le client

Ces questions sont reprises dans `docs/backlog.md`.

- **Question 18** : durées de conservation, à savoir :
  - clients ;
  - journal ;
  - preuves des demandes RGPD ;
  - sauvegardes ;
  - avec le comptable, le statut de pièce justificative des commandes.

  Aussi : les bases légales du registre.

- **Question 19** : l'application FIG applique-t-elle l'anonymisation à sa copie des clients ? Qui reçoit les demandes, et par quel canal ?
- **Question 20** : durée de conservation des données de l'équipe après un départ.
- **Question 22**, messages « Nous contacter » :
  - ~~où l'application stocke-t-elle les pièces jointes ?~~ Tranché le 2026-09-18 : le dashboard les héberge dans sa base, et les efface lui-même à l'anonymisation ;
  - combien de temps garder un message traité, et ses fichiers ?
  - l'application garde-t-elle une copie des photos sur le téléphone ou son serveur après l'envoi ? Si oui, elle doit l'effacer à l'anonymisation ;
- **Question 23**, notifications d'état de commande :
  - par quel canal l'application les envoie-t-elle (notification du téléphone, e-mail, SMS) et lit-elle bien la file `customer_notifications` (lignes sans `sent_at`) pour poser `sent_at` ?
  - combien de temps garder une notification envoyée ?
  - l'application transmet-elle la date de chaque choix d'autorisation (`consents_updated_at`), preuve du consentement ?
- **Question 21** :
  - contrat de sous-traitance (article 28) ;
  - hébergeur et localisation des données ;
  - contact RGPD ou DPO du client ;
  - mentions d'information dans l'application.
