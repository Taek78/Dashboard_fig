# Contrat de données : ce que le front consomme

Pour chaque domaine, le contrat `src/domain/<domaine>/source.ts` liste les fonctions que les pages et les Server Actions appellent par la façade `src/data/<domaine>.ts`. Il est implémenté par PostgreSQL via Drizzle (`<domaine>.db.ts`, colonnes de `src/db/schema.ts`), qui renvoie des types métier ; les tests de `test/data/` exécutent chaque fonction sur une base de test seedée ; `src/db/mappers.ts` fait la conversion depuis les lignes, et `test/db/mappers.test.ts` vérifie l'aller-retour sur toutes les fixtures.

Conventions communes : montants en centimes entiers, quantités en grammes ou pièces selon `unit`, instants en ISO 8601, jours `AAAA-MM-JJ`, heures `HH:mm`. `null` signifie « introuvable » (cas métier normal), jamais une panne.

## Commandes (`OrdersSource`)

| Fonction                        | Entrées                                               | Sortie                                               | Notes                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOrders(filters?, options?)` | `query?`, `status?`, `from?`, `to?`, `preparerId?`, `driverId?`, `customerId?`, `communityId?`, `staffId?` ; `{ limit? }` | `Order[]` triées par jour, heure de début, référence | une requête (lignes en JSON) ; pour une liste bornée (tournée) ou les `limit` premières |
| `countOrders(filters)` | mêmes filtres | `number` | `COUNT(*)` |
| `getOrdersPage(filters, page, size?)` | mêmes filtres, numéro de page | `Page<Order>` (`items`, `page`, `pageCount`, `total`), les plus récentes d'abord | `COUNT` puis `LIMIT/OFFSET` ; numéro ramené dans les bornes (`pageWindow`) |
| `getOrderStats(range)` | `{ from, to }` | `OrderStats` : KPI, nombre par statut, part des communautés, acheteurs distincts | une requête agrégée ; arrondis de `statsFromTotals` |
| `getOrderSeries(range, bucket)` | plage, `day \| week \| month` | `SeriesPoint[]`, seaux vides compris | `GROUP BY` du premier jour du seau ; `fillSeries` |
| `getTopProducts(range, limit)` | plage, nombre | `ProductPoint[]` | lignes des commandes non annulées groupées par produit ; `rankProducts` |
| `getStaffWorkSummaries()` | | `Map<staffId, StaffWorkSummary>` | affectées, préparées, livrées, en cours, dernière activité |
| `getStaffWorkSummary(staffId)` | identifiant | `StaffWorkSummary` (zéros sans commande) | index préparateur et livreur |
| `getDeliveryDayCounts(range)` | `{ from, to }` | `Map<jour, nombre>` | raccourcis des 7 derniers jours de la liste des commandes |
| `getDirectoryStats(scope?)` | `{ customerId? , communityId? }` | `DirectoryStats` : chiffres par client, par communauté, compteur de fidélité, date de la dernière catégorie « fidèle », membres par communauté | quatre requêtes agrégées (fenêtres pour la fidélité), tout l'annuaire ou une fiche ; `loyaltyFromCount`, `tierFromReachedAt` |
| `getCustomerTierEvents(customerId)` | `id` du client | `TierEvent[]` du plus ancien au plus récent | l'historique daté des atteintes « fidèle » (huitième commande de chaque cycle) ; même règle que `loyalTierEvents` |
| `getOrder(id)`                  | `id`                                                  | `Order \| null`                                      |                                                                                                                                                                               |
| `updateOrderStatus(id, change)` | `{ from, to, actor, cancellation, notification }`     | `Order \| null`                                      | conditionnelle : `null` si le statut n'est plus `from` ; écrit l'événement d'historique dans la même transaction, puis dépose `notification` dans `customer_notifications` **seulement si** `customers.notify_order_status` ; `cancellation` posé sur la commande quand `to = cancelled` |
| `getOrderEvents(orderId)`       | `orderId`                                             | `OrderEvent[]` du plus récent au plus ancien         |                                                                                                                                                                               |

`Order` : `id`, `reference` (unique), `createdAt`, `status` (`preparing | delivering | delivered | cancelled`), `customer { id, fullName, email, phone }`, `deliverySlot { date, start, end }` (une heure pile), `deliveryAddressLine | null` (rue, instantané), `deliveryCity`, `deliveryPostalCode`, `lines[] { productId, productName, quantity, unit, lineTotalCents }` (instantané au moment de l'achat), `deliveryFeeCents` (0 pour une communauté), `totalCents` (lignes − remise + frais), `cancellation { reason, detail } | null`.

`OrderEvent` : `id`, `orderId`, `from`, `to`, `actor { id, name }`, `cancellation | null`, `at`.

Sources de vérité côté application FIG, à respecter au branchement :

- la **remise** (`discount`) est celle réellement appliquée au **paiement** dans l'application ; le dashboard l'affiche et ne la calcule jamais. Il annonce ce qu'il attend : le taux d'une communauté selon ses membres (rien jusqu'à 3, −5 % de 4 à 9, −10 % dès 10), la fidélité −15 % à la commande qui suit huit commandes cumulées, et **la plus forte des deux seulement** ;
- les **frais de livraison** (`deliveryFeeCents`) sont ceux facturés par l'application, au barème du panier avant remise (4,90 € sous 5 €, 3,90 € dès 5 €, 2,90 € dès 10 €, 1,90 € dès 20 €), toujours 0 pour une communauté (la base le refuse sinon) ;
- le **créneau** (`deliverySlot`) est d'une heure pile entre 10:00 et 20:00, dernier créneau 19:00 → 20:00 (la base refuse le reste) ; pour une commande de communauté, c'est l'horaire de retrait choisi par le client **à chaque commande**, une communauté n'a pas d'heure fixe ;
- la **rue de livraison** (`deliveryAddressLine`) est copiée sur la commande par l'application (celle du client, ou le lieu de retrait) ;
- une commande reçue est **en préparation** d'emblée (ni « confirmée » ni « en attente ») ; elle passe à **expédiée** (`delivering`) puis **livrée** ; l'annulation, avec motif, n'est possible qu'en préparation.

## Livraisons

Pas de source propre ni de section à part (fondue dans Commandes le 2026-09-16) : la tournée est la liste des commandes filtrée sur un jour (`?du=&au=`, une seule date = ce jour-là), avec des règles pures (`recentDeliveryDays`, `tourProgress`, `nextDeliveryStep`, `itineraryUrl`). La recherche libre des commandes (`matchesOrderQuery`) est reproduite en SQL (sans accents, chiffres du téléphone) et testée contre la règle pure ; les raccourcis des 7 derniers jours viennent de `getDeliveryDayCounts`. Les colonnes `search_text` et `phone_digits` sont calculées par la base : l'application FIG ne les écrit jamais. L'itinéraire utilise la rue de livraison quand la commande la porte ; coordonnées GPS et instructions d'accès restent à décider (question 13).

Règle des périodes « du / au », commune à toutes les recherches par dates (`readDateRange`, `src/lib/days.ts`) : une seule date = ce jour-là ; `du` ≤ `au` (même jour compris) = la période ; inversées = aucune période, l'écran l'annonce. Un lien vers l'application qui porte `?du=` seul reste donc valide.

## Catalogue (`ProductsSource`)

| Fonction                   | Entrées                                                  | Sortie                    | Notes                                                              |
| -------------------------- | -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| `getProducts(filters?)`    | `category?`, `query?`, `availability?`, `includeHidden?` | `Product[]` triés par nom | recherche sans accents appliquée en mémoire après chargement       |
| `getProduct(id)`           | `id`                                                     | `Product \| null`         |                                                                    |
| `createProduct(input)`     | `ProductInput`                                           | `Product`                 | id généré, `updatedAt` posé                                        |
| `updateProduct(id, input)` | `id`, `ProductInput`                                     | `Product \| null`         |                                                                    |
| `deleteProduct(id)`        | `id`                                                     | `boolean`                 | les lignes de commande ne référencent pas la table : rien ne casse |
| `getCatalogSettings()`     | —                                                        | `CatalogSettings`         | ligne unique de `catalog_settings` ; valeurs par défaut si absente |
| `updateCatalogSettings(s)` | `{ sellWhenOutOfStock }`                                 | `CatalogSettings`         | insertion ou mise à jour de la ligne unique                        |

`Product` : `name`, `variety`, `category` (`fruit | vegetable`), `unit` (`piece | g`), `priceCents` (par kg si `g`, par pièce sinon), `unitWeightGrams` (pièce seulement ; le prix au kilo s'en déduit), `container`, `originCountry` (ISO2), `originRegion`, `caliber { minMm, maxMm } | null`, `organic`, `inSeason`, `available`, `visible`, `stockQuantity`, `illustration` (emoji), `imageUrl` (https), `updatedAt`. La conversion euros → centimes est faite par zod (`productInputSchema`), jamais en base.

Un produit **s'achète** dans l'application si son statut de vente est « en vente » (`productSaleStatus`) : `visible`, `available`, et un stock supérieur à 0 **sauf** si `catalog_settings.sell_when_out_of_stock` est vrai (paramètre posé depuis le catalogue du dashboard). L'application doit lire ce paramètre plutôt que de supposer qu'un stock à 0 bloque la vente. Le filtre `availability` de `getProducts` suit la même règle.

## Clients (`CustomersSource`)

| Fonction                    | Entrées                           | Sortie                     | Notes                                                                        |
| --------------------------- | --------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `getCustomers(query?)`      | texte libre                       | `Customer[]` triés par nom | recherche nom, e-mail, chiffres du téléphone, en mémoire après chargement    |
| `getCustomer(id)`           | `id`                              | `Customer \| null`         | avec ses notes, de la plus ancienne à la plus récente, et son parrain        |
| `getCustomerReferrals(customerId)` | `id` du client             | `CustomerReferral[]`       | ses filleuls (ceux qui ont saisi son code), du plus ancien au plus récent ; fiche seulement |
| `getSignupStats(range)`     | `{ from, to }`                    | `{ signups, referred }`    | inscrits de la période (jour UTC de `created_at`) et, parmi eux, ceux qui portent un parrain ; métriques « Nouveaux clients » et « Parrainages », même règle que `signupStats` |
| `addNote(customerId, note)` | `{ text, authorName, createdAt }` | `CustomerNote \| null`     | auteur et date viennent de l'action (session, horloge), jamais du formulaire |

`Customer` : `id`, `fullName`, `email`, `phone`, `addressLine | null` (rue), `city`, `postalCode`, `createdAt`, `community | null`, `consents { offers, orderStatus, marketing, updatedAt | null }`, `referralCode | null` (« Nom#0000 », unique), `referredBy { id, fullName } | null`, `notes[] { id, text, authorName, createdAt }`, `anonymizedAt` (ISO ou `null`). Données personnelles au sens du RGPD ; les notes internes ne sont jamais visibles de la personne dans l'application, mais figurent dans l'export de ses données. Un client anonymisé a un nom neutre, un e-mail `anonyme-<id>@anonyme.invalid`, un téléphone vide, ni rue, ni code, ni parrain, ni autorisation : l'application FIG ne doit ni le réécrire ni le recréer depuis sa copie (question 19). La section Clients assemble particuliers et communautés en un annuaire (`buildDirectory`, `filterDirectory`, `sortDirectory`) à partir des chiffres agrégés par la base (`getDirectoryStats`).

Sources de vérité côté application FIG, à respecter au branchement :

- les **autorisations** sont recueillies et datées (`consents_updated_at`) par l'application ; le dashboard les lit, ne les modifie jamais, et n'envoie rien lui-même ;
- le **code de parrainage** est attribué par l'application (format `Nom#0000`, unique, vérifié par la base) ; `referred_by_id` est le client dont le code a été saisi à l'inscription ; un client ne peut pas se parrainer lui-même ;
- la **catégorie** (basique, fidèle) et le **compteur de fidélité** ne sont pas stockés : le dashboard les déduit des commandes ; l'application applique la remise fidélité à la commande qui suit huit commandes cumulées (annulées non comptées).

## Notifications d'état (`NotificationsSource`)

| Fonction                              | Entrées          | Sortie                    | Notes                                                              |
| ------------------------------------- | ---------------- | ------------------------- | ------------------------------------------------------------------ |
| `getOrderNotifications(orderId)`      | `id` de commande | `CustomerNotification[]`  | de la plus récente à la plus ancienne (fiche commande)             |
| `getCustomerNotifications(customerId)`| `id` du client   | `CustomerNotification[]`  | toutes, de la plus ancienne à la plus récente (export RGPD)        |

`CustomerNotification` : `id`, `customerId`, `order { id, reference }`, `kind` (`order_status`), `orderStatus`, `title`, `body`, `createdAt` (dépôt), `sentAt | null` (envoi). Le contrat n'a pas d'écriture : le dépôt se fait dans `updateOrderStatus`, dans la transaction du statut.

Ce que l'application FIG doit faire (question 23) : lire régulièrement les lignes dont `sent_at` est vide (index `customer_notifications_pending_idx`, dans l'ordre de dépôt), envoyer par son canal, puis poser `sent_at`. Le texte est prêt à envoyer (`title`, `body`), en français, sans le nom de la personne.

## Messages « Nous contacter » (`MessagesSource`)

Les messages sont **écrits par l'application FIG** : le contrat n'a aucune fonction de création ni de modification du contenu. Le dashboard ne pose que trois marques de l'équipe, toutes en écriture conditionnelle (`null` = rien d'écrit, quelqu'un a agi entre l'affichage et le clic).

| Fonction                              | Entrées                                                        | Sortie             | Notes                                                                                     |
| ------------------------------------- | -------------------------------------------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| `getMessagesPage(filters, page, size?)` | `query?`, `status?`, `subject?`, `from?`, `to?`, `important?`, `customerId?` | `Page<Message>`    | épinglés d'abord puis les plus récents ; `COUNT` et `LIMIT/OFFSET` par la base             |
| `countMessages(filters)`              | mêmes filtres                                                  | `number`           | le compteur « non traités » de l'en-tête                                                   |
| `countComplaints(range)`              | `{ from, to }`                                                 | `number`           | métrique « Réclamations » : messages reçus sur la période dont l'objet est dans `CLAIM_SUBJECTS` (produit manquant ou abîmé, problème de livraison, erreur sur la commande, remboursement ou avoir), quel que soit le statut ; même règle que `countComplaints` du domaine |
| `getMessage(id)`                      | `id`                                                           | `Message \| null`  | une requête : auteur et commande joints, pièces jointes en JSON                            |
| `getCustomerMessages(customerId)`     | `id` du client                                                 | `Message[]`        | tout, du plus ancien au plus récent ; pour l'export RGPD, jamais paginé                    |
| `setMessageStatus(id, change)`        | `{ from, to, actor, at }`                                      | `Message \| null`  | `WHERE status = from` ; écrit aussi qui a traité et quand                                  |
| `setMessagePinned(id, change)`        | `{ from, to, at }`                                             | `Message \| null`  | `WHERE pinned_at IS [NOT] NULL` selon `from`                                                |
| `setMessageImportant(id, change)`     | `{ from, to }`                                                 | `Message \| null`  | `WHERE important = from`                                                                    |

`Message` : `id`, `customer { id, fullName, email }`, `subject` (`missing_or_damaged | delivery_issue | order_error | product_question | refund | other`), `body` (texte brut), `order | null` (contexte joint par le client : `id`, `reference`, `createdAt`, `status`, `deliverySlot`, `deliveryAddressLine`, `deliveryCity`, `deliveryPostalCode`, `community`, `preparer`, `driver`), `attachments[] { id, fileName, contentType, sizeBytes, url }` (dix au plus), `status` (`untreated | treated`), `receivedAt`, `pinnedAt | null`, `important`, `handledAt | null`, `handledByName | null`.

Sources de vérité côté application FIG, à respecter au branchement :

- le **contenu** d'un message (objet, corps, commande citée, pièces jointes) est écrit par l'application ; le dashboard ne le modifie jamais ;
- les **fichiers** joints sont hébergés par l'application, qui écrit ici leur `url` (question 22) ; le dashboard n'en garde que les métadonnées ;
- la base refuse tout format hors liste blanche (PDF et images ; ni vidéo ni audio) et toute onzième pièce jointe : ces gardes tiennent même si l'application écrit en SQL direct ;
- `search_text` est calculée par la base : l'application ne l'écrit jamais.

## Données personnelles (`PrivacySource`)

| Fonction                          | Entrées          | Sortie                                                          | Notes                                                                                                                 |
| --------------------------------- | ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `getCustomerExportData(id)`       | `id`             | `{ customer, orders, events, messages, notifications, referralCount } \| null` | tout ce que la base garde sur la personne, borné par elle, jamais paginé ; mis en forme par `buildCustomerExport` (catégorie et historique déduits des commandes) |
| `anonymizeCustomer(id, at)`       | `id`, instant    | `"anonymized" \| "already_anonymized" \| "open_orders" \| "not_found"` | une transaction conditionnelle (`anonymized_at IS NULL`, aucune commande en préparation ou expédiée) ; commandes conservées ; nettoyage des textes libres rejoué si déjà anonymisé |

Le script `npm run rgpd:purge` n'est pas dans le contrat : il appelle directement `purgeExpiredData` (`src/db/privacy.ts`), hors de Next.

## Articles (`ArticlesSource`)

| Fonction                                                                  | Entrées        | Sortie                                    | Notes                                       |
| ------------------------------------------------------------------------- | -------------- | ----------------------------------------- | ------------------------------------------- |
| `getArticles()`                                                           |                | `Article[]` du plus récent au plus ancien | masqués et programmés compris (back-office) |
| `getArticle(id)`                                                          | `id`           | `Article \| null`                         |                                             |
| `createArticle(input)` / `updateArticle(id, input)` / `deleteArticle(id)` | `ArticleInput` | `Article`, `Article \| null`, `boolean`   |                                             |

`Article` : `title`, `body` (texte brut, paragraphes séparés par une ligne vide, 8 000 caractères au plus), `category` (`nutrition | recipe | science | news`), `illustration` (emoji), `imageUrl`, `publishedAt` (jour ; dans le futur = programmé), `visible`, `updatedAt`. Question 12 au client : format et hébergement des images dans l'application.

## Usage de l'application (`EngagementSource`)

`getEngagement()` → `EngagementPoint[]` par mois civil (`month "AAAA-MM"`, `downloads`, `signups`, `rating | null`, `ratingCount`). Source réelle à définir avec le client (question 11 : stores). Les réclamations ne viennent plus d'ici : elles se comptent dans les messages (`countComplaints`, colonne supprimée par la migration 0010).

## Comptes (`UsersSource`)

| Fonction                 | Entrées                               | Sortie                                       | Notes                                                                             |
| ------------------------ | ------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------- |
| `findUserByEmail(email)` | e-mail, sans casse                    | `UserAccount \| null`                        | avec le hachage, pour la vérification du mot de passe ; comptes désactivés exclus |
| `findUserById(id)`       | `id`                                  | `UserAccount \| null`                        | pour le changement de son propre mot de passe                                     |
| `listUsers()`            |                                       | `ManagedUser[]` actifs d'abord, puis par nom | jamais le hachage                                                                 |
| `getUser(id)`            | `id`                                  | `ManagedUser \| null`                        |                                                                                   |
| `createUser(input)`      | `{ email, name, role, passwordHash }` | `ManagedUser \| "email_taken"`               |                                                                                   |
| `updateUser(id, patch)`  | `{ name?, role?, active? }`           | `ManagedUser \| null`                        | les règles (dernier admin, soi-même) sont dans l'action                           |
| `setPassword(id, hash)`  |                                       | `boolean`                                    |                                                                                   |

Les comptes viennent de la table `users` : créés par `npm run db:seed` (`AUTH_BOOTSTRAP_*`, `AUTH_MANAGER_*` de `.env.local`), puis gérés sur l'écran `/comptes`.

## Session

`getCurrentUser()` (`src/data/session.ts`) → `CurrentUser { id, name, role }` depuis la session Auth.js, ou redirection vers `/connexion`. Toute page et toute action commencent par là.

## Ce que le front n'utilise jamais

Adresse de rue, mots de passe ou jetons de l'application FIG, coordonnées bancaires. Si la base en contient un jour, aucune fonction ci-dessus ne les renverra.
