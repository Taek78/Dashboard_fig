# État du projet et reste à faire

Dernière mise à jour : 2026-09-16.

## Livré

- **Écrans** : tableau de bord (alerte en tête si aucun préparateur ou livreur n'est présent, période et HT/TTC, avancement des commandes, livraisons du jour), commandes (liste et tournée en une seule section depuis le 2026-09-16 : recherche par référence, client ou coordonnées, filtres statut, période, préparateur et livreur avec gommette de présence, raccourcis des 7 derniers jours, cartes avec créneau en grand, appel et itinéraire, détail avec adresse, frais de livraison et notifications déposées pour le client, historique des statuts, annulation avec motif, affectation d'un préparateur et d'un livreur, remises affichées), catalogue (grille avec modifier / dupliquer / supprimer, fiche, création, suppression confirmée), articles, clients (recherche commune particuliers et communautés, commutateur de type coloré, tris dans les deux sens dont le nombre de membres, grandes cartes avec adresse, autorisations, catégorie basique ou fidèle en étoiles et fidélité ; fiche en lignes pleine largeur avec autorisations en colonnes, parrainage, historique daté des statuts, notes ; remise de communauté déduite du nombre de membres, livraison offerte ; bandeau du type et de la visibilité sur la carte et la fiche d'une communauté), personnel (recherche par nom, prénom et coordonnées, filtres métier, disponibilité, créneau, jour et présence, cartes avec modifier, dupliquer et supprimer, fiche modifiable en haut, historique de traitement filtrable), métriques (rangées par thème, commandes en tête, réclamations reçues par messages, nouveaux clients et parrainages, part des commandes de communauté, camemberts pleins, tendances, comparaison N-1, usage de l'appli), comptes (admin), profil. Partout : le nom d'un client est un lien vers sa fiche ; une recherche par dates suit une seule règle (une date = ce jour-là, dates inversées signalées en rouge) et une période sans résultat s'annonce par un bandeau bleu.
- **Messages** (`/messages`) : boîte de réception des demandes « Nous contacter » écrites dans l'application FIG — recherche libre, filtres objet, statut, période de réception et « importants », épinglés dans leur propre groupe puis les plus récents, cartes avec les deux premières lignes et la commande jointe (livraison, préparateur, livreur), dégradé rouge des importants, fiche complète précédée de la fiche du client avec la commande jointe en détail (dates, adresse, équipe), pièces jointes (photos et PDF, dix au plus, limite et formats tenus par la base), statut traité / non traité, épingle et drapeau « important », tous en écriture conditionnelle et réservés à l'admin et au gestionnaire.
- **Clients, règles du 2026-09-16** : compteur de fidélité cumulé (annulées non comptées, membres compris), catégorie « fidèle » deux mois après huit commandes, déduite des commandes avec son historique ; la meilleure remise l'emporte (fidélité ou communauté) ; frais de livraison au barème, offerts aux communautés ; créneaux d'une heure entre 10:00 et 20:00 ; communautés de trois types (voisinage, entreprise, point relais), publiques (on les intègre directement) ou privées (sur invitation uniquement), jamais sans type ni visibilité ; trois autorisations lues dans l'application ; file de notifications d'état déposées à chaque changement de statut pour les clients qui l'ont autorisé, envoyées par l'application ; codes de parrainage, parrain et filleuls.
- **Données** : domaine pur par section, façades sur PostgreSQL (Drizzle), recherche, pagination et agrégats faits par la base, schéma et migrations possédés par le dashboard, seed (développement et tests), sauvegardes.
- **Sécurité** : Auth.js Credentials, rôles et matrice d'accès en lecture et en écriture, limitation de débit, CSP à nonce, journal de sécurité en base, gardes de production.
- **RGPD** (`docs/rgpd.md`) :
  - inventaire des données personnelles et brouillon du registre des traitements ;
  - export JSON complet d'un client (droit d'accès et portabilité) et anonymisation irréversible (droit à l'effacement), administrateur seul et journalisés ;
  - durées de conservation appliquées par `npm run rgpd:purge` (aperçu puis `--apply`) ;
  - consignes de minimisation sous les notes libres ;
  - procédure en cas de violation de données.
- **Qualité** : 680 tests Vitest (règles pures, couche données et Server Actions sur une base de test PostgreSQL jetable, parité SQL = règles pures, contraintes de la base vérifiées), 57 parcours Playwright (dont l'absence de violation CSP au chargement de chaque section, et l'absence de défilement horizontal sur toutes les sections à 400 px, 768 px menu ouvert et replié, 1280 px) sur la même base, CI (check et Playwright contre un PostgreSQL de service, audit).

## Reste à faire

### Dépend du client

| #   | Sujet                                                                                                                  | Ce qui bloque                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Branchement de l'application FIG à la base (question 14)                                                               | choix API du dashboard ou accès SQL direct           |
| 2   | Validation du vocabulaire (statuts, créneaux, catégories) et des rôles (livreur)                                       | questions 5 et 9                                     |
| 3   | TVA : base et taux des montants (hypothèse : TTC à 5,5 %)                                                              | question 10                                          |
| 4   | Adresse de livraison complète pour l'itinéraire, instructions d'accès                                                  | question 13                                          |
| 5   | Source des statistiques d'usage (stores, support)                                                                      | question 11                                          |
| 6   | Hébergement du dashboard et de PostgreSQL, nom de domaine                                                              | question 8                                           |
| 7   | RGPD : durées de conservation, propagation de l'anonymisation à l'application, contrat de sous-traitance               | questions 18 à 21 ; purge planifiée après validation |
| 8   | Messages : stockage et URL des pièces jointes, durée de conservation d'une demande traitée                             | question 22                                          |
| 9   | Notifications d'état : canal d'envoi par l'application, lecture de la file et pose de `sent_at`, durée de conservation | question 23                                          |

### Peut se faire sans le client

- Mise en ligne : rôle PostgreSQL applicatif à privilèges réduits, TLS vers la base, secrets par l'hébergeur, `serverActions.allowedOrigins` derrière un proxy inverse, sauvegardes automatiques (et restauration répétée), surveillance de `/api/health` avec `HEALTH_TOKEN`, métriques et alertes chez l'hébergeur (aucune aujourd'hui : le journal de sécurité part sur la sortie standard et en table, sans lecteur), rotation d'`AUTH_SECRET` (procédure dans base-de-donnees.md).
- Rotation et révocation de session côté serveur.
- Recherche catalogue et clients en SQL (`pg_trgm`) si les tables grossissent.
- Téléversement d'images produit et article (stockage à définir).
- Export CSV, impression de bons de livraison.
- Envoi des notifications par le dashboard lui-même (e-mail ou SMS), si l'application ne lit pas la file : le transport de mail existe désormais (`data/mail.ts`, Brevo), il resterait à décider avec le client si les notifications clients passent par lui.
- Double authentification (application TOTP) pour les administrateurs : la mesure suivante après la récupération par code, à proposer au client.

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
13. **Adresse de livraison** : la rue est désormais une colonne (`address_line`, `delivery_address_line`, migration 0009), transmise par l'application ; restent les coordonnées GPS et les instructions d'accès.
14. **Branchement de l'application FIG** : API HTTP exposée par le dashboard (recommandé : un seul propriétaire du schéma) ou accès SQL direct avec un rôle dédié ?
15. **Communautés** : l'application crée-t-elle les communautés et l'adhésion des clients (hypothèse actuelle : le dashboard les lit, ne les modifie pas) ? Faut-il pouvoir en créer depuis le back-office ? (La remise n'est plus saisie : elle se déduit du nombre de membres, décision du 2026-09-16.)
16. **Fidélité** : tranché le 2026-09-16 (huit commandes cumulées, annulées non comptées, la commande remisée repart de zéro, une commande en cours compte ; la remise la plus forte l'emporte, sans cumul). Reste à vérifier que l'application applique la même règle au paiement, membres de communauté compris.
17. **Personnel** : les gestionnaires du personnel doivent-ils être reliés aux comptes du back-office (même personne, même e-mail) ? Un livreur doit-il ne voir que ses propres livraisons ?
18. **RGPD, durées** : les hypothèses conviennent-elles ?
    - client sans activité depuis 3 ans : anonymisé ;
    - journal de sécurité : 12 mois ;
    - tentatives de connexion : 24 h.

    Il reste aussi à fixer :
    - la durée des preuves des demandes traitées et celle des sauvegardes ;
    - avec le comptable, si les commandes du dashboard sont des pièces justificatives à garder 10 ans ;
    - les bases légales à retenir pour le registre.

19. **RGPD, application** : l'application FIG anonymise-t-elle aussi sa copie d'un client ? Ne recrée-t-elle pas un client anonymisé ici ? Qui reçoit les demandes des personnes, et par quel canal ?
20. **RGPD, équipe** : combien de temps garder la fiche d'une personne partie (`active = false`) ?
21. **RGPD, cadre** : il faut fixer quatre points :
    - le contrat de sous-traitance (article 28) ;
    - l'hébergeur et le lieu des données (Union européenne) ;
    - le contact RGPD ou DPO du client ;
    - les mentions d'information dans l'application.
22. **Messages, pièces jointes** : où l'application stocke-t-elle les fichiers et sous quelles URL ? Combien de temps garder une demande traitée ? L'application efface-t-elle les fichiers à l'anonymisation ?
23. **Notifications d'état de commande** : par quel canal l'application les envoie-t-elle (notification du téléphone, e-mail, SMS) ? Lit-elle la file `customer_notifications` (lignes sans `sent_at`, dans l'ordre de dépôt) et pose-t-elle `sent_at` ? Combien de temps garder une notification envoyée ? Transmet-elle la date de chaque choix d'autorisation (`consents_updated_at`) ?
24. **Frais de livraison et barème** : le barème (4,90 € sous 5 €, 3,90 € dès 5 €, 2,90 € dès 10 €, 1,90 € dès 20 € de panier avant remise, offerts aux communautés) est-il bien celui que l'application facture, et les frais sont-ils au même taux de TVA que les produits (question 10) ?
25. **Mails du back-office (Brevo)** : le client doit créer le compte Brevo (offre gratuite suffisante), valider son domaine ou l'adresse d'expédition (SPF, DKIM) et fournir la clé `MAIL_API_KEY` et l'adresse `MAIL_FROM` à l'hébergement ; Brevo devient sous-traitant ultérieur (registre RGPD, hébergement en Union européenne). Accepte-t-il aussi l'appel à Have I Been Pwned (cinq caractères d'un hachage, aucune donnée personnelle) pour refuser les mots de passe fuités ?
26. **Parrainage** : le code « Nom#0000 » est attribué par l'application ; y a-t-il une récompense pour le parrain ou le filleul (rien n'est prévu dans le dashboard), et le code d'un client anonymisé est-il réattribuable ?

## Décisions prises

- Performance frontend (2026-09-17, audit mesuré) : appliqué, les liens des cartes de liste préchargés au survol seulement (`HoverPrefetchLink` : 55 → 19 rendus serveur par affichage de la liste des commandes) et une frontière `Suspense` par carte de commande (LCP médian sur téléphone bridé 2,3 s → 1 s, blocage inchangé) ; écarté après mesure : passer la liste du personnel une seule fois (React la déduplique déjà : huit occurrences pour quatre-vingts champs, 23 Ko compressés), retirer l'animation d'entrée de page (sans effet sur le LCP), précharger le menu mobile (le délai de la première ouverture est l'hydratation en cours, 0,65 s ensuite), retirer le fond fixe, le flou ou les ombres (sans effet au défilement) ; reste, au-delà du peu coûteux : réduire le socle JavaScript commun (204 Ko compressés : infobulle de la sidebar, liste des mots de passe courants présente dans trois morceaux) et le nombre de formulaires client par carte de commande (trois aujourd'hui).
- Audit (2026-09-17, sécurité et CI peu coûteuses) : route de santé protégée par `HEALTH_TOKEN` (Bearer, 401 sans toucher à la base) et limitée à une sonde par cinq secondes ; garde d'hôte partagée des scripts qui écrivent en base (seed, purge RGPD, restauration, base de test : `src/lib/database-url.ts`, crochets IPv6 compris) ; CI : actions épinglées par SHA, permissions en lecture seule, exécutions superposées annulées, délais bornés, CodeQL et Gitleaks hebdomadaires (faux positifs des fixtures de test en liste blanche, historique complet vérifié sans fuite) ; test de migration depuis la version précédente avec des lignes (0014 découpe des noms, 0015) sur une base jetable ; rotation d'`AUTH_SECRET` et répétition de la restauration documentées ; `EXPLAIN (ANALYZE, BUFFERS)` des lectures principales : index trigramme, index de date et index client utilisés, moins d'une milliseconde chacune sur 3 660 commandes. Écarté après examen : cache, pagination par curseurs, virtualisation, budget de bundle, tests de charge (volume et périmètre du produit) ; en attente de l'hébergeur : métriques, alertes, sauvegardes planifiées, rôle PostgreSQL restreint. Suite du même jour, sur décision du client : `HEALTH_TOKEN` obligatoire en production ; accessibilité automatisée (`@axe-core/playwright`, violations sérieuses et critiques bloquantes, les autres jointes au rapport ; première correction : `aria-current` à la place d'`aria-pressed` sur les liens HT / TTC) ; premiers passages CodeQL et Gitleaks au vert sur GitHub.
- Comptes (2026-09-17, troisième lot) : **compte en attente d'activation** tant que l'invitation n'est pas acceptée (carte translucide en pointillés, validité du lien affichée ; « Annuler l'invitation » supprime le compte jamais activé ; ni « Désactiver » ni « Supprimer » entre-temps) ; **invitation expirée** : carte rouge et, au bout des 48 h, avis par mail à la personne et aux administrateurs, une seule fois par lien (balayage une minute après le démarrage du serveur puis toutes les quinze minutes, et après la page Comptes ; colonne `invitation_expired_at`, migration 0015) ; **compte activé** : avis à la personne (adresse de connexion, identifiant, rôle, administrateur à contacter) et aux administrateurs, à l'acceptation du lien comme au dépannage ; tous les avis nomment l'administrateur avec son adresse et sont signés « L'équipe FIG » ; un administrateur invité sans mot de passe ne compte plus comme administrateur actif.
- Comptes (2026-09-17, second lot) : **prénom et nom séparés** (migration 0014, anciens noms découpés), couple unique ; « Adresse e-mail oubliée » par le **nom seul**, chaque homonyme actif recevant son rappel ; e-mail du compte en **lecture seule** sur la carte ; **suppression** définitive avec le mot SUPPRIMER (jetons en cascade, historique conservé) ; le **dernier administrateur actif** n'est ni supprimable, ni désactivable, ni rétrogradable, d'autres administrateurs pouvant être créés puis supprimés tant qu'il en reste un ; formulaire « Nouveau compte » réaligné (quatre champs de même hauteur, une seule aide sous la grille) ; **avis par mail** à la personne quand son compte est désactivé ou supprimé (ton professionnel, administrateur à contacter ; après une suppression, un nouveau compte peut être créé à la même adresse, sur invitation d'un administrateur, seul habilité à créer un compte).
- Commandes (2026-09-17) : **changement de statut libre**, plus de règle d'étape : liste déroulante des quatre statuts sur les cartes et la fiche, qui écrit dès le choix, avec l'icône et la couleur du statut choisi (ambre en préparation, bleu expédiée, vert livrée, rouge annulée) ; livrée directement, retour en préparation ou reprise d'une annulée possibles ; « Annulée » demande toujours le motif avant confirmation ; à chaque changement, la notification d'état est déposée pour le client qui l'a autorisée, retour en préparation compris ; case « Notifier le client » cochée par défaut : décochée, aucune notification n'est déposée même si le client l'a autorisée ; sous la confirmation, « Client notifié » (badge vert) ou « Client non notifié » (gris) ; décochée d'elle-même dès que la commande est passée une fois par « livrée », désactivée et libellée « Notifications non autorisées par le client » quand le client n'a pas donné l'autorisation.
- Écrans (2026-09-17, huitième lot) : **période personnalisée** du tableau de bord et des métriques : la liste « Période » finit par « Période personnalisée » et la zone de dates « du / au » n'apparaît que pour ce choix (ouverte dès le choix, refermée pour une période prédéfinie : les dates abandonnées ne partent pas dans l'URL) ; bouton « Afficher » et légende « Période affichée » sous la zone ; les anciens liens `?du=&au=` restent lus ; section « Usage de l'application » des métriques en deux colonnes sur deux lignes, cartes plus aérées.
- Comptes et récupération (2026-09-17, septième lot) : création d'un compte **sans mot de passe** avec lien d'invitation par e-mail (48 h), « Envoyer un lien » et dépannage depuis Comptes ; « Mot de passe oublié » par code à six chiffres (5 min, 5 essais, quotas), « Adresse e-mail oubliée » par le nom du compte (unique) ; alertes par mail à la personne et aux administrateurs, lien « Ce n'était pas moi » qui verrouille le compte ; sessions fermées dès désactivation, verrouillage ou changement de mot de passe ; politique de mots de passe avec jauge et vérification contre les fuites connues ; envoi par Brevo (API HTTP, sans dépendance) ou fichier ; migration 0013.
- Écrans (2026-09-17, sixième lot) : **type de commande** particulier / communauté (`orderKindOf`, déduit de la communauté portée) : carte, tableau et détail nomment la communauté puis l'interlocuteur (garant, livré pour tous), code couleur des tokens `--individual` / `--community`, filtre `?type=` en commutateur coloré (`TypeSwitch`, partagé avec les Clients), parité SQL testée.
- Écrans (2026-09-17, cinquième lot, refonte visuelle) :
  - **Panneau de filtres** commun (`FilterTray`) sous chaque barre de recherche, **zone de dates** dédiée pleine largeur (`DateRangeFields`), cases à cocher en puces, barre de recherche partagée (`SearchField`).
  - **Commandes** : raccourcis des 7 derniers jours dans la zone de dates, « Aujourd'hui » en tête et en évidence ; barre d'**avancement des commandes listées** (toutes pages, `getOrderStatusCounts`).
  - **Tableau de bord** : état vide « Aucune commande » bien visible ; section « Commandes en préparation » titrée comme les métriques (`Section`).
  - **Métriques** : cartes KPI réorganisées (libellé pleine largeur, tendance à côté de la valeur, camembert à droite), anneau pointillé sans donnée, formulaire de période sur deux lignes avec HT / TTC à droite.
  - **Connexion** : scène animée abstraite (orbes, balayage, motif verger, particules, parallaxe), carte en verre.
- Écrans (2026-09-16, quatrième lot) :
  - **Gommette grise** sur le préparateur et le livreur d'une commande livrée ou annulée : la gommette verte ou rouge ne sert qu'à affecter le jour même.
  - **Catalogue** : statut de vente en pastille sur l'image (en vente, rupture de stock, indisponible, masqué) ; case « Laisser en vente les produits dont le stock est à 0 » entre la recherche et la grille, paramètre global en base (migration 0012) lu par l'application.
  - **Dates avec l'année** partout (une seule fois dans une période de la même année).
  - **Fiche client sur PC** : coordonnées et chiffres clés en tuiles sur deux colonnes, notes à droite ; téléphone et tablette inchangés.
  - **Moins d'explications** : aides sous les recherches et les champs de dates, descriptions d'en-tête, phrases de section des métriques et paragraphes de démonstration retirés ou raccourcis.
  - **Carte de commande** : la remise seule entre parenthèses à côté du total ; frais de livraison et sous-total dans le détail seulement ; le badge de remise reste à gauche.
- Écrans (2026-09-16, troisième lot) :
  - **Calendrier maison** des champs « du / au » sur tablette et PC (jours voisins grisés, ouverture sur le mois de la date saisie, sinon de l'autre borne, sinon le mois actuel), sans dépendance ; sélecteur natif conservé sur téléphone.
  - **Tri en deux gestes** dans la section Clients : critère dans la liste, sens par un bouton icône (A / Z, 1 / 9 ; flèche bas = croissant, vers le haut = décroissant, rotation rapide).
  - **Fond nuancé** des cartes clients (bleu « particulier ») et communautés (couleur communauté), selon le thème.
- Écrans (2026-09-16, second lot) :
  - **Section Livraisons supprimée** : elle dupliquait Commandes. La liste des commandes sert de tournée (raccourcis des 7 derniers jours conservés, créneau en grand, appel et itinéraire sur la carte, nom du client en lien) ; le livreur y atterrit ; `/livraisons` redirige. Abandonnés : l'ordre de passage numéroté, la « prochaine » livraison, l'avancement par jour.
  - **Dates « du / au »** : une seule règle pour toutes les recherches (commandes, messages, historiques des fiches, plage libre du tableau de bord et des métriques) : une date = ce jour-là ; dates inversées = erreur rouge, rien n'est filtré, jamais d'échange silencieux ; les deux champs forment un seul filtre ; une période sans résultat est dite dans un bandeau bleu.
  - **Réclamations** = messages « Nous contacter » de la période dont l'objet est produit manquant ou abîmé, problème de livraison, erreur sur la commande ou remboursement/avoir ; le chiffre venu des stores disparaît (migration 0010, colonne supprimée). **Parrainages** et **nouveaux clients** comptés par la base sur le jour d'inscription. Le nombre de commandes passe en tête des métriques.
  - **Alerte du tableau de bord** quand aucun préparateur, ou aucun livreur, n'est « disponible » (sur la disponibilité de la fiche, pas sur les jours travaillés). **Gommette** verte ou rouge devant chaque nom des listes d'affectation, rouge dès que la personne n'est pas disponible, quelle que soit la raison.
  - **Messages** : la commande jointe passe au-dessus du texte sur la carte ; pièces jointes en violet (nouveau token `--attachment`). **Fiche client** : autorisations, parrainage et fidélité en lignes pleine largeur.
  - Le point « bandeaux fidélité sur les communautés » a été abandonné par le client.

- Clients (2026-09-16) :
  - **Fidélité** : compteur CUMULÉ (une annulée ne compte pas et ne remet pas à zéro), membres de communauté compris ; à huit, la prochaine commande est à −15 % et le client devient **fidèle** deux mois, puis basique. Deux catégories seulement (le « premium » envisagé a été abandonné). La catégorie et son historique sont **déduits des commandes** (règle pure et requête SQL à fenêtres), jamais stockés : personne dans le dashboard n'assiste à la création d'une commande.
  - **La meilleure remise l'emporte** : la fidélité prête (−15 %) remplace la remise de la communauté sur cette commande-là ; jamais de cumul.
  - **Remise de communauté déduite du nombre de membres** (rien jusqu'à 3, −5 % de 4 à 9, −10 % dès 10) ; colonne `discount_percent` supprimée. **Livraison offerte** à toute communauté, imposé par la base.
  - **Frais de livraison** au barème du panier avant remise, ajoutés après la remise, conservés sur chaque commande.
  - **Créneaux d'une heure pile**, imposés par la base (migration 0009, qui réécrit les créneaux existants), **entre 10:00 et 20:00** (migration 0011, contrainte `orders_slot_hours`).
  - **Communautés** : trois types, voisinage, entreprise et point relais, qui remplacent crèche, école, entreprise, association et autre (migration 0011 : les anciens deviennent voisinage, sauf entreprise) ; visibilité posée par l'application, « public » (on intègre la communauté directement) ou « privé » (sur invitation uniquement), sans valeur par défaut. Type et visibilité ne sont jamais vides (NOT NULL et enums, vérifié par les tests). Un bandeau en tête de la carte et de la fiche montre l'un (« Voisinage », « Entreprise », « Point relais ») et l'autre (« Public » ou « Privé »).
  - **Autorisations** (offres, état de commande, marketing) recueillies et datées par l'application, lues par le dashboard.
  - **Notifications d'état** : le dashboard n'a aucun canal vers le client ; il **dépose** une notification dans une file, dans la transaction du changement de statut, seulement si la personne l'a autorisé ; l'application l'envoie et pose `sent_at` (question 23). Le texte ne nomme jamais la personne.
  - **Parrainage** : code « Nom#0000 » attribué par l'application, format et unicité tenus par la base ; parrain et filleuls visibles dans la fiche seulement ; l'export RGPD ne nomme aucun tiers.
  - **Une personne est toujours un particulier** : membre d'une communauté, elle garde le type « Particulier » et reçoit à côté un badge « Communauté » avec le nom du groupe, partout (cartes et fiches clients, commandes, historiques). Seul un groupe a le type « Communauté ». Une personne, son avatar et ses commandes restent en bleu « particulier » ; seul le badge d'appartenance est en couleur communauté. La position « particuliers » de la section Clients montre donc aussi les membres ; la position « communautés » ne montre que les cartes des groupes, jamais leurs membres.
  - **Section Clients** : commutateur de type à trois positions colorées ; chaque tri existe dans les deux sens ; tri par membres pour les communautés (les groupes seulement).
  - **RGPD** : rue, code, parrain et autorisations effacés à l'anonymisation, notifications supprimées, rue de livraison effacée des commandes ; tout entre dans l'export.

- Messages « Nous contacter » (2026-09-16) : la boîte de réception est en **lecture seule sur le contenu**. Les messages et leurs pièces jointes sont écrits par l'application FIG ; le dashboard ne pose que trois marques (statut, épingle, « important »).
  - Les **fichiers** joints restent hébergés par l'application : la base ne garde que nom, format, taille et URL (question 22). Le dashboard ne téléverse rien.
  - La **limite de dix pièces jointes** et la **liste blanche de formats** (PDF et images, ni vidéo ni audio) sont tenues par la BASE et non par un écran, puisque l'application écrira peut-être en SQL direct (question 14).
  - Un message est une donnée personnelle : il entre dans l'export RGPD et **disparaît à l'anonymisation** du client, pièces jointes comprises.

- RGPD (2026-09-15) : un client n'est jamais supprimé. Il est **anonymisé** de façon irréversible : ses commandes restent, pseudonymes, pour la comptabilité (10 ans si le comptable le confirme).
  - L'anonymisation est refusée tant qu'une commande est en préparation ou expédiée.
  - Export et anonymisation sont réservés à l'administrateur et journalisés sans donnée de la personne ; ces preuves ne sont jamais purgées.
  - L'export exclut les noms de l'équipe (droits des tiers) et se relit avant envoi.
  - Les durées de conservation sont des hypothèses, appliquées par un script à aperçu. Aucun `--apply` planifié avant les réponses aux questions 14, 18 et 19.
  - Relecture de sécurité faite le même jour : course avec les notes (verrou partagé), annulation après anonymisation, export déclenché depuis un site tiers, procédure de restauration, formulations juridiques.

- La base n'existe pas chez le client : le dashboard la crée et la possède (2026-09-14).
- Plus de statut « confirmée » (migration 0003), puis plus d'« en attente » (migration 0005) : trois états, en préparation → expédiée → livrée ; l'annulation avec motif reste possible en préparation ; données reprises par les migrations (2026-09-15).
- Plus de mode sans base : PostgreSQL partout (développement, tests Vitest et Playwright sur une base Docker jetable, CI) ; les fixtures ne servent qu'au seed et aux tests. Tableau de bord, métriques, personnel et annuaire lisent des agrégats SQL, la liste des commandes est paginée par la base (2026-09-15).
- Performances (2026-09-15) : recherche des commandes sur colonnes calculées et index trigramme (migration 0006), une requête par liste (lignes en JSON, page et total en parallèle), fiches personnel, client et communauté paginées ou agrégées, 10 commandes en préparation au plus sur le tableau de bord, raccourcis de tournée comptés par la base, produits phares et compteurs du personnel réécrits, pool de 10 connexions, session mémorisée par requête, recharts remplacé par des graphiques SVG maison, panneau mobile chargé à la demande, `content-visibility` sur les cartes. Cache Components de Next non activé : le serveur répond déjà en 30 à 110 ms et l'application FIG écrira directement en base, un cache ne pourrait pas être invalidé par ses écritures.
- L'horaire de retrait d'une communauté est choisi par le client à chaque commande dans l'application, source de vérité ; la communauté n'a plus d'heure fixe (2026-09-15).
- Clients : une recherche commune pour les particuliers et les communautés, avec filtre et tri ; chaque commande et chaque client affichent leur type en couleur (2026-09-15).
- Personnel : modifier, dupliquer et supprimer depuis les cartes (admin et gestionnaire) ; une duplication reprend le métier et l'organisation, jamais l'identité (2026-09-15).
- Les recherches se lancent pendant la saisie (anti-rebond de 350 ms), sans bouton « Rechercher » (2026-09-15).
- Après audit : affectation conditionnelle (commande non terminée, affectation inchangée depuis l'affichage), limitation de débit en base (`login_attempts`, migration 0004), tests de parité (2026-09-15).
- Mise en page pilotée par la largeur de la zone de contenu (container queries) pour la tablette, sidebar ouverte ou repliée ; fond de fenêtre fixe ; thème FIG refondu en crépuscule adouci (2026-09-15).
- Affectation d'un préparateur et d'un livreur sur chaque commande, depuis les cartes et la fiche, par liste déroulante qui écrit aussitôt ; la tournée continue de se piloter par le statut (2026-09-14, remplace la décision du 2026-09-13).
- Les remises (communauté, fidélité) sont décidées et appliquées par l'application FIG ; la source de vérité est le **paiement** dans l'application : le dashboard les affiche sans jamais les calculer et signale la fidélité à venir (2026-09-14, précisé le 2026-09-15).
- Les communautés sont en lecture seule dans le dashboard tant que la question 15 est ouverte (2026-09-14).
- Un produit dupliqué naît masqué, nommé « (copie) », pour être relu avant publication (2026-09-14).
- HT par défaut sur toutes les pages qui affichent des montants (2026-09-14).
- Motif d'annulation obligatoire, communiqué au client (2026-09-14).
- Données de démonstration : historique généré sur deux ans (2025 et 2026 jusqu'au 14 septembre), déterministe, hors la fenêtre du scénario (2026-09-14).
- Pas d'écran d'accueil animé ni de splash ; animations légères en CSS, sous `prefers-reduced-motion`.
- Fixtures sans personne réelle ; aucune donnée personnelle sur un poste de développement.

## Points connus, sans action prévue

- `notFound()` sous une frontière `loading.tsx` renvoie la page 404 avec un statut HTTP 200 (le début de la page est déjà envoyé). Sans effet pour un back-office.
- La recherche du catalogue et des clients se fait en mémoire après chargement (petites tables) ; celle des commandes par index trigramme. L'annuaire `/clients` filtre et trie en mémoire tous les clients : à passer en SQL au-delà de quelques milliers de clients.
- Déploiement : application et base dans la même région, `pg_stat_statements`, compression brotli au proxy HTTPS (voir `docs/base-de-donnees.md`).
