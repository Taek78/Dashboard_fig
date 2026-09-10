# Branchements : ce que le front attend, ce que la base devra fournir

Contrat entre le front (piste A, sur fixtures) et la future couche Drizzle (piste B). Une ligne par fonction et par champ. La colonne « colonne client » reste « inconnue » tant que `drizzle-kit pull` (B2) n'a pas eu lieu ; toute conversion découverte est notée ici **avant** d'être codée dans le mapper `toOrder()` (B3).

Mis à jour à la fin du jalon A1 (2026-09-08). À compléter à chaque jalon A qui ajoute une fonction ou un champ.

## Fonctions consommées par le front

### `OrdersSource` (`src/domain/orders/source.ts`, implémenté par `src/data/orders.mock.ts`, exposé par `src/data/orders.ts`)

| Fonction | Entrées | Sortie | Implémentation actuelle | Requête cible (B3) | Consommateur |
|---|---|---|---|---|---|
| `getOrders` | aucune (A2 : `filters?: OrderFilters`) | `Order[]`, triées par créneau croissant (A2 : `sortOrdersBySlot` : date, début, référence, après `filterOrders`) | copie des 14 fixtures après 400 ms | `SELECT … FROM <commandes> [WHERE statut, date] ORDER BY … LIMIT` | `app/(dashboard)/commandes/page.tsx` |
| `getOrder` | `id: string` | `Order \| null` | `find` par id + clone | `SELECT … WHERE id = $1` | A2 : `commandes/[id]/page.tsx` |
| `updateOrderStatus` (A2) | `id, from: OrderStatus, to: OrderStatus` | `Order \| null` (`null` si absent ou statut ≠ `from`) | Map mutable | `UPDATE … SET statut = $3 WHERE id = $1 AND statut = $2 RETURNING …` | A2 : `commandes/[id]/actions.ts` |

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
