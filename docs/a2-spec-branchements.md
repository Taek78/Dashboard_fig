# Jalon A2 : spécification backend et sécurité « Server Action de changement de statut »

Produite par `security-backend-architect` le 2026-09-08, ajustée par le tech-lead (arbitrages en tête de [a2-consignes.md](a2-consignes.md)). Versions vérifiées dans `node_modules` : zod 4.5.4, Next 16.3.4.

Constats de départ : la façade `orders.ts` n'expose que `getOrders`/`getOrder` ; le mock lit directement `ordersFixtures` (il devra lire la `Map`, sinon une écriture est invisible) ; `[id]/` n'existe pas encore.

Rappels d'API :
- zod v4 : `z.enum` accepte un tuple `readonly` (`z.enum(ORDER_STATUSES)` sans spread) ; `z.iso.date()` valide `AAAA-MM-JJ` (refuse `07/09/2026` et `2026-13-01`) ; `error.issues` et `z.flattenError(error)` remplacent `.errors` et `.flatten()` ; messages personnalisés via `{ error: "…" }`. Vérifié : `z.enum(...).optional().catch(undefined)` renvoie `undefined` pour un tableau ou une valeur inconnue.
- Next 16 : `revalidatePath(path, type?)`, `type` obligatoire si le chemin contient un segment dynamique ; `forbidden()` est expérimental, on ne l'utilise pas ; la vérification CSRF `Origin`/`Host` est intégrée aux Server Actions, mais auth + autorisation + validation restent à faire dans chaque action.

## 1. Matrice `canTransition` (liste blanche) dans `status.ts`

`const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]>` : le `Record` force une entrée par statut (terminaux = `[]`) ; ajouter un statut sans décider ses sorties ne compile pas.

| from | to autorisés |
|---|---|
| `pending` | `confirmed`, `cancelled` |
| `confirmed` | `preparing`, `cancelled` |
| `preparing` | `delivering`, `cancelled` |
| `delivering` | `delivered` |
| `delivered` | aucun (terminal) |
| `cancelled` | aucun (terminal) |

```ts
export function canTransition(from: OrderStatus, to: OrderStatus): boolean; // ORDER_TRANSITIONS[from].includes(to)
export function allowedTransitions(from: OrderStatus): OrderStatus[];       // copie [...ORDER_TRANSITIONS[from]]
```

Cas discutables :
- **`x → x` est faux** : rester au même statut n'est pas une transition ; « déjà à ce statut » se traite dans l'action (§4, étape 5).
- **`delivering → cancelled` refusé** : un client absent est un « échec de livraison », statut qui n'existe pas encore. **Question client (Q7/Q9).**
- **Aucun retour arrière** : sur une base partagée avec l'appli du client, revenir en arrière peut contredire ses notifications ou triggers. Erreur de saisie = **question client (Q4)**, éventuellement réservée à `admin` en A7.
- **Terminaux irréversibles** : réouvrir une commande livrée ou annulée touche à la facturation ; hors périmètre tant que le client ne le demande pas.

## 2. Schémas zod v4 dans `src/domain/orders/schemas.ts`

```ts
export const orderIdSchema = z.string().trim().min(1).max(64);

export const changeStatusSchema = z.object({
  orderId: orderIdSchema,
  nextStatus: z.enum(ORDER_STATUSES),
});

export const orderFiltersSchema = z
  .object({
    statut: z.enum(ORDER_STATUSES).optional().catch(undefined),
    date: z.iso.date().optional().catch(undefined),
  })
  .transform(({ statut, date }) => ({ status: statut, date }));

export function parseOrderFilters(raw: Record<string, string | string[] | undefined>): OrderFilters;
```

- **Pas de regex `cmd-\d{4}`** : le format des ids appartient au client (inconnu avant B2). `min(1).max(64)` suffit : l'id ne sert qu'à une recherche par clé qui renvoie `null` si inconnu.
- **`z.object` (strip), pas `strictObject`** : un champ ajouté plus tard (bouton nommé…) ne doit pas casser l'action, et il n'y a aucun gain : l'action n'utilise que les deux champs validés.
- `orderIdSchema` valide aussi `params.id` de la page détail : un `params` est une entrée hostile.
- **Lecture tolérante** (`.catch(undefined)`) : une valeur invalide est ignorée, pas de 400. Un tableau (`?statut=a&statut=b`) échoue sur l'enum et tombe dans `catch`. Le filtre `date` cible `deliverySlot.date` (« commandes du jour »), pas `createdAt`.
- Clés d'URL en français (`statut`, `date`, cohérent avec `?simuler=`), clés de code en anglais via `transform`.
- `filterOrders(orders, filters)` et `sortOrdersBySlot(orders)` dans `rules.ts`, purs, ne mutent pas l'entrée ; le mock les compose.

## 3. `ActionResult` dans `src/lib/action-result.ts`

```ts
export type ActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };
export const idleActionResult: ActionResult = { status: "idle" };
```

- Fichier pur (aucun import Next) : importable par le composant `"use client"` et par les tests.
- Pas de `data` ni de `fieldErrors` en A2 : un seul champ, et la page se re-rend via `revalidatePath`. `fieldErrors` arrivera avec les formulaires du catalogue (A4).
- Piège de lecture : dans `actions.ts`, `result.status` (ActionResult) côtoie `order.status` (OrderStatus).
- Messages : constante `MESSAGES` figée en français dans `actions.ts`. Jamais `error.message`, jamais `orderId` ou `nextStatus` bruts reflétés : on n'affiche que `ORDER_STATUS_LABELS[...]` d'une valeur déjà validée par l'enum.

## 4. Flux de `changeOrderStatus`

Emplacement : `src/app/(dashboard)/commandes/[id]/actions.ts`, `"use server"` ligne 1. Formulaire : `src/components/orders/order-status-form.tsx` (`"use client"`, `useActionState`), props `{ orderId, currentStatus, allowed }` calculées par le serveur avec `allowedTransitions`.

```ts
export async function changeOrderStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult>;
```

| # | Étape | Si échec | Pourquoi à cette place |
|---|---|---|---|
| 1 | `const user = await getCurrentUser()` | laisse lever | Hors dev/test le stub plante : panne visible plutôt que back-office ouvert. |
| 2 | `canChangeOrderStatus(user.role)` | `error` droits | Avant zod : la réponse ne dépend pas de l'entrée, aucune information de validation à un appelant non autorisé. |
| 3 | `changeStatusSchema.safeParse(Object.fromEntries(formData))` | `error` statut invalide | Avant toute lecture : la source ne reçoit jamais une valeur non validée (en B5 ce sera du SQL). |
| 4 | `const order = await getOrder(orderId)` | `error` introuvable | On relit l'état réel au lieu de croire un statut envoyé par le formulaire. |
| 5 | `order.status === nextStatus` | `success` « déjà à ce statut » | No-op idempotent : double clic et rejeu inoffensifs sans polluer la matrice. |
| 6 | `canTransition(order.status, nextStatus)` | `error` passage non autorisé (libellés) | La règle métier vit ici, une seule fois ; mock et future base sont des stores bêtes. |
| 7 | `updateOrderStatus(order.id, order.status, nextStatus)` | `null` ⇒ `revalidatePath` puis `error` conflit | Compare-and-set : entre 4 et 7 un collègue a pu changer le statut ; `null` fusionne « disparue » et « périmée » comme `rowCount === 0` d'un `UPDATE … WHERE id = $1 AND status = $2`. |
| 8 | `revalidatePath("/commandes", "layout")` | | Un appel couvre `/commandes` et toutes les pages dessous, sans injecter de valeur dans le chemin. |
| 9 | `return { status: "success", message }` | | |

Étapes 4 à 7 dans un `try/catch` : `console.error("[changeOrderStatus]", { userId, orderId, step })` sans nom ni e-mail, retour `error` générique. Rien d'autre dans un `try/catch` (les étapes 1 à 3 ne lèvent pas, sauf le stub, volontairement).

Page détail : `PageProps<"/commandes/[id]">`, `const { id } = await params`, `orderIdSchema.safeParse(id)` échoue ou `getOrder` renvoie `null` ⇒ `notFound()` (appelé directement, sans `return`, hors `try/catch`), `not-found.tsx` en français dans le dossier. La page n'appelle pas `getCurrentUser()` en A2 (arbitrage tech-lead : le stub casserait le détail en `npm run start` ; la garde vit dans l'action).

## 5. Mock mutable (`orders.mock.ts`)

- `const store = new Map<string, Order>()` ; `seed()` = `store.clear()` puis `store.set(o.id, structuredClone(o))` pour chaque fixture ; appelé au chargement du module. Cloner à l'entrée protège `ordersFixtures` (tests) ; cloner à la sortie protège le store (composants).
- `getOrders(filters = {})` lit `[...store.values()]` puis `sortOrdersBySlot(filterOrders(...))` ; `getOrder` lit `store.get(id)`.
- `updateOrderStatus(id, from, to)` : `const current = store.get(id)` ; `if (!current || current.status !== from) return null` ; `current.status = to` ; `return structuredClone(current)`. Le mock **n'applique pas** `canTransition`.
- `export function resetOrdersMock(): void` = `seed()`, hors contrat, importé uniquement par les tests. Vérif : `grep -rn resetOrdersMock src` ⇒ une seule ligne.
- Singleton par processus : Turbopack ré-évalue le module quand lui ou ses imports changent ⇒ store re-seedé en dev ; acceptable (règle 5 du backlog). Jamais en production, donc pas de question multi-instance.

## 6. Scénarios d'attaque

| Scénario | Ce qui bloque | Gravité si absent |
|---|---|---|
| POST forgé `nextStatus=delivered` sur une `pending` (valide pour l'enum) | étape 6 `canTransition` | haute : livraison « fantôme », facturation faussée |
| `nextStatus=foo`, tableau, ou `File` à la place d'une string | étape 3 (`z.enum`, `z.string` refuse un `File`) | moyenne |
| `orderId` d'une autre commande, inexistant, ou de 10 Ko | `max(64)` puis `getOrder` ⇒ `null` ; id jamais interpolé dans un chemin ou du SQL brut | basse : en back-office tout le personnel voit toutes les commandes, l'autorisation est par rôle. À revoir en A7 si le client cloisonne par zone ou livreur (étape « ressource autorisée pour cet utilisateur »). |
| Utilisateur `lecture` qui rejoue le POST | étape 2, indépendante de l'UI | critique en prod ; aujourd'hui le stub renvoie toujours `gestionnaire`, la garde n'est testable que via `canChangeOrderStatus` |
| Double soumission | `pending` de `useActionState` désactive le bouton ; 2e requête ⇒ étape 5 no-op | basse |
| Deux onglets : A passe `pending→confirmed`, B envoie `pending→cancelled` après | B passe l'étape 6 mais l'étape 7 renvoie `null` ⇒ conflit, écran actualisé | moyenne : sans compare-and-set, une commande confirmée serait annulée en silence |
| Rejeu tardif d'une requête capturée | `from` périmé ou transition invalide ; terminaux irréversibles ; CSRF `Origin`/`Host` intégré ; cookie `SameSite=Lax` en A7 | basse |
| Fuite d'information | messages figés, libellés issus de l'enum validé, `console.error` serveur seulement ; Next remplace en production le message des erreurs levées par un digest | basse |

## 7. Tests (écrits par Claude, `dashboard/test/`)

- `domain/orders/status.test.ts` : chaque paire de la liste blanche ⇒ `true` ; produit cartésien moins la liste blanche ⇒ `false` ; `x → x` faux ; `allowedTransitions("delivered")` et `("cancelled")` ⇒ `[]` ; cohérence `allowedTransitions(from).every(to => canTransition(from, to))` et réciproque ; la copie renvoyée peut être mutée sans effet.
- `domain/orders/schemas.test.ts` : `changeStatusSchema` valide ⇒ `data` typée ; statut inconnu ⇒ `issues[0].path` = `["nextStatus"]` ; id vide ou espaces ⇒ `["orderId"]` ; 65 caractères ⇒ échec ; champ manquant ⇒ échec ; champ en trop ⇒ succès et absent de `data` ; non-string ⇒ échec. `orderFiltersSchema` / `parseOrderFilters` : `{}` ⇒ `{ status: undefined, date: undefined }` ; `statut=pending` ⇒ `status: "pending"` ; `statut=foo` et tableau ⇒ ignorés ; `date="2026-09-07"` ok ; `"07/09/2026"` et `"2026-13-01"` ⇒ ignorés ; clé inconnue (`simuler`) ignorée.
- `domain/orders/rules.test.ts` (compléter) : `filterOrders` sans filtre ⇒ même longueur et ordre ; par statut ⇒ compte exact (pending 3, confirmed 3, preparing 1, delivering 2, delivered 3, cancelled 2) ; par date ⇒ toutes sur `deliverySlot.date` (2026-09-08 ⇒ 5) ; combiné (pending + 2026-09-08 ⇒ 2) ; aucun ⇒ `[]` ; entrée non mutée. `sortOrdersBySlot` : premier `cmd-0007`, dernier `cmd-0012`, copie, ordre stable par référence à créneau égal.
- `lib/format.test.ts` (compléter) : `formatQuantity` 500 g, 1000 g, 1500 g, 1250 g, 1 pièce, 3 pièces, 0 pièce ; `formatOrdersCount` 0, 1, 5.
- `data/orders.mock.test.ts` (compléter, `beforeEach(resetOrdersMock)`) : succès ⇒ nouveau statut renvoyé, `getOrder` et `getOrders` le reflètent ; id inconnu ⇒ `null` ; `from` périmé ⇒ `null` et store inchangé ; retour = clone ; `ordersFixtures[0].status` reste `"pending"` après mise à jour ; `resetOrdersMock` restaure ; le mock accepte `pending → delivered` (verrouille que la règle vit dans l'action) ; `getOrders({ status: "pending" })` ⇒ 3, trié.
- `action-result.ts` : pas de test (un type et une constante). L'action n'est pas testable sous Vitest (imports `next/cache` et façade `server-only`) : c'est pourquoi elle reste mince et délègue aux fonctions pures.
