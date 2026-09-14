# Contrat de données : ce que le front consomme

Pour chaque domaine, le contrat `src/domain/<domaine>/source.ts` liste les fonctions que les pages et les Server Actions appellent par la façade `src/data/<domaine>.ts`. Deux implémentations le respectent : les fixtures en mémoire (`<domaine>.mock.ts`) et PostgreSQL via Drizzle (`<domaine>.db.ts`, colonnes de `src/db/schema.ts`). Les deux renvoient les mêmes types métier ; `src/db/mappers.ts` fait la conversion depuis les lignes, et `test/db/mappers.test.ts` vérifie l'aller-retour sur toutes les fixtures.

Conventions communes : montants en centimes entiers, quantités en grammes ou pièces selon `unit`, instants en ISO 8601, jours `AAAA-MM-JJ`, heures `HH:mm`. `null` signifie « introuvable » (cas métier normal), jamais une panne.

## Commandes (`OrdersSource`)

| Fonction                        | Entrées                                               | Sortie                                               | Notes                                                                                                                                                                         |
| ------------------------------- | ----------------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getOrders(filters?)`           | `status?`, `date?` (jour de livraison), `customerId?` | `Order[]` triées par jour, heure de début, référence | filtres en `WHERE`, tri en `ORDER BY` ; lignes chargées en une seconde requête                                                                                                |
| `getOrder(id)`                  | `id`                                                  | `Order \| null`                                      |                                                                                                                                                                               |
| `updateOrderStatus(id, change)` | `{ from, to, actor, cancellation }`                   | `Order \| null`                                      | conditionnelle : `null` si le statut n'est plus `from` ; écrit l'événement d'historique dans la même transaction ; `cancellation` posé sur la commande quand `to = cancelled` |
| `getOrderEvents(orderId)`       | `orderId`                                             | `OrderEvent[]` du plus récent au plus ancien         |                                                                                                                                                                               |

`Order` : `id`, `reference` (unique), `createdAt`, `status` (`pending | confirmed | preparing | delivering | delivered | cancelled`), `customer { id, fullName, email, phone }`, `deliverySlot { date, start, end }`, `deliveryCity`, `deliveryPostalCode`, `lines[] { productId, productName, quantity, unit, lineTotalCents }` (instantané au moment de l'achat), `totalCents`, `cancellation { reason, detail } | null`.

`OrderEvent` : `id`, `orderId`, `from`, `to`, `actor { id, name }`, `cancellation | null`, `at`.

## Livraisons

Pas de source propre : la tournée est `getOrders({ date })` et des règles pures (`summarizeTour`, `nextStopIndex`, `nextDeliveryStep`, `itineraryUrl`). L'adresse de rue n'existe pas encore (question 13).

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

`Customer` : `id`, `fullName`, `email`, `phone`, `city`, `postalCode`, `createdAt`, `notes[] { id, text, authorName, createdAt }`. Données personnelles au sens du RGPD ; les notes internes ne sont jamais visibles de la personne.

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

En mode mock, les comptes viennent de `.env.local` ; en mode db, de la table `users` (seed puis écran `/comptes`).

## Session

`getCurrentUser()` (`src/data/session.ts`) → `CurrentUser { id, name, role }` depuis la session Auth.js, ou redirection vers `/connexion`. Toute page et toute action commencent par là.

## Ce que le front n'utilise jamais

Adresse de rue, mots de passe ou jetons de l'application FIG, coordonnées bancaires. Si la base en contient un jour, aucune fonction ci-dessus ne les renverra.
