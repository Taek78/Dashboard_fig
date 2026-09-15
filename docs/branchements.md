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
| `getDeliveryDayCounts(range)` | `{ from, to }` | `Map<jour, nombre>` | raccourcis de la tournée |
| `getDirectoryStats(scope?)` | `{ customerId? , communityId? }` | `DirectoryStats` : chiffres par client, par communauté, série de fidélité | trois requêtes agrégées, tout l'annuaire ou une fiche ; `loyaltyFromStreak` |
| `getOrder(id)`                  | `id`                                                  | `Order \| null`                                      |                                                                                                                                                                               |
| `updateOrderStatus(id, change)` | `{ from, to, actor, cancellation }`                   | `Order \| null`                                      | conditionnelle : `null` si le statut n'est plus `from` ; écrit l'événement d'historique dans la même transaction ; `cancellation` posé sur la commande quand `to = cancelled` |
| `getOrderEvents(orderId)`       | `orderId`                                             | `OrderEvent[]` du plus récent au plus ancien         |                                                                                                                                                                               |

`Order` : `id`, `reference` (unique), `createdAt`, `status` (`preparing | delivering | delivered | cancelled`), `customer { id, fullName, email, phone }`, `deliverySlot { date, start, end }`, `deliveryCity`, `deliveryPostalCode`, `lines[] { productId, productName, quantity, unit, lineTotalCents }` (instantané au moment de l'achat), `totalCents`, `cancellation { reason, detail } | null`.

`OrderEvent` : `id`, `orderId`, `from`, `to`, `actor { id, name }`, `cancellation | null`, `at`.

Sources de vérité côté application FIG, à respecter au branchement :

- la **remise** (`discount`) est celle réellement appliquée au **paiement** dans l'application ; le dashboard l'affiche et ne la calcule jamais (le taux d'une communauté n'est qu'annoncé) ;
- le **créneau** (`deliverySlot`) d'une commande de communauté est l'horaire de retrait choisi par le client **à chaque commande** ; une communauté n'a pas d'heure fixe ;
- une commande reçue est **en préparation** d'emblée (ni « confirmée » ni « en attente ») ; elle passe à **expédiée** (`delivering`) puis **livrée** ; l'annulation, avec motif, n'est possible qu'en préparation.

## Livraisons

Pas de source propre : la tournée est `getOrders({ from, to, … })` sur 7 jours au plus et des règles pures (`tourRange`, `groupOrdersByDay`, `recentDeliveryDays`, `tourProgress`, `nextStopIndex`, `nextDeliveryStep`, `itineraryUrl`). La recherche libre des commandes (`matchesOrderQuery`) est reproduite en SQL (sans accents, chiffres du téléphone) et testée contre la règle pure ; les raccourcis des 7 derniers jours viennent de `getDeliveryDayCounts`. Les colonnes `search_text` et `phone_digits` sont calculées par la base : l'application FIG ne les écrit jamais. L'adresse de rue n'existe pas encore (question 13).

## Catalogue (`ProductsSource`)

| Fonction                   | Entrées                                                  | Sortie                    | Notes                                                              |
| -------------------------- | -------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------ |
| `getProducts(filters?)`    | `category?`, `query?`, `availability?`, `includeHidden?` | `Product[]` triés par nom | recherche sans accents appliquée en mémoire après chargement       |
| `getProduct(id)`           | `id`                                                     | `Product \| null`         |                                                                    |
| `createProduct(input)`     | `ProductInput`                                           | `Product`                 | id généré, `updatedAt` posé                                        |
| `updateProduct(id, input)` | `id`, `ProductInput`                                     | `Product \| null`         |                                                                    |
| `deleteProduct(id)`        | `id`                                                     | `boolean`                 | les lignes de commande ne référencent pas la table : rien ne casse |

`Product` : `name`, `variety`, `category` (`fruit | vegetable`), `unit` (`piece | g`), `priceCents` (par kg si `g`, par pièce sinon), `unitWeightGrams` (pièce seulement ; le prix au kilo s'en déduit), `container`, `originCountry` (ISO2), `originRegion`, `caliber { minMm, maxMm } | null`, `organic`, `inSeason`, `available`, `visible`, `stockQuantity`, `illustration` (emoji), `imageUrl` (https), `updatedAt`. La conversion euros → centimes est faite par zod (`productInputSchema`), jamais en base.

## Clients (`CustomersSource`)

| Fonction                    | Entrées                           | Sortie                     | Notes                                                                        |
| --------------------------- | --------------------------------- | -------------------------- | ---------------------------------------------------------------------------- |
| `getCustomers(query?)`      | texte libre                       | `Customer[]` triés par nom | recherche nom, e-mail, chiffres du téléphone, en mémoire après chargement    |
| `getCustomer(id)`           | `id`                              | `Customer \| null`         | avec ses notes, de la plus ancienne à la plus récente                        |
| `addNote(customerId, note)` | `{ text, authorName, createdAt }` | `CustomerNote \| null`     | auteur et date viennent de l'action (session, horloge), jamais du formulaire |

`Customer` : `id`, `fullName`, `email`, `phone`, `city`, `postalCode`, `createdAt`, `notes[] { id, text, authorName, createdAt }`. Données personnelles au sens du RGPD ; les notes internes ne sont jamais visibles de la personne. La section Clients assemble particuliers et communautés en un annuaire (`buildDirectory`, `filterDirectory`, `sortDirectory`) à partir des chiffres agrégés par la base (`getDirectoryStats`).

## Articles (`ArticlesSource`)

| Fonction                                                                  | Entrées        | Sortie                                    | Notes                                       |
| ------------------------------------------------------------------------- | -------------- | ----------------------------------------- | ------------------------------------------- |
| `getArticles()`                                                           |                | `Article[]` du plus récent au plus ancien | masqués et programmés compris (back-office) |
| `getArticle(id)`                                                          | `id`           | `Article \| null`                         |                                             |
| `createArticle(input)` / `updateArticle(id, input)` / `deleteArticle(id)` | `ArticleInput` | `Article`, `Article \| null`, `boolean`   |                                             |

`Article` : `title`, `body` (texte brut, paragraphes séparés par une ligne vide, 8 000 caractères au plus), `category` (`nutrition | recipe | science | news`), `illustration` (emoji), `imageUrl`, `publishedAt` (jour ; dans le futur = programmé), `visible`, `updatedAt`. Question 12 au client : format et hébergement des images dans l'application.

## Usage de l'application (`EngagementSource`)

`getEngagement()` → `EngagementPoint[]` par mois civil (`month "AAAA-MM"`, `downloads`, `signups`, `complaints`, `rating | null`, `ratingCount`). Source réelle à définir avec le client (question 11 : stores, support).

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
