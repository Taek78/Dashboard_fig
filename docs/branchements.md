# Branchements : ce que le front attend, ce que la base devra fournir

Contrat entre le front (piste A, sur fixtures) et la future couche Drizzle (piste B). Une ligne par fonction et par champ. La colonne « colonne client » reste « inconnue » tant que `drizzle-kit pull` (B2) n'a pas eu lieu ; toute conversion découverte est notée ici **avant** d'être codée dans le mapper `toOrder()` (B3).

Mis à jour à la fin du jalon A1 (2026-09-08). À compléter à chaque jalon A qui ajoute une fonction ou un champ.

> **2026-09-14** : la base est conçue par le dashboard (revirement client). Chaque contrat ci-dessous a désormais son implémentation Drizzle `src/data/<domaine>.db.ts` ; les colonnes sont celles de `src/db/schema.ts` (guide : `docs/base-de-donnees.md`). Ce document garde son rôle : dire ce que le front consomme.

## Fonctions consommées par le front

### `OrdersSource` (`src/domain/orders/source.ts`, implémenté par `src/data/orders.mock.ts`, exposé par `src/data/orders.ts`)

| Fonction | Entrées | Sortie | Implémentation actuelle | Requête cible (B3) | Consommateur |
|---|---|---|---|---|---|
| `getOrders` | aucune (A2 : `filters?: OrderFilters`) | `Order[]`, triées par créneau croissant (A2 : `sortOrdersBySlot` : date, début, référence, après `filterOrders`) | copie des 14 fixtures après 400 ms | `SELECT … FROM <commandes> [WHERE statut, date] ORDER BY … LIMIT` | `app/(dashboard)/commandes/page.tsx` |
| `getOrder` | `id: string` | `Order \| null` | `find` par id + clone | `SELECT … WHERE id = $1` | `commandes/[id]/page.tsx`, `commandes/[id]/actions.ts` |
| `updateOrderStatus` (A2) | `id, from: OrderStatus, to: OrderStatus` | `Order \| null` (`null` si absent ou statut ≠ `from`) | Map mutable | `UPDATE … SET statut = $3 WHERE id = $1 AND statut = $2 RETURNING …` | `commandes/[id]/actions.ts` (étape 7 du flux) |

### Historique des statuts (`OrderEvent`, 2026-09-14)

`updateOrderStatus(id, { from, to, actor, cancellation })` écrit le statut, le motif d'annulation (colonne à prévoir sur la commande : `reason` parmi stock | delivery | other, `detail` ≤ 100 caractères, à communiquer au client par l'application) et l'événement `{ orderId, from, to, actor { id, name }, at }` dans la MÊME transaction que le statut (table `dashboard_order_events`, propriété du dashboard, à créer sous accord écrit en B2) ; `getOrderEvents(orderId)` les relit du plus récent au plus ancien pour la fiche commande. Le mock horodate avec une constante, la base mettra `now()`.

### Session (`src/data/session.ts`)

| Fonction | Entrées | Sortie | Implémentation actuelle | Cible (A7) | Consommateur |
|---|---|---|---|---|---|
| `getCurrentUser` | aucune | `CurrentUser = { id, name, role }` | utilisateur démo `gestionnaire`, refusé hors development/test | `verifySession()` Auth.js, même type de sortie | A2 : toute Server Action, première ligne |

## Champs du type `Order` (`src/domain/orders/types.ts`)

Chaque champ affiché ou utilisé par le front, avec sa forme attendue. Le mapper devra produire **exactement** ces champs, en objet littéral, jamais `return row`.

| Champ | Type TS | Unité / format | Où il est affiché | Colonne client | Conversion pressentie |
|---|---|---|---|---|---|
| `id` | `string` | opaque, stable | clé de ligne, URL de détail (A2) | inconnue | `String(row.id)` si entier |
| `reference` | `string` | libre, unique, ex. `FIG-260907-001` | colonne Référence | inconnue | telle quelle, ou dérivée de l'id si absente |
| `createdAt` | `string` | ISO 8601 avec fuseau | « commandée le » (parking) | inconnue (`timestamptz` espéré) | `row.created_at.toISOString()` |
| `status` | `OrderStatus` | `pending \| confirmed \| preparing \| delivering \| delivered \| cancelled` | badge, filtres (A2) | inconnue | table de correspondance ; valeur inconnue → erreur loguée, jamais devinée |
| `customer.id` | `string` | opaque | fiche client (A5) | inconnue | `String(...)` |
| `customer.fullName` | `string` | | colonne Client | inconnue (prénom + nom séparés ?) | concaténation si deux colonnes |
| `customer.email` | `string` | | fiche client (A5), recherche | inconnue | tel quel ; jamais loggé |
| `customer.phone` | `string` | | fiche client (A5), recherche | inconnue | normalisation d'affichage éventuelle |
| `deliverySlot.date` | `string` | `AAAA-MM-JJ` | colonne Créneau, tournée (A3) | inconnue (`date` ou `timestamptz` ?) | extraire la date en Europe/Paris |
| `deliverySlot.start` | `string` | `HH:mm` | colonne Créneau | inconnue (heure, ou id de créneau ?) | Q7 : si le client stocke un id de créneau, table de correspondance |
| `deliverySlot.end` | `string` | `HH:mm` | colonne Créneau | inconnue | idem |
| `deliveryCity` | `string` | | colonne Ville | inconnue | tel quel |
| `deliveryPostalCode` | `string` | 5 chiffres | fiche (A5), zones (A3) | inconnue | `String(...)`, garder le zéro initial |
| `lines[].productId` | `string` | opaque | détail (A2), catalogue (A4) | inconnue | `String(...)` |
| `lines[].productName` | `string` | | détail (A2) | inconnue (jointure produits ?) | jointure ou dénormalisation |
| `lines[].quantity` | `number` | entier, en `unit` | détail (A2) | inconnue | conversion si le client stocke en kg : `Math.round(kg * 1000)` |
| `lines[].unit` | `"piece" \| "g"` | | détail (A2) | inconnue | table de correspondance |
| `lines[].lineTotalCents` | `number` | centimes entiers | détail (A2) | inconnue (`numeric` en euros ?) | `Math.round(Number(x) * 100)` |
| `totalCents` | `number` | centimes entiers | colonne Total | inconnue | idem ; si absent, `computeOrderTotalCents(lines)` |
| `lines.length` | dérivé | | colonne Articles | | aucun |

Champs **non consommés** et à ne jamais mapper : adresse de rue, notes libres du client, mots de passe ou tokens, coordonnées bancaires. Voir la règle RGPD dans `docs/a1-spec-branchements.md` § 5.

## Vocabulaire à aligner (questions Q7 et Q9 au client)

| Notion | Vocabulaire du front (A1) | Vocabulaire du client | Décision |
|---|---|---|---|
| Statuts de commande | 6 valeurs `ORDER_STATUSES`, libellés FR dans `ORDER_STATUS_LABELS` | inconnu | `toOrder` traduit ; statut client sans équivalent → erreur loguée, ligne ignorée, jamais deviné |
| Ordre des statuts | matrice `canTransition` (A2, liste blanche) | inconnu | à confronter aux règles et triggers de la base avant B5. Questions ouvertes : `delivering → cancelled` (échec de livraison ?), retour arrière (erreur de saisie, réservé à `admin` ?), réouverture d'une commande livrée ou annulée |
| Créneaux de livraison | `{ date, start, end }` en chaînes | inconnu (créneaux fixes ? id ?) | Q7 |
| Unités de quantité | `"g"` ou `"piece"` | inconnu | Q7 |
| Rôles du back-office | `admin \| gestionnaire \| lecture` | inconnu (auth existante ?) | Q5 |
| Identifiants | chaînes opaques | inconnu (entiers ? uuid ?) | `String()` à la frontière ; resserrer `changeStatusSchema.orderId` en B3 |

## Ce que le branchement changera, et ce qu'il ne changera pas

- **Change** : `src/data/orders.db.ts` (nouveau, `ordersDb: OrdersSource` + `toOrder`), la ligne `const source` de `src/data/orders.ts` (ou son choix par `DATA_SOURCE`, B1), `src/lib/env-schema.ts`, `src/db/`.
- **Ne change pas** : `src/domain/**`, `src/components/**`, `src/app/**`, `src/lib/format.ts`, `src/lib/simulation.ts`. Si l'un d'eux doit bouger au branchement, c'est un défaut de ce contrat à corriger ici d'abord.

## Domaines ajoutés (A3 → A7, 2026-09-13)

Même convention : la colonne client est **inconnue** partout tant que B2 (introspection) n'a pas eu lieu. Chaque contrat vit dans `src/domain/<domaine>/source.ts`, la façade dans `src/data/<domaine>.ts` choisit mock ou db par `DATA_SOURCE` (`selectSource`).

### Livraisons (`DeliveriesSource`) : RETIRÉ le 2026-09-13

L'attribution de livreur a été retirée à la demande du client. Il ne reste dans `src/domain/deliveries` que des règles pures (jour courant, jours avec commandes, compteurs de tournée) : aucune fonction de source, aucune colonne à mapper. Le tableau ci-dessous est conservé pour mémoire si la fonctionnalité revient (question Q7).

#### Ancien contrat (inactif)

| Fonction | Entrées | Sortie | Mock | SQL attendu (B3) | Consommateurs |
|---|---|---|---|---|---|
| `getCouriers` | aucune | `Courier[]` | fixtures | `SELECT … FROM <livreurs>` | `livraisons/page.tsx`, `/`, action |
| `getAssignments` | `date?` | `Assignment[]` | Map par orderId | `SELECT … WHERE date = $1` | idem |
| `assignOrder` | `Assignment` | `Assignment` | upsert par orderId | `INSERT … ON CONFLICT (commande_id) DO UPDATE` | `livraisons/actions.ts` |

Champs : `Courier.id/name/phone/zone`, `Assignment.orderId/courierId/date/start/end`. Question client Q7 : les créneaux et livreurs existent-ils en base, sous quelle forme ?

### Catalogue (`ProductsSource`)

| Fonction | Entrées | Sortie | Mock | SQL attendu (B3) | Consommateurs |
|---|---|---|---|---|---|
| `getProducts` | `filters?` (catégorie, recherche, disponibilité) | `Product[]` triés par nom | filtre + tri purs | `SELECT … WHERE … ORDER BY nom` | `catalogue/page.tsx` |
| `getProduct` | `id` | `Product \| null` | Map | `SELECT … WHERE id = $1` | `catalogue/[id]/page.tsx`, action |
| `updateProduct` | `id, { priceCents, available, stockQuantity }` | `Product \| null` | écrit + updatedAt | `UPDATE … SET prix, dispo, stock, maj = now() WHERE id = $1 RETURNING …` | `catalogue/[id]/actions.ts` |

Champs (fiche complète depuis le 2026-09-13) : `name`, `variety`, `category` (fruit | vegetable), `unit`, `priceCents` (par kg si g, par pièce sinon), `unitWeightGrams` (pièce seulement, le prix au kilo s'en déduit), `container` (none | tray | parcel | crate | bag), `originCountry` (ISO2) + `originRegion`, `caliber { minMm, maxMm }`, `organic`, `inSeason`, `available`, `visible`, `stockQuantity`, `illustration` (emoji) + `imageUrl` (https). Fonctions ajoutées : `createProduct(input)` → `INSERT … RETURNING`, `deleteProduct(id)` → `DELETE … WHERE id = $1` (à confronter aux contraintes de clés étrangères des lignes de commande chez le client : peut devenir un archivage). Conversion euros → centimes faite par zod, jamais en base.

### Clients (`CustomersSource`)

| Fonction | Entrées | Sortie | Mock | SQL attendu (B3) | Consommateurs |
|---|---|---|---|---|---|
| `getCustomers` | `query?` | `Customer[]` triés par nom | recherche pure | `SELECT … WHERE nom ILIKE / email ILIKE / tel LIKE` | `clients/page.tsx` |
| `getCustomer` | `id` | `Customer \| null` (avec notes) | Map | `SELECT … + notes` | `clients/[id]/page.tsx`, action |
| `addNote` | `customerId, { text, authorName, createdAt }` | `CustomerNote \| null` | push | `INSERT INTO dashboard_notes …` (table **à créer**, accord Q4) | `clients/[id]/actions.ts` |

Les notes internes sont une donnée du dashboard, pas de l'appli : table préfixée `dashboard_*` à négocier (Q4). L'historique de commandes d'un client passe par `getOrders({ customerId })`.

### Comptes (`UsersSource`, A7)

| Fonction | Entrées | Sortie | Mock | SQL attendu | Consommateurs |
|---|---|---|---|---|---|
| `findUserByEmail` | `email` | `UserAccount \| null` | compte d'amorçage seedé depuis l'env | `SELECT … FROM dashboard_users WHERE email = $1` (table **à créer**, Q4/Q5) | `src/auth.ts` |

Champ `passwordHash` : scrypt (`src/lib/password.ts`). Jamais de mot de passe en clair, ni en base ni dans les logs.

### Articles (`ArticlesSource`, 2026-09-13)

| Fonction | Entrées | Sortie | Mock | SQL attendu | Consommateurs |
|---|---|---|---|---|---|
| `getArticles` | — | `Article[]` du plus récent au plus ancien, masqués et programmés compris | tri pur | `SELECT … ORDER BY parution DESC, maj DESC` | `articles/page.tsx` |
| `getArticle` | `id` | `Article \| null` | Map | `SELECT … WHERE id = $1` | `articles/[id]/page.tsx`, actions |
| `createArticle` | `ArticleInput` | `Article` | id compteur | `INSERT … RETURNING` | `articles/actions.ts` |
| `updateArticle` | `id, ArticleInput` | `Article \| null` | écrit + updatedAt | `UPDATE … WHERE id = $1 RETURNING` | actions (modification, visibilité) |
| `deleteArticle` | `id` | `boolean` | Map | `DELETE … WHERE id = $1` | `removeArticle` |

Champs : `title`, `body` (texte brut, paragraphes séparés par une ligne vide, 8 000 caractères max), `category` (nutrition \| recipe \| science \| news), `illustration` (emoji) + `imageUrl` (https), `publishedAt` (jour AAAA-MM-JJ ; dans le futur = programmé), `visible`. Question au client (Q12) : les articles existent-ils déjà dans l'application, avec quel format de texte (brut, Markdown, HTML) et quel stockage d'images ?

### Usage de l'application (`EngagementSource`, 2026-09-13)

| Fonction | Entrées | Sortie | Mock | Source réelle attendue | Consommateurs |
|---|---|---|---|---|---|
| `getEngagement` | aucune | `EngagementPoint[]` (par mois : téléchargements, inscriptions, réclamations, note moyenne, nombre d'avis) | fixtures mensuelles 2024-01 → 2026-09 | export des stores et du support (Q11), table `dashboard_engagement` mensuelle ou API | `metriques/page.tsx` |

### Métriques (A6)

Aucune fonction de source : tout est calculé par `src/domain/metrics/rules.ts` à partir de `getOrders()`. En B3, si les volumes l'exigent, ces agrégations pourront devenir des requêtes `GROUP BY` avec le **même résultat** que les fonctions pures (tests de référence).
