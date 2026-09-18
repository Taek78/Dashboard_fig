# API de l'application FIG

Guide de branchement de l'application (mobile ou web) et de son serveur sur le back-office. La description formelle, générée depuis le code, est `docs/api/openapi.json` (servie aussi par `GET /api/v1/openapi.json`) : elle fait foi pour la forme exacte de chaque champ. Ce guide explique le parcours, les règles et les cas d'erreur.

Décision du 2026-09-17 (question 14 du backlog) : l'application ne touche jamais la base. Elle passe par cette API, seule propriétaire du schéma et des règles (remises, frais, créneaux, fidélité). Une seule frontière de confiance, un seul endroit qui calcule un prix.

## 1. En bref

- **Base** : `https://<hôte du dashboard>/api/v1`. JSON UTF-8 dans les deux sens (`Content-Type: application/json`), corps limité à 64 Ko.
- **Unités** : montants en centimes d'euro (`1990` = 19,90 €), quantités en grammes (`unit: "g"`) ou en pièces (`unit: "piece"`), instants ISO 8601 en UTC, jours `AAAA-MM-JJ`, heures `HH:mm` (Europe/Paris). Chaque clé de vocabulaire (`status`, `subject`, `category`…) est accompagnée de son libellé français (`statusLabel`…) : rien à traduire.
- **Deux appelants** :
  - un **client** de l'application, identifié par un jeton de session obtenu après un code reçu par mail (`Authorization: Bearer <jeton>`) ;
  - le **serveur** de l'application, identifié par la clé de service (`Authorization: Bearer <API_SERVICE_KEY>`), pour la file des notifications.
- **Erreurs** : toujours `{ "error": { "code", "message", "details"? } }`. `code` est stable (à tester dans le code de l'application), `message` est en français et peut être affiché tel quel.
- **Créations** (`POST /commandes`, `POST /messages`) : en-tête `Idempotency-Key` obligatoire. Rejouer la même requête ne crée jamais deux fois.
- **Langue** : l'API est en français, et seulement en français. `Accept-Language` n'est pas lu, aucune négociation de langue n'est prévue (le service livre en France, son équipe et ses clients sont francophones). Conséquence pour l'application : les `code` d'erreur et les clés de vocabulaire (`status: "delivering"`, `subject: "delivery_issue"`, `kind: "voisinage"`…) sont des **identifiants stables**, à tester tels quels et à ne JAMAIS traduire ni afficher ; ce qui s'affiche, ce sont les champs `*Label` fournis à côté, et le `message` d'une erreur. Si l'application devient multilingue un jour, elle traduit à partir des `code` et des clés, sans rien attendre de l'API.

## 2. Parcours d'accès d'un client

Pas de mot de passe. La personne prouve qu'elle lit sa boîte mail, puis l'application garde un jeton de session (180 jours).

### 2.1 Demander un code

```http
POST /api/v1/auth/code
Content-Type: application/json

{ "email": "amel.benali@example.invalid" }
```

Réponse `202` : `{ "ok": true, "expiresAt": "2026-09-17T12:10:00.000Z" }`. Un code à six chiffres part par mail, valable dix minutes, cinq essais, un seul code actif par adresse (une nouvelle demande annule le précédent). La réponse est la même que l'adresse soit connue ou non : c'est aussi le chemin de l'inscription.

Quotas : trois demandes par quart d'heure pour une même adresse, trente par adresse IP ; au-delà, `429 rate_limited` avec `Retry-After` (secondes).

### 2.2 Échanger le code contre une session

```http
POST /api/v1/auth/session
Content-Type: application/json

{ "email": "amel.benali@example.invalid", "code": "042917" }
```

- Adresse connue : `200` et un objet `Session` :

  ```json
  {
    "token": "…jeton opaque…",
    "expiresAt": "2027-03-16T12:00:00.000Z",
    "created": false,
    "customer": {
      "id": "…",
      "fullName": "Amel Benali",
      "loyalty": {
        "count": 3,
        "threshold": 8,
        "rewardReady": false,
        "remaining": 5,
        "discountPercent": 15
      },
      "tier": {
        "tier": "basic",
        "label": "Basique",
        "since": null,
        "until": null
      },
      "nextDiscount": null,
      "…": "…"
    }
  }
  ```

  Le jeton n'est remis **qu'une fois** : à ranger dans le stockage sécurisé du téléphone. Il ne sert qu'en en-tête `Authorization: Bearer <jeton>`.

- Adresse inconnue **sans** `signup` : `404 signup_required`. Le code reste valable : l'application affiche son formulaire d'inscription, puis renvoie le **même** code avec le profil.
- Adresse inconnue **avec** `signup` : `201`, compte créé et session ouverte (`created: true`).

  ```json
  {
    "email": "nadia.lemaire@example.invalid",
    "code": "042917",
    "signup": {
      "fullName": "Nadia Lemaire",
      "phone": "06 39 98 00 42",
      "addressLine": "3 rue des Vignes",
      "city": "Paris",
      "postalCode": "75012",
      "consents": { "offers": true, "orderStatus": true, "marketing": false },
      "referralCode": "Benali#0001",
      "communityId": "com-0001"
    }
  }
  ```

  `addressLine` peut être `null` (elle sera exigée pour commander en livraison à domicile). `referralCode` est le code d'un parrain (`422 referral_code_unknown` s'il n'existe pas) ; `communityId` une communauté **publique** de `GET /communautes` (`422 community_not_joinable` sinon). Les trois autorisations sont datées par le serveur : c'est la preuve du consentement. Le code de parrainage de la personne (`Nom#0000`) est attribué à l'inscription.

Erreurs de code : `401 code_invalid` (faux, expiré, déjà utilisé), `401 code_locked` après cinq codes faux (redemander un code), `403 account_closed` pour un compte effacé (RGPD), `409 email_taken` si l'adresse s'est inscrite entre-temps.

### 2.3 Se déconnecter

`DELETE /api/v1/auth/session` avec le jeton : `204`. Le jeton est révoqué ; toute requête suivante répond `401 unauthenticated` (en-tête `WWW-Authenticate: Bearer`). Même réponse pour un jeton expiré : l'application redemande alors un code.

## 3. Lectures publiques (sans jeton)

| Route                  | Contenu                                                                                                                                                                                                                                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /catalogue`       | produits visibles avec `saleStatus` (`en_vente`, `rupture`, `indisponible`) et `stockQuantity`, paramètre `settings.sellWhenOutOfStock`, barème des frais (`deliveryFeeTiers`), paliers de remise de communauté, seuil et taux de fidélité, débuts de créneau réservables (`deliverySlotStarts`), horizon de réservation (`bookingHorizonDays`) |
| `GET /articles?limit=` | articles « à lire » visibles et parus, les plus récents d'abord (50 par défaut, 100 au plus)                                                                                                                                                                                                                                                    |
| `GET /articles/{id}`   | un article ; `404` s'il est masqué ou pas encore paru                                                                                                                                                                                                                                                                                           |
| `GET /communautes`     | communautés **publiques** et actives (nom, type, lieu de retrait, nombre de membres, taux de remise) ; jamais les coordonnées des référents, jamais une communauté privée                                                                                                                                                                       |

Ces réponses portent `Cache-Control: public, max-age=60, stale-while-revalidate=300` et un `ETag`. Renvoyer `If-None-Match: <etag>` : `304` sans corps quand rien n'a changé. Un produit **s'achète** quand `saleStatus` vaut `en_vente` ; en `rupture`, il reste affiché mais refusé au devis (sauf si `sellWhenOutOfStock` est vrai, auquel cas le statut reste `en_vente`).

## 4. Profil (`/me`, jeton requis)

- `GET /me` : la fiche (`Customer`) : coordonnées, `consents` et leur date, `community` (avec son taux), `referralCode`, `referredBy` (nom du parrain saisi), `referralCount`, `loyalty` (compteur cumulé sur huit, remise prête), `tier` (basique ou fidèle, avec la période), `nextDiscount` (la remise que la prochaine commande obtiendra : fidélité, communauté ou aucune).
- `PATCH /me` : modification partielle (`fullName`, `phone`, `addressLine`, `city`, `postalCode`, `consents`). `consents` remplace les trois autorisations ensemble et date le choix. L'e-mail ne se modifie pas : c'est l'identifiant. Corps vide : `422`.
- `PUT /me/communaute { "communityId" }` : rejoindre une communauté publique ; `DELETE /me/communaute` : la quitter. Réponse : la fiche à jour. Une communauté privée s'intègre sur invitation, hors de l'API pour l'instant (question 28).
- `GET /me/notifications?limit=&cursor=` : les notifications d'état déposées pour la personne (titre, texte, commande, statut, dépôt, envoi), les plus récentes d'abord.

Toutes les réponses authentifiées portent `Cache-Control: private, no-store`.

## 5. Commandes (jeton requis)

### 5.1 Devis

```http
POST /api/v1/commandes/devis
Authorization: Bearer <jeton>

{ "lines": [ { "productId": "prd-0001", "quantity": 1500 }, { "productId": "prd-0006", "quantity": 2 } ] }
```

Réponse `200` (`Quote`) : les lignes avec le nom et le prix instantanés (`unitPriceCents`, `lineTotalCents`), `subtotalCents`, `discount` (la meilleure remise : fidélité si elle est prête, sinon celle de la communauté, jamais les deux), `deliveryFeeCents` (barème sur le panier avant remise ; 0 pour un membre de communauté), `totalCents`, `community`.

Règles de prix (celles du dashboard, `src/domain/orders/quote.ts`) : `lineTotalCents` = prix au kilo × grammes / 1000 arrondi au centime, ou prix à la pièce × pièces ; la remise porte sur les produits, les frais s'ajoutent après ; frais 4,90 € sous 5 €, 3,90 € dès 5 €, 2,90 € dès 10 €, 1,90 € dès 20 € ; quantité maximale par ligne 100 000 g ou 500 pièces, cinquante lignes au plus.

`422 quote_invalid` quand une ligne est refusée ; `details.problems` liste **toutes** les lignes fautives avec un code (`unknown_product`, `not_for_sale`, `stock_insufficient`, `quantity_too_large`, `duplicate_line`) et un message. Le stock n'est pas réservé ni décrémenté par la commande (question 27).

### 5.2 Créer une commande

La commande est **payée dans l'application** avant l'appel ; le dashboard ne touche pas au paiement. Il recalcule le devis et refuse un total différent de celui payé.

```http
POST /api/v1/commandes
Authorization: Bearer <jeton>
Idempotency-Key: 8f1c2d9e-4b6a-4f2e-9c1a-7d3e5b2a1c0f

{
  "lines": [ { "productId": "prd-0001", "quantity": 1500 } ],
  "deliverySlot": { "date": "2026-09-18", "start": "14:00" },
  "expectedTotalCents": 925,
  "paymentReference": "pay_3K9…"
}
```

Réponse `201` (`Order`) : `id`, `reference` (« FIG-AAMMJJ-NNN », jour de livraison et rang du jour), `status: "preparing"`, créneau, adresse de livraison (la rue du profil, ou le lieu de retrait de la communauté), lignes, `subtotalCents`, `discount`, `deliveryFeeCents`, `totalCents`, `paymentReference`, `cancellable: true`. L'équipe la voit aussitôt dans le dashboard.

Refus :

| Code                       | Statut | Quand                                                                                                                                                |
| -------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `idempotency_key_required` | 400    | en-tête absent                                                                                                                                       |
| `quote_invalid`            | 422    | panier refusé (`details.problems`)                                                                                                                   |
| `slot_unavailable`         | 422    | créneau hors règle : une heure pile de 10:00 à 19:00, d'aujourd'hui (au moins deux heures après l'heure courante, heure de Paris) à trente jours     |
| `address_required`         | 422    | livraison à domicile sans rue dans le profil (`PATCH /me` d'abord)                                                                                   |
| `total_mismatch`           | 409    | `expectedTotalCents` ≠ total recalculé (prix ou remise changés depuis le devis) ; `details.quote` est le devis à jour, à refaire payer ou à afficher |
| `idempotency_key_reused`   | 422    | même clé, autre corps                                                                                                                                |
| `idempotency_in_progress`  | 409    | même clé encore en cours de traitement (deux envois simultanés) : réessayer dans un instant                                                          |

### 5.3 Suivre et annuler

- `GET /commandes?limit=&cursor=` : mes commandes, les plus récentes d'abord.
- `GET /commandes/{id}` : une commande ; celle d'un autre client répond `404`.
- `POST /commandes/{id}/annulation { "detail"? }` : annulation par la personne, possible tant que la commande est **en préparation** (`cancellable`). Motif « Annulée par le client », précision facultative (100 caractères). `409 not_cancellable` ensuite : l'équipe est le recours. Rejouer l'annulation renvoie `200` sans effet.

Les statuts (`status` / `statusLabel`) : `preparing` En préparation, `delivering` Expédiée, `delivered` Livrée, `cancelled` Annulée. Les changements faits par l'équipe déposent une notification pour la personne si elle l'a autorisé (`consents.orderStatus`).

## 6. Messages « Nous contacter » (jeton requis)

- `POST /messages` (avec `Idempotency-Key`) : `subject` parmi `missing_or_damaged`, `delivery_issue`, `order_error`, `product_question`, `refund`, `other` ; `body` (4 000 caractères) ; `orderId` facultatif, qui doit être une commande de la personne (`422 order_not_owned`) ; `fileIds` : dix au plus, identifiants de fichiers déjà téléversés par `POST /fichiers`, dans l'ordre d'affichage ; chacun doit être à la personne et n'être joint à aucun autre message, sinon `422 attachment_unavailable` (`details.fileIds`) et rien n'est créé. L'ancienne forme `attachments` (métadonnées et URL chez l'application) est **refusée** (`422 validation_failed`), jamais ignorée : aucune pièce jointe ne se perd en silence. Réponse `201` (`Message`) ; chaque pièce jointe porte `fileId` et `url` = `/api/v1/fichiers/{id}`.
- `POST /fichiers` (avec `Idempotency-Key`, 2026-09-18, question 22 tranchée : **le dashboard héberge les fichiers**, dans PostgreSQL) : un fichier par appel, en `multipart/form-data`, champ `fichier`, `Content-Length` obligatoire (`411 length_required`). PDF ou image (JPEG, PNG, GIF, WebP, AVIF, HEIC, HEIF, TIFF, BMP ; ni vidéo, ni audio, ni SVG), **5 Mo au plus** (`413 payload_too_large`, refusé sur l'en-tête avant lecture). Le format annoncé doit être celui que révèlent les premiers octets (`422 content_type_mismatch`) : un fichier renommé ne passe pas. Fichier vide : `422 file_empty` ; format hors liste : `415 unsupported_media_type`. Vingt fichiers en attente (jamais joints) au plus par personne (`429 upload_quota_exceeded`) ; un fichier jamais joint est supprimé après 24 heures par `npm run rgpd:purge`. Réponse `201` (`Upload` : `id`, `fileName` nettoyé, `contentType`, `sizeBytes`, `url`, `createdAt`), à citer ensuite dans `fileIds`.
- `GET /fichiers/{id}` : un de MES fichiers, ses octets avec leur type ; `404` pour celui d'une autre personne comme pour un inconnu. Une image s'affiche (`inline`), un PDF, un HEIC ou un HEIF se télécharge (`attachment`) ; `X-Content-Type-Options: nosniff`, jamais en cache partagé (`private, no-store`).
- `GET /messages?limit=&cursor=` : mes demandes, les plus récentes d'abord, avec `status` (`untreated` / `treated`) et `handledAt`. Les marques internes de l'équipe (épingle, important, nom du traitant) ne sont jamais exposées.

## 7. Serveur de l'application (clé de service)

Le dashboard **dépose** une notification d'état à chaque changement de statut fait par l'équipe, pour les clients qui l'ont autorisé, mais n'a aucun canal vers le téléphone. Le serveur de l'application les envoie (question 23) :

1. `GET /service/notifications?limit=` (100 par défaut, 500 au plus) : la file à envoyer, dans l'ordre de dépôt, avec `customerId`, `orderId`, `orderReference`, `orderStatus`, `title`, `body`.
2. Envoi par son canal (notification du téléphone, SMS…).
3. `POST /service/notifications/{id}/envoi` : accusé d'envoi, qui pose `sentAt` une seule fois (`409 already_sent` ensuite, `404` si inconnue) ; il efface un échec déclaré plus tôt.
4. Si l'envoi échoue : `POST /service/notifications/{id}/echec { "raison"? }` (cause courte facultative, 200 caractères). La notification sort de la file ; le back-office, qui attend l'accusé à côté du badge « Client notifié », affiche « Échec d'envoi de la notification » et propose de réessayer, ce qui la remet dans la file (elle revient alors dans `GET /service/notifications`). `409 already_sent` ou `409 already_failed`, `404` si inconnue. Sans accusé ni échec sous 90 secondes, le back-office annonce aussi l'échec : le serveur de l'application doit donc relever la file souvent (quelques secondes).

En-tête `Authorization: Bearer <API_SERVICE_KEY>`. Sans clé configurée sur le serveur, ces routes répondent `503 service_unavailable`. Un jeton de client y est refusé (`401`).

## 8. Erreurs, limites, cache, CORS

**Forme.** `{ "error": { "code": "validation_failed", "message": "Requête invalide : vérifiez les champs signalés.", "details": { "issues": [ { "path": "lines.1.quantity", "message": "…" } ] } } }`. Codes possibles : `bad_request`, `unauthenticated`, `forbidden`, `not_found`, `method_not_allowed`, `conflict`, `payload_too_large`, `unsupported_media_type`, `validation_failed`, `rate_limited`, `idempotency_key_required`, `idempotency_key_reused`, `idempotency_in_progress`, `code_invalid`, `code_locked`, `signup_required`, `email_taken`, `referral_code_unknown`, `community_not_joinable`, `account_closed`, `quote_invalid`, `slot_unavailable`, `address_required`, `total_mismatch`, `not_cancellable`, `order_not_owned`, `already_sent`, `already_failed`, `service_unavailable`, `internal_error`. Un `500` ne contient jamais de détail.

**Idempotence.** Clé de 8 à 128 caractères (`A-Z a-z 0-9 _ -`), un UUID v4 convient, une par création tentée. La réponse est mémorisée vingt-quatre heures : la même clé avec le même corps la rejoue à l'identique (en-tête `Idempotent-Replayed: true`), même après une coupure réseau. Un échec (422, 409…) rend la clé : corriger et réessayer avec la même clé est permis.

**Listes.** `?limit=` (20 par défaut, 50 au plus) et `?cursor=` : la réponse `{ "items": [...], "nextCursor": "…" | null }` ; passer `nextCursor` tel quel pour la page suivante, jusqu'à `null`. Un curseur invalide ramène à la première page.

**Débit.** 600 requêtes par minute et par adresse IP, 120 par minute et par session ; au-delà `429 rate_limited` avec `Retry-After`. Ces compteurs sont par instance de serveur ; les quotas des codes de connexion sont, eux, partagés en base.

**Cache.** Lectures publiques : `ETag` et cache d'une minute (voir section 3). Réponses authentifiées : `private, no-store`.

**CORS.** Une application **web** doit être servie depuis une origine listée dans `API_CORS_ORIGINS` (dashboard) ; les en-têtes autorisés sont `Authorization`, `Content-Type`, `Idempotency-Key`, `If-None-Match`, exposés `ETag`, `Retry-After`, `Idempotent-Replayed`. Une application native n'a pas besoin de CORS.

## 9. Côté dashboard : configuration et exploitation

| Variable           | Rôle                                                                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `AUTH_SECRET`      | déjà présent : clé du HMAC des codes et des jetons (seuls les HMAC sont en base)                                                     |
| `API_SERVICE_KEY`  | clé du serveur de l'application (32 caractères au moins ; `npx auth secret`) ; facultative, sans elle les routes `/service` font 503 |
| `API_CORS_ORIGINS` | origines web autorisées, séparées par des virgules ; facultative                                                                     |
| `MAIL_*`           | déjà présents : les codes partent par le même transport que les mails du back-office (Brevo en production, fichier en développement) |

En développement (`MAIL_TRANSPORT=fichier`), le code de connexion se lit dans `dashboard/.mail/` (un JSON par mail). Le journal de sécurité trace `api_code_requested`, `api_code_failed`, `api_session_opened`, `api_order_created`, `api_order_cancelled`, `api_message_created`, `api_notification_sent`, `api_service_forbidden`, `api_rate_limited` (identifiants et adresses, jamais un code ni un jeton).

Tables (migration 0016) : `customer_login_codes` (codes, purgés un jour après expiration), `customer_sessions` (jetons, 180 jours, révocables, supprimés à l'anonymisation, purgés trente jours après), `api_idempotency_keys` (24 heures), `orders.payment_reference`. Le tout est décrit dans `docs/base-de-donnees.md` et à l'inventaire RGPD (`docs/rgpd.md`).

Tests : règles pures et vues contre les schémas de réponse (`test/domain/api`), routes de bout en bout sur la base de test (`test/app/api/v1`), parcours complet contre le serveur construit (`e2e/api.spec.ts`). `npm run api:openapi` régénère `docs/api/openapi.json` ; un test échoue si le fichier commité n'est plus celui du code.

## 10. Versions et points ouverts

Le préfixe `/api/v1` est le contrat. Un champ peut être **ajouté** sans changer de version ; un champ retiré, renommé ou une règle durcie donnent un `/api/v2` servi en parallèle le temps de la migration des applications.

Restent à décider avec le client (backlog) :

- **question 27** : le stock doit-il être décrémenté à la commande (et restitué à l'annulation) ? Aujourd'hui, il borne seulement la quantité commandable ;
- **question 28** : l'adhésion à une communauté **privée** (invitation : par qui, sous quelle forme) ;
- **question 29** : le fournisseur d'identité de l'application, si elle en a déjà un (l'API vérifierait alors ses jetons au lieu de délivrer les siens), le domaine web pour CORS, et la remise de la clé de service à l'hébergeur de l'application.
