# Jalon A2 : consignes d'implémentation (A2.0 → A2.8)

Rédigé le 2026-09-08 après cadrage par l'équipe (tech-lead, security-backend-architect, ui-ux-designer). Tu implémentes, Claude corrige et écrit les tests dans `test/`. Toutes les commandes se lancent depuis `dashboard/`. Détails d'interface dans [a2-spec-ui.md](a2-spec-ui.md), détails sécurité et flux d'écriture dans [a2-spec-branchements.md](a2-spec-branchements.md) : ce fichier dit quoi faire, ceux-là pourquoi en profondeur.

**Objectif A2** : filtrer la liste par l'URL (`?statut=pending&date=2026-09-08`), ouvrir une commande sur `/commandes/[id]`, changer son statut via une première Server Action sur un mock devenu mutable. Critère d'acceptation (backlog) : une transition interdite est refusée avec un message français, le mock reflète le changement.

Règles valables partout : imports en `@/…`, `import type` pour un type, `"use client"` seulement dans `order-status-form.tsx` (imposé par `useActionState`). Un seul nouveau fichier client en A2.

**Arbitrages du tech-lead** (pour ne pas les rediscuter) :
- Clés d'URL en français (`statut`, `date`, comme `simuler`), clés de code en anglais (`status`, `date`) : le schéma zod fait la traduction.
- Le mock **compose** deux fonctions pures : `filterOrders` filtre, `sortOrdersBySlot` trie (créneau croissant). Une fonction nommée « filter » ne trie pas.
- `actions.ts` vit dans le dossier de la route `[id]/`, à côté de son unique consommateur.
- Formulaire de filtres en GET via `Form` de `next/form`, composant serveur. Pas de `router.replace`.
- La page de détail n'appelle pas `getCurrentUser()` en A2 : le stub lève hors dev/test, ce qui casserait le détail en `npm run start`. La garde de rôle vit dans l'action (frontière de confiance) ; le masquage du formulaire pour le rôle `lecture` arrive en A7 avec la vraie session.
- Composants shadcn : `card`, `label`, `native-select`. Pas de `select` base-ui (client, inutile en GET), pas de `alert` (un `<p role="status">` suffit).

---

## A2.0 : point de départ

1. Le passage de style est appliqué et vérifié mais non commité : dis « commit et push » et Claude s'en occupe.
2. Installer les composants :
   ```bash
   npx shadcn@latest add card label native-select
   npm run format
   ```
   Répondre **non** si la CLI propose d'écraser un fichier existant. Si `native-select` n'existe pas dans le registre base-nova : ne rien installer d'autre, écrire un `<select>` natif avec les classes de `input.tsx` (voir spec UI §0).

Vérif : `ls src/components/ui` montre `card.tsx`, `label.tsx`, `native-select.tsx` ; `npm run check` vert.

---

## A2.1 : machine d'états (`src/domain/orders/status.ts`)

Ajouter sous les libellés :

```ts
const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["delivering", "cancelled"],
  delivering: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean;
export function allowedTransitions(from: OrderStatus): OrderStatus[]; // copie : [...ORDER_TRANSITIONS[from]]
```

Pourquoi un `Record` en liste blanche : tout ce qui n'est pas listé est refusé, et `tsc` refuse un statut sans entrée. `from → from` est faux : rester au même statut n'est pas une transition (le cas « déjà à ce statut » se traite dans l'action). `delivering → cancelled` refusé et aucun retour arrière : ce sont des questions client (Q4, Q7/Q9), notées dans `branchements.md`, pas des décisions à prendre seul.

Vérif : `npx vitest run test/domain/orders/status.test.ts` vert (Claude écrit le test : les 36 couples, terminaux sans sortie, cohérence `allowedTransitions` ↔ `canTransition`).

---

## A2.2 : règles pures, schémas d'entrée, formateurs

### 1. `src/domain/orders/types.ts`

```ts
export type OrderFilters = { status?: OrderStatus; date?: string }; // date = deliverySlot.date, AAAA-MM-JJ
```

### 2. `src/domain/orders/rules.ts`

```ts
export function filterOrders(orders: readonly Order[], filters: OrderFilters): Order[];
export function sortOrdersBySlot(orders: readonly Order[]): Order[];
```

`filterOrders` : garde une commande si (`status` absent ou égal) et (`date` absente ou égale à `deliverySlot.date`). `sortOrdersBySlot` : tri par `deliverySlot.date`, puis `start`, puis `reference` (stabilité) ; sur une **copie** (`[...orders].sort(...)`) car `sort` mute son tableau. Les deux renvoient un nouveau tableau : le résultat se stocke.

### 3. `src/domain/orders/schemas.ts` (nouveau)

```ts
import { z } from "zod";

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

Pourquoi : les seuls schémas zod du domaine valident des **entrées** (URL, `FormData`). En lecture, une valeur invalide est **ignorée** (`.catch(undefined)`) : un lien mal tapé affiche la liste complète, jamais une page cassée. Un paramètre répété (`?statut=a&statut=b`) arrive en tableau, échoue sur l'enum et tombe aussi dans `catch`. En écriture, `changeStatusSchema` est strict : pas de `catch`. Pas de regex sur `orderId` : le format des ids appartient au client (B2).

zod v4 : `z.enum(ORDER_STATUSES)` accepte le tuple `as const` tel quel ; `safeParse` → `{ success, data } | { success, error }` ; `error.issues` (plus `.errors`).

### 4. `src/lib/format.ts`

```ts
export function formatQuantity(quantity: number, unit: "piece" | "g"): string; // "500 g", "1,5 kg", "1 pièce", "3 pièces"
export function formatOrdersCount(count: number): string;                      // "1 commande", "5 commandes"
```

`g` sous 1000 → « 500 g » ; sinon division par 1000 avec `Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 })` + « kg ». Espace insécable (` `) entre nombre et unité. Union inline plutôt qu'un import du domaine : `src/lib` reste sans dépendance vers `src/domain`.

Vérif : `npx vitest run test/domain/orders test/lib` vert (Claude : `rules.test.ts` étendu, `schemas.test.ts`, `format.test.ts` étendu). Attendus sur les fixtures : `status: "pending"` → 3 commandes ; `date: "2026-09-08"` → 5 ; les deux → 2 ; premier trié = `cmd-0007`, dernier = `cmd-0012`. `grep -rn 'from "\.\.' src` vide.

---

## A2.3 : contrat et mock mutable

### 1. `src/domain/orders/source.ts`

```ts
export type OrdersSource = {
  getOrders(filters?: OrderFilters): Promise<Order[]>;
  getOrder(id: string): Promise<Order | null>;
  updateOrderStatus(id: string, from: OrderStatus, to: OrderStatus): Promise<Order | null>;
};
```

Lance `npm run typecheck` juste après : il **doit** échouer sur `orders.mock.ts`. C'est le contrat qui travaille : une implémentation incomplète casse à la déclaration, pas au premier appel.

### 2. `src/data/orders.mock.ts`

- `const store = new Map<string, Order>()` ; `function seed()` : `store.clear()` puis `store.set(o.id, structuredClone(o))` pour chaque fixture ; appelé une fois au chargement du module.
- `getOrders(filters = {})` : latence, puis `sortOrdersBySlot(filterOrders([...store.values()], filters))`, `structuredClone` du résultat.
- `getOrder(id)` : latence, `store.get(id)`, clone ou `null`. Lire la `Map`, plus `ordersFixtures` : sinon une mise à jour n'apparaît jamais.
- `updateOrderStatus(id, from, to)` : latence, `const current = store.get(id)` ; `if (!current || current.status !== from) return null` ; `current.status = to` ; `return structuredClone(current)`. Le mock n'applique **pas** `canTransition` : la règle a un seul propriétaire, l'action.
- `export function resetOrdersMock(): void { seed(); }` : **hors contrat**, réservé aux tests.

Pourquoi `null` si `from` ne correspond plus : c'est la mise à jour conditionnelle (`UPDATE … WHERE id = $1 AND status = $2`) que fera la vraie base en B5. Entre la lecture et l'écriture, un collègue a pu changer le statut ; on le détecte au lieu d'écraser. Clone à l'entrée (protège les fixtures partagées avec les tests) et à la sortie (protège le store des composants).

### 3. `src/data/orders.ts`

Réexporter `updateOrderStatus` sur le même modèle que `getOrders`. `getOrders` transmet `filters`. **Ne pas** réexporter `resetOrdersMock`.

Vérif : `npm run typecheck` vert ; `npx vitest run test/data` vert (Claude : `beforeEach(resetOrdersMock)`, succès visible via `getOrder`/`getOrders`, id inconnu → `null`, `from` périmé → `null` et store inchangé, clone, fixtures intactes, filtres + tri) ; `grep -rn "resetOrdersMock" src` → uniquement `orders.mock.ts`.

---

## A2.4 : page de détail en lecture

### 1. `src/components/orders/order-detail.tsx` (serveur)

Props `{ order: Order }`. Grille `grid gap-4 lg:grid-cols-3` de quatre `Card` dans cet ordre DOM : **Client** (nom, e-mail en `mailto:`, téléphone en `tel:`), **Livraison** (date via `formatDateFr`, créneau `start–end`, `codePostal ville`), **Statut** (`lg:row-span-2` ; badge + zone de formulaire, remplie en A2.6), **Articles** (`lg:col-span-2` ; `Table` produit / `formatQuantity` / `formatEuros`, `TableFooter` avec le total). Titres de cartes en `h2`. Détails de classes et textes : spec UI §3.

### 2. `src/app/(dashboard)/commandes/[id]/page.tsx` (serveur, async)

```ts
export const metadata: Metadata = { title: "Détail de la commande" };

export default async function CommandePage({ params }: PageProps<"/commandes/[id]">) {
  const { id } = await params;
  const parsed = orderIdSchema.safeParse(id);
  if (!parsed.success) notFound();
  const order = await getOrder(parsed.data);
  if (!order) notFound();
  // PageHeader (title `Commande ${order.reference}`, description client · créneau, action « Retour aux commandes ») + <OrderDetail order={order} />
}
```

`params` est une `Promise` en Next 16 : `await`. `notFound()` lève : pas de `return` devant, et hors de tout `try/catch`. `PageProps<"/commandes/[id]">` n'existe qu'après `npx next typegen` (ou un `next dev` lancé).

### 3. `[id]/not-found.tsx` (serveur, sans props)

`Empty` en bordure pointillée : « Commande introuvable », description, bouton « Retour aux commandes ». Pas de `PageHeader`.

### 4. `[id]/loading.tsx` (serveur)

Squelette de l'en-tête (titre, trait dégradé réel, description, bouton) puis la même grille avec quatre `Card` **réelles** contenant des `Skeleton` : le cadre ne bouge pas à l'arrivée des données. Pas d'`error.tsx` : celui de `commandes/` couvre le segment enfant.

### 5. `src/components/orders/orders-table.tsx`

La cellule Référence devient `<Link href={`/commandes/${order.id}`}>` avec `text-foreground font-medium underline-offset-4 hover:underline focus-visible:underline`. Retirer `text-muted-foreground` (un lien doit passer le contraste). Pas de ligne cliquable : une seule cible au clavier.

Vérif : `npx next typegen && npm run typecheck` vert ; avec le dev sur 3000 :
```bash
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/commandes/cmd-0003   # 200
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/commandes/cmd-9999   # 404
curl -s localhost:3000/commandes | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l   # 14
```

---

## A2.5 : résultat d'action et Server Action

### 1. `src/lib/action-result.ts` (pur, aucun import Next)

```ts
export type ActionResult =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export const idleActionResult: ActionResult = { status: "idle" };
```

Importable par le composant client et par les tests. Attention à la lecture : dans l'action, `result.status` (ActionResult) côtoie `order.status` (OrderStatus).

### 2. `src/app/(dashboard)/commandes/[id]/actions.ts`

```ts
"use server";
export async function changeOrderStatus(_prev: ActionResult, formData: FormData): Promise<ActionResult>;
```

Ordre **imposé** des étapes (chaque échec renvoie un `ActionResult` d'erreur au message français figé, jamais `error.message`) :

| # | Étape | Pourquoi à cette place |
|---|---|---|
| 1 | `const user = await getCurrentUser()` | Hors dev/test le stub lève : panne visible plutôt que back-office ouvert. |
| 2 | `if (!canChangeOrderStatus(user.role))` → erreur « Vous n'avez pas les droits pour modifier le statut d'une commande. » | Avant zod : un appelant non autorisé n'obtient aucune information de validation. |
| 3 | `changeStatusSchema.safeParse(Object.fromEntries(formData))` → erreur « Le statut choisi n'est pas valide. » | Avant toute lecture : la source ne reçoit jamais une valeur non validée. |
| 4 | `const order = await getOrder(orderId)` → `null` : erreur « Cette commande n'existe plus. » | On relit l'état réel au lieu de croire le formulaire. |
| 5 | `if (order.status === nextStatus)` → succès « La commande est déjà à ce statut. » | Double clic et rejeu deviennent inoffensifs. |
| 6 | `const allowed = canTransition(order.status, nextStatus); if (!allowed)` → erreur « Le passage de « X » à « Y » n'est pas autorisé. » (libellés via `ORDER_STATUS_LABELS`) | La règle métier vit ici, une seule fois. **Stocker** le résultat, puis tester. |
| 7 | `const updated = await updateOrderStatus(order.id, order.status, nextStatus)` → `null` : `revalidatePath` puis erreur « Cette commande a changé entre-temps, la page a été actualisée. » | Compare-and-set : `from` = `order.status` relu, jamais une valeur du client. |
| 8 | `revalidatePath("/commandes", "layout")` | Un seul appel couvre la liste et toutes les pages de détail. |
| 9 | `return { status: "success", message: `Statut mis à jour : ${label}.` }` | |

Étapes 4 à 7 dans un `try/catch` : `console.error("[changeOrderStatus]", { userId: user.id, orderId, step })` sans nom ni e-mail, retour « Impossible d'enregistrer le changement. Réessayez dans un instant. ». Rien d'autre dans un `try/catch`.

Vérif : `npm run check` vert ; `head -1 "src/app/(dashboard)/commandes/[id]/actions.ts"` → `"use server";` ; `grep -n "currentStatus" "src/app/(dashboard)/commandes/[id]/actions.ts"` vide (aucun statut courant lu depuis le formulaire) ; `grep -rn "orders.mock" src` → une ligne.

---

## A2.6 : formulaire de statut (`useActionState`)

`src/components/orders/order-status-form.tsx`, `"use client"` ligne 1. Props `{ orderId: string; currentStatus: OrderStatus; allowed: OrderStatus[] }`. Il n'importe que l'action, `@/domain/orders/status` (pur), `@/lib/action-result` et `@/components/ui/*` : jamais `@/data/*`.

```ts
const [result, formAction, pending] = useActionState(changeOrderStatus, idleActionResult);
```

`useActionState` (nouveau pour toi) : hook React qui relie un formulaire à une Server Action. `result` est le dernier `ActionResult` renvoyé, `formAction` se passe à `<form action>`, `pending` est vrai pendant l'aller-retour. La Server Action reçoit alors `(prevState, formData)` : d'où le premier paramètre `_prev` de l'étape A2.5.

Structure :
- `<form action={formAction} onSubmit={confirmIfCancelling} className="flex flex-col gap-3">`
- `<input type="hidden" name="orderId" value={orderId} />`
- `Label htmlFor="nextStatus"` « Nouveau statut » + `NativeSelect key={currentStatus} id="nextStatus" name="nextStatus" required defaultValue=""` : option `value="" disabled` « Choisir un statut », puis `allowed.map` → `ORDER_STATUS_LABELS[s]`.
- `Button type="submit" disabled={pending}` : « Changer le statut », en `pending` : `LoaderCircle className="animate-spin"` + « Enregistrement… ».
- `<p role="status" className="text-sm">` **toujours rendu** : `success` → `CircleCheck` + message en `text-success` ; `error` → `CircleAlert` + message en `text-destructive` ; `idle` → vide.
- `confirmIfCancelling` : si `new FormData(e.currentTarget).get("nextStatus") === "cancelled"` et `!window.confirm("Annuler cette commande ? Le client ne sera pas livré.")` → `e.preventDefault()`.

Pourquoi : option vide + `required` empêche un clic réflexe de changer la commande ; `key={currentStatus}` sur le **select** (pas sur le form) remet « Choisir un statut » après un succès sans effacer le message ; la région `role="status"` doit exister dès le premier rendu pour qu'un lecteur d'écran annonce le changement.

Dans `order-detail.tsx`, carte Statut : `const allowed = allowedTransitions(order.status)` ; si vide → `<p className="text-muted-foreground text-sm">Statut final : aucune transition possible.</p>` ; sinon `<OrderStatusForm orderId={order.id} currentStatus={order.status} allowed={allowed} />`. `allowed` est calculé côté serveur ; l'action le recalcule de toute façon.

Vérif dans le navigateur : `cmd-0001` `En attente → Confirmée`, le message de succès s'affiche, le badge change, la liste `/commandes` affiche « Confirmée ». Deux onglets sur `cmd-0002` : changer dans le premier, soumettre le second → message « a changé entre-temps ». Via l'inspecteur, ajouter `<option value="delivered">` sur une `pending` → refus FR, statut inchangé. `grep -rln '"use client"' src/components src/app` → `nav-main.tsx`, `commandes/error.tsx`, `order-status-form.tsx`, `ui/*` et rien d'autre.

---

## A2.7 : filtres dans l'interface

### 1. `src/components/orders/orders-filters.tsx` (serveur)

Props `{ filters: OrderFilters }`. `Form` de `next/form` avec `action="/commandes"` (GET : les champs deviennent les paramètres d'URL, `loading.tsx` s'affiche pendant la navigation, retour arrière et lien partageable gratuits). `className="flex flex-col gap-3 md:flex-row md:items-end"`.
- `Label htmlFor="statut"` « Statut » + `NativeSelect id="statut" name="statut" defaultValue={filters.status ?? ""}` : option `value=""` « Tous les statuts », puis `ORDER_STATUSES.map`.
- `Label htmlFor="date"` « Date de livraison » + `Input id="date" type="date" name="date" defaultValue={filters.date ?? ""} className="dark:scheme-dark"`.
- `Button type="submit"` « Filtrer » ; si un filtre est actif : `Button variant="ghost" render={<Link href="/commandes" />}` « Réinitialiser » (un lien, pas `type="reset"` qui ne vide pas l'URL).

### 2. `src/app/(dashboard)/commandes/page.tsx`

```ts
const raw = await searchParams;
const mode = readSimulationMode(raw.simuler, isDev);
const filters = parseOrderFilters(raw);
const orders = mode === "vide" ? [] : await getOrders(filters);
const isFiltered = filters.status !== undefined || filters.date !== undefined;
```

Rendu : `PageHeader` → `<div className="flex flex-col gap-4">` : `OrdersFilters`, `<p role="status" className="text-muted-foreground text-sm">{formatOrdersCount(orders.length)}</p>`, puis tableau, ou état vide **filtré** si `isFiltered` (icône `SearchX`, « Aucune commande ne correspond », bouton « Réinitialiser les filtres »), ou état vide A1 sinon.

### 3. `commandes/loading.tsx`

Ajouter la silhouette de la barre de filtres avant le tableau (deux `Skeleton h-8 w-full md:w-48` précédés d'un `h-4 w-16`, plus un `h-8 w-20`).

Vérif :
```bash
curl -s "localhost:3000/commandes?statut=pending" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l          # 3
curl -s "localhost:3000/commandes?date=2026-09-08" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l        # 5
curl -s "localhost:3000/commandes?statut=pending&date=2026-09-08" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l   # 2
curl -s "localhost:3000/commandes?statut=foo" | grep -o 'href="/commandes/cmd-[0-9]*"' | sort -u | wc -l              # 14 (ignoré)
curl -s "localhost:3000/commandes?statut=delivered&date=2026-09-08" | grep -c "Aucune commande ne correspond"         # 1
```

---

## A2.8 : clôture

- `docs/branchements.md` : consommateurs `[id]/page.tsx` et `[id]/actions.ts`, tri par créneau (fait), trois questions client sur la matrice (Claude).
- Glossaire : machine d'états, route dynamique, `notFound()`, `revalidatePath`, compare-and-set, `next/form` (Claude).
- `npm run check` vert ; `npm run build` compile ; `npm run start -p 3124` : `/commandes?statut=pending` → 3 liens, `/commandes/cmd-0001` → 200, `?simuler=erreur` inerte.
- Commit : `feat(a2): filtres, détail et changement de statut des commandes sur mock mutable`.

---

## Points de vigilance

- **Imports relatifs** : `[id]/` est profond, la tentation `../../../components` est forte. `grep -rn 'from "\.\.' src` vide à chaque étape.
- **Résultat pur non stocké** : `canTransition(order.status, next);` seul ne protège rien ; `sortOrdersBySlot(orders);` sans affectation ne trie rien.
- **Gardes** : `if (!order) notFound()`, `if (!parsed.success)`, `if (!canChangeOrderStatus(user.role))`. Relire le sens de chaque `if`.
- **Statut envoyé par le formulaire** : l'action ne lit que `orderId` et `nextStatus` ; le `from` de `updateOrderStatus` vient de `getOrder`, jamais d'un champ caché.
- **`"use server"`** s'applique au fichier entier : rien d'autre que des actions dans `actions.ts`, et la première ligne de chaque action est `getCurrentUser()`.
- **`sort()` mute** : toujours `[...orders].sort(...)`.
- **shadcn** : `npm run format` après `add`, relire le diff de `globals.css`.

## Parking

- Recherche texte (référence, client) → A5. Auto-soumission des filtres, pagination, tri par colonne, filtre par ville.
- Statut « échec de livraison » (aujourd'hui `delivering → cancelled` refusé), retour arrière réservé à `admin` : questions client Q4, Q7/Q9.
- Masquer le formulaire de statut pour le rôle `lecture` (A7, avec `verifySession()`).
- `AlertDialog` à la place de `window.confirm` ; toast `sonner` ; `generateMetadata` avec la référence (exige `cache()` sur `getOrder`) ; `error.tsx` propre à `[id]` ; fil d'Ariane ; « Commandée le … » (`createdAt`).
- Journal des changements de statut (qui, quand) → B6.
- Règle ESLint `no-restricted-imports` sur `orders.mock` et `resetOrdersMock`.
